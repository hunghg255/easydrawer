import { type IVec2, Vec2, LineSegment2, Color4, Rect2, Path } from '~/math';

import BaseTool from './BaseTool';
import { decreaseSizeKeyboardShortcutId, increaseSizeKeyboardShortcutId } from './keybindings';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import type AbstractComponent from '../components/AbstractComponent';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import {
  type GestureCancelEvt,
  type KeyPressEvent,
  type PointerDownEvt,
  type PointerEvt,
  type PointerMoveEvt,
  type PointerUpEvt,
} from '../inputEvents';
import { PointerDevice } from '../Pointer';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type RenderingStyle from '../rendering/RenderingStyle';
import { EditorEventType } from '../types';
import { type MutableReactiveValue, ReactiveValue } from '../util/ReactiveValue';

export enum EraserMode {
  PartialStroke = 'partial-stroke',
  FullStroke = 'full-stroke',
}

export interface InitialEraserOptions {
  thickness?: number;
  mode?: EraserMode;
}

/** Handles switching from other primary tools to the eraser and back */
class EraserSwitcher extends BaseTool {
  private previousEnabledTool: BaseTool | null;
  private previousEraserEnabledState: boolean;

  public constructor(
    private editor: Editor,
    private eraser: Eraser,
  ) {
    super(editor.notifier, editor.localization.changeTool);
  }

  public override onPointerDown(event: PointerDownEvt): boolean {
    if (event.allPointers.length === 1 && event.current.device === PointerDevice.Eraser) {
      const toolController = this.editor.toolController;
      const enabledPrimaryTools = toolController
        .getPrimaryTools()
        .filter((tool) => tool.isEnabled());
      if (enabledPrimaryTools.length > 0) {
        this.previousEnabledTool = enabledPrimaryTools[0];
      } else {
        this.previousEnabledTool = null;
      }
      this.previousEraserEnabledState = this.eraser.isEnabled();

      this.eraser.setEnabled(true);
      if (this.eraser.onPointerDown(event)) {
        return true;
      } else {
        this.restoreOriginalTool();
      }
    }
    return false;
  }

  public override onPointerMove(event: PointerMoveEvt) {
    this.eraser.onPointerMove(event);
  }

  private restoreOriginalTool() {
    this.eraser.setEnabled(this.previousEraserEnabledState);
    if (this.previousEnabledTool) {
      this.previousEnabledTool.setEnabled(true);
    }
  }

  public override onPointerUp(event: PointerUpEvt) {
    this.eraser.onPointerUp(event);
    this.restoreOriginalTool();
  }

  public override onGestureCancel(event: GestureCancelEvt): void {
    this.eraser.onGestureCancel(event);
    this.restoreOriginalTool();
  }
}

/**
 * A tool that allows a user to erase parts of an image.
 */
export default class Eraser extends BaseTool {
  private lastPoint: IVec2 | null = null;
  private isFirstEraseEvt = true;
  private thickness: number;
  private thicknessValue: MutableReactiveValue<number>;
  private modeValue: MutableReactiveValue<EraserMode>;

  private toRemove: AbstractComponent[];
  private toAdd = new Set<AbstractComponent>();

  // Commands that each remove one element
  private eraseCommands: Erase[] = [];
  private addCommands: Command[] = [];

