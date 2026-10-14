import { Color4, type IVec2, Rect2, Vec2 } from '~/math';

import BaseTool from './BaseTool';
import type AbstractComponent from '../components/AbstractComponent';
import Connector, { type ConnectorArrowMode, type ConnectorStyle } from '../components/Connector';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import { type PointerEvt } from '../inputEvents';
import { PointerDevice } from '../Pointer';
import { EditorEventType } from '../types';

/**
 * Draws arrows/lines between components: drag from one shape (or sticky note, text…) to
 * another. Ends dropped on a component stay attached to it and follow it when it moves.
 */
export default class ConnectorTool extends BaseTool {
  private style: ConnectorStyle = {
    color: Color4.fromHex('#1f2937'),
    thickness: 2,
    arrow: 'end',
  };
  private startPoint: IVec2 | null = null;
  private startTarget: AbstractComponent | null = null;
  private preview: Connector | null = null;

  public constructor(
    private editor: Editor,
    description: string,
  ) {
    super(editor.notifier, description);
  }

  public getColor() {
    return this.style.color;
  }

  public setColor(color: Color4) {
    this.style = { ...this.style, color };
    this.noteUpdated();
  }

  /** Line width, in screen pixels (at the current zoom when drawing). */
  public getThickness() {
    return this.style.thickness;
  }

  public setThickness(thickness: number) {
    this.style = { ...this.style, thickness };
    this.noteUpdated();
  }

  public getArrowMode() {
    return this.style.arrow;
  }

  public setArrowMode(arrow: ConnectorArrowMode) {
    this.style = { ...this.style, arrow };
    this.noteUpdated();
  }

  private noteUpdated() {
    this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
      kind: EditorEventType.ToolUpdated,
      tool: this,
    });
  }

  /** The topmost component (other than connectors) under `point`. */
  private componentAt(point: IVec2): AbstractComponent | null {
    const radius = this.editor.viewport.getSizeOfPixelOnCanvas() * 4;
    const region = Rect2.fromCorners(point.minus(Vec2.of(radius, radius)), point.plus(Vec2.of(radius, radius)));
    const candidates = this.editor.image
      .getComponentsIntersecting(region)
      .filter((c) => !(c instanceof Connector) && c.isSelectable() && c.getBBox().grownBy(radius).containsPoint(point));
    return candidates[candidates.length - 1] ?? null;
  }

  private makeConnector(endPoint: IVec2, endTarget: AbstractComponent | null) {
    const scale = this.editor.viewport.getSizeOfPixelOnCanvas();
    const connector = new Connector(
      { point: this.startPoint!, targetId: this.startTarget?.getId() },
      { point: endPoint, targetId: endTarget?.getId() },
      { ...this.style, thickness: this.style.thickness * scale },
    );
    connector.updateEnds(this.editor.image);
    return connector;
  }

  private renderPreview(endPoint: IVec2) {
    const endTarget = this.componentAt(endPoint);
    this.preview = this.makeConnector(endPoint, endTarget === this.startTarget ? null : endTarget);

    this.editor.clearWetInk();
    const renderer = this.editor.display.getWetInkRenderer();

    // Outline the components the ends will attach to.
    const highlight = Color4.fromHex('#3b82f6');
    for (const target of [this.startTarget, endTarget === this.startTarget ? null : endTarget]) {
      if (target) {
        renderer.drawRect(target.getBBox(), 2 * this.editor.viewport.getSizeOfPixelOnCanvas(), { fill: highlight });
      }
    }
    this.preview.render(renderer);
  }

  public override onPointerDown({ current, allPointers }: PointerEvt): boolean {
    if (allPointers.length !== 1 || current.device === PointerDevice.Eraser) {
      return false;
    }

    this.startTarget = this.componentAt(current.canvasPos);
    this.startPoint = this.startTarget ? this.startTarget.getBBox().center : current.canvasPos;
    this.renderPreview(current.canvasPos);
    return true;
  }

  public override onPointerMove({ current }: PointerEvt): void {
    if (this.startPoint) {
      this.renderPreview(current.canvasPos);
    }
  }

  public override onPointerUp({ current }: PointerEvt): void {
    if (!this.startPoint) return;

    let endTarget = this.componentAt(current.canvasPos);
    if (endTarget === this.startTarget) endTarget = null;

    const minLength = 10 * this.editor.viewport.getSizeOfPixelOnCanvas();
    const draggedFar = current.canvasPos.distanceTo(this.startTarget ? this.startTarget.getBBox().center : this.startPoint) > minLength;
    const isClickOnStart = !endTarget && this.startTarget?.getBBox().containsPoint(current.canvasPos);

    if (draggedFar && !isClickOnStart) {
      void this.editor.dispatch(EditorImage.addComponent(this.makeConnector(current.canvasPos, endTarget)));
    }
    this.reset();
  }

  public override onGestureCancel(): void {
    this.reset();
  }

  private reset() {
    this.startPoint = null;
    this.startTarget = null;
    this.preview = null;
    this.editor.clearWetInk();
  }
}