  public constructor(
    private editor: Editor,
    description: string,
    options?: InitialEraserOptions,
  ) {
    super(editor.notifier, description);

    this.thickness = options?.thickness ?? 10;

    this.thicknessValue = ReactiveValue.fromInitialValue(this.thickness);
    this.thicknessValue.onUpdate((value) => {
      this.thickness = value;

      this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
        kind: EditorEventType.ToolUpdated,
        tool: this,
      });
    });
    this.modeValue = ReactiveValue.fromInitialValue(options?.mode ?? EraserMode.FullStroke);
    this.modeValue.onUpdate((_value) => {
      this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
        kind: EditorEventType.ToolUpdated,
        tool: this,
      });
    });
  }

  /**
	 * @returns a tool that briefly enables the eraser when a physical eraser is used.
	 * This tool should be added to the tool list after the primary tools.
	 */
  public makeEraserSwitcherTool(): BaseTool {
    return new EraserSwitcher(this.editor, this);
  }

  private clearPreview() {
    this.editor.clearWetInk();
  }

  private getSizeOnCanvas() {
    return this.thickness / this.editor.viewport.getScaleFactor();
  }

  private drawPreviewAt(point: IVec2) {
    this.clearPreview();

    const size = this.getSizeOnCanvas();

    const renderer = this.editor.display.getWetInkRenderer();
    const rect = this.getEraserRect(point);
    const rect2 = this.getEraserRect(this.lastPoint ?? point);
    const fill: RenderingStyle = {
      fill: Color4.gray,
      stroke: { width: size / 10, color: Color4.blue },
    };
    renderer.drawPath(
      pathToRenderable(Path.fromConvexHullOf([...rect.corners, ...rect2.corners]), fill),
    );
  }

  /**
	 * @returns the eraser rectangle in canvas coordinates.
	 *
	 * For now, all erasers are rectangles or points.
	 */
  private getEraserRect(centerPoint: IVec2) {
    const size = this.getSizeOnCanvas();
    const halfSize = Vec2.of(size / 2, size / 2);
    return Rect2.fromCorners(centerPoint.minus(halfSize), centerPoint.plus(halfSize));
  }

  /** Erases in a line from the last point to the current. */
  private eraseTo(currentPoint: IVec2) {
    if (!this.isFirstEraseEvt && currentPoint.distanceTo(this.lastPoint!) === 0) {
      return;
    }
    this.isFirstEraseEvt = false;

    // Currently only objects within eraserRect or that intersect a straight line
    // from the center of the current rect to the previous are erased. TODO: Erase
    // all objects as if there were pointerMove events between the two points.
    const eraserRect = this.getEraserRect(currentPoint);
    const line = new LineSegment2(this.lastPoint!, currentPoint);
    const region = Rect2.union(line.bbox, eraserRect);

    const intersectingElems = this.editor.image
      .getComponentsIntersecting(region)
      .filter((component) => {
        return component.intersects(line) || component.intersectsRect(eraserRect);
      });

    // Only erase components that could be selected (and thus interacted with)
    // by the user.
    const eraseableElems = intersectingElems.filter((elem) => elem.isSelectable());

    if (this.modeValue.get() === EraserMode.FullStroke) {
      // Remove any intersecting elements.
      this.toRemove.push(...eraseableElems);

      // Create new Erase commands for the now-to-be-erased elements and apply them.
      const newPartialCommands = eraseableElems.map((elem) => new Erase([elem]));
      newPartialCommands.forEach((cmd) => cmd.apply(this.editor));
      this.eraseCommands.push(...newPartialCommands);
    } else {
      const toErase: AbstractComponent[] = [];
      const toAdd: AbstractComponent[] = [];
      for (const targetElem of eraseableElems) {
        toErase.push(targetElem);

        // Completely delete items that can't be divided.
        if (!targetElem.withRegionErased) {
          continue;
        }

        // Completely delete items that are completely or almost completely
        // contained within the eraser.
        const grownRect = eraserRect.grownBy(eraserRect.maxDimension / 3);
        if (grownRect.containsRect(targetElem.getExactBBox())) {
          continue;
        }

        // Join the current and previous rectangles so that points between events are also
        // erased.
        const erasePath = Path.fromConvexHullOf(
          [
            ...eraserRect.corners,
            ...this.getEraserRect(this.lastPoint ?? currentPoint).corners,
          ].map((p) => this.editor.viewport.roundPoint(p)),
        );

        toAdd.push(...targetElem.withRegionErased(erasePath, this.editor.viewport));
      }

      const eraseCommand = new Erase(toErase);
      const newAddCommands = toAdd.map((elem) => EditorImage.addComponent(elem));

      eraseCommand.apply(this.editor);
      newAddCommands.forEach((command) => command.apply(this.editor));

      const finalToErase = [];
      for (const item of toErase) {
        if (this.toAdd.has(item)) {
          this.toAdd.delete(item);
        } else {
          finalToErase.push(item);
        }
      }

      this.toRemove.push(...finalToErase);

      for (const item of toAdd) {
        this.toAdd.add(item);
      }
      this.eraseCommands.push(new Erase(finalToErase));
      this.addCommands.push(...newAddCommands);
    }

    this.drawPreviewAt(currentPoint);
    this.lastPoint = currentPoint;
  }

  public override onPointerDown(event: PointerEvt): boolean {
    if (event.allPointers.length === 1 || event.current.device === PointerDevice.Eraser) {
      this.lastPoint = event.current.canvasPos;
      this.toRemove = [];
      this.toAdd.clear();
      this.isFirstEraseEvt = true;

      this.drawPreviewAt(event.current.canvasPos);
      return true;
    }

    return false;
  }

  public override onPointerMove(event: PointerEvt): void {
    const currentPoint = event.current.canvasPos;

    this.eraseTo(currentPoint);
  }

  public override onPointerUp(event: PointerEvt): void {
    this.eraseTo(event.current.canvasPos);

    const commands: Command[] = [];

    if (this.addCommands.length > 0) {
      this.addCommands.forEach((cmd) => cmd.unapply(this.editor));

      // Remove items from toAdd that are also present in toRemove -- adding, then
      // removing these does nothing, and can break undo/redo.
      for (const item of this.toAdd) {
        if (this.toRemove.includes(item)) {
          this.toAdd.delete(item);
          this.toRemove = this.toRemove.filter((other) => other !== item);
        }
      }
      for (const item of this.toRemove) {
        if (this.toAdd.has(item)) {
          this.toAdd.delete(item);
          this.toRemove = this.toRemove.filter((other) => other !== item);
        }
      }

      commands.push(...[...this.toAdd].map((a) => EditorImage.addComponent(a)));

      this.addCommands = [];
    }

    if (this.eraseCommands.length > 0) {
      // Undo commands for each individual component and unite into a single command.
      this.eraseCommands.forEach((cmd) => cmd.unapply(this.editor));
      this.eraseCommands = [];

      const command = new Erase(this.toRemove);
      commands.push(command);
    }

    if (commands.length === 1) {
      this.editor.dispatch(commands[0]); // dispatch: Makes undo-able.
    } else {
      this.editor.dispatch(uniteCommands(commands));
    }

    this.clearPreview();
  }

  public override onGestureCancel(_event: GestureCancelEvt): void {
    this.addCommands.forEach((cmd) => cmd.unapply(this.editor));
    this.eraseCommands.forEach((cmd) => cmd.unapply(this.editor));
    this.eraseCommands = [];
    this.addCommands = [];
    this.clearPreview();
  }

  public override onKeyPress(event: KeyPressEvent): boolean {
    const shortcuts = this.editor.shortcuts;

    let newThickness: number | undefined;
    if (shortcuts.matchesShortcut(decreaseSizeKeyboardShortcutId, event)) {
      newThickness = (this.getThickness() * 2) / 3;
    } else if (shortcuts.matchesShortcut(increaseSizeKeyboardShortcutId, event)) {
      newThickness = (this.getThickness() * 3) / 2;
    }

    if (newThickness !== undefined) {
      newThickness = Math.min(Math.max(1, newThickness), 200);
      this.setThickness(newThickness);
      return true;
    }

    return false;
  }

  /** Returns the side-length of the tip of this eraser. */
  public getThickness() {
    return this.thickness;
  }

  /** Sets the side-length of this' tip. */
  public setThickness(thickness: number) {
    this.thicknessValue.set(thickness);
  }

  /**
	 * Returns a {@link MutableReactiveValue} that can be used to watch
	 * this tool's thickness.
	 */
  public getThicknessValue() {
    return this.thicknessValue;
  }

  /** @returns An object that allows switching between a full stroke and a partial stroke eraser. */
  public getModeValue() {
    return this.modeValue;
  }
}
