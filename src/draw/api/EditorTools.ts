import {
  type ToolName,
  type ToolOptionsMap,
  type PenToolOptions,
  type ShapeToolOptions,
  type EraserToolOptions,
  type TextToolOptions,
  type SelectToolOptions,
  type LaserToolOptions,
  toColor4,
  toolNames,
} from './options';
import { penStyles, shapeTypes } from '../components/builders/presets';
import type Editor from '../Editor';
import type BaseTool from '../tools/BaseTool';
import Eraser, { EraserMode } from '../tools/Eraser';
import LaserPointer from '../tools/LaserPointer';
import type PipetteTool from '../tools/PipetteTool';
import Pen from '../tools/Pen';
import SelectionTool from '../tools/SelectionTool/SelectionTool';
import { SelectionMode } from '../tools/SelectionTool/types';
import ShapeTool from '../tools/ShapeTool';
import TextTool from '../tools/TextTool';
import { EditorEventType } from '../types';

/** Applies `options` to `tool`. Unknown tool/option combinations are ignored. */
export function applyToolOptions (tool: BaseTool, options: ToolOptionsMap[ToolName]) {
  if (tool instanceof Pen) {
    const penOptions = options as PenToolOptions;
    if (penOptions.color !== undefined) tool.setColor(toColor4(penOptions.color));
    if (penOptions.thickness !== undefined) tool.setThickness(penOptions.thickness);
    if (penOptions.style !== undefined) {
      tool.setStrokeFactory(
        typeof penOptions.style === 'string' ? penStyles[penOptions.style] : penOptions.style,
      );
    }
    if (penOptions.pressureSensitive !== undefined) {
      tool.setPressureSensitivityEnabled(penOptions.pressureSensitive);
    }
    if (penOptions.stabilization !== undefined) tool.setHasStabilization(penOptions.stabilization);
    if (penOptions.autocorrect !== undefined) tool.setStrokeAutocorrectEnabled(penOptions.autocorrect);
  } else if (tool instanceof ShapeTool) {
    const shapeOptions = options as ShapeToolOptions;
    if (shapeOptions.color !== undefined) tool.setColor(toColor4(shapeOptions.color));
    if (shapeOptions.borderColor !== undefined) {
      tool.setBorderColor(toColor4(shapeOptions.borderColor));
    }
    if (shapeOptions.thickness !== undefined) tool.setThickness(shapeOptions.thickness);
    if (shapeOptions.shape !== undefined) {
      tool.setStrokeFactory(
        typeof shapeOptions.shape === 'string' ? shapeTypes[shapeOptions.shape] : shapeOptions.shape,
      );
    }
  } else if (tool instanceof Eraser) {
    const eraserOptions = options as EraserToolOptions;
    if (eraserOptions.thickness !== undefined) tool.setThickness(eraserOptions.thickness);
    if (eraserOptions.mode !== undefined) {
      tool.getModeValue().set(
        eraserOptions.mode === 'partial-stroke' ? EraserMode.PartialStroke : EraserMode.FullStroke,
      );
    }
  } else if (tool instanceof SelectionTool) {
    const selectOptions = options as SelectToolOptions;
    if (selectOptions.mode !== undefined) {
      tool.modeValue.set(selectOptions.mode === 'lasso' ? SelectionMode.Lasso : SelectionMode.Rectangle);
    }
  } else if (tool instanceof LaserPointer) {
    const laserOptions = options as LaserToolOptions;
    if (laserOptions.color !== undefined) tool.setColor(toColor4(laserOptions.color));
    if (laserOptions.thickness !== undefined) tool.setThickness(laserOptions.thickness);
  } else if (tool instanceof TextTool) {
    const textOptions = options as TextToolOptions;
    if (textOptions.color !== undefined) tool.setColor(toColor4(textOptions.color));
    if (textOptions.fontSize !== undefined) tool.setFontSize(textOptions.fontSize);
    if (textOptions.fontFamily !== undefined) tool.setFontFamily(textOptions.fontFamily);
  }
}

/**
 * Easy access to the editor's built-in tools, by name.
 *
 * Available as {@link Editor.tools}.
 *
 * @example
 * ```ts
 * const editor = new Editor(document.body);
 *
 * editor.tools.use('highlighter');
 * editor.tools.configure('pen', { color: '#e11d48', thickness: 3 });
 * editor.tools.configure('shape', { shape: 'star', color: 'gold' });
 *
 * editor.tools.onChange((name) => console.log('Active tool:', name));
 * ```
 */
export default class EditorTools {
  /** @internal */
  public constructor(private editor: Editor) {}

  /**
   * Returns the built-in tool with the given name, or `null` if it was removed
   * from the editor.
   */
  public get<Name extends ToolName>(name: Name): ToolTypeMap[Name] | null {
    return this.editor.toolController.getToolByName(name) as ToolTypeMap[Name] | null;
  }

  private require<Name extends ToolName>(name: Name): ToolTypeMap[Name] {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`The "${name}" tool is not available.`);
    }
    return tool;
  }

  public get pen(): Pen {
    return this.require('pen'); 
  }
  public get highlighter(): Pen {
    return this.require('highlighter'); 
  }
  public get eraser(): Eraser {
    return this.require('eraser'); 
  }
  public get shape(): ShapeTool {
    return this.require('shape'); 
  }
  public get text(): TextTool {
    return this.require('text'); 
  }
  public get select(): SelectionTool {
    return this.require('select'); 
  }

  /**
   * Makes `name` the active tool (disabling the other drawing tools).
   * Pass `null` to disable all of them, which leaves only panning/zooming.
   */
  public use(name: ToolName | null) {
    if (name === null) {
      for (const tool of this.editor.toolController.getPrimaryTools()) {
        tool.setEnabled(false);
      }
      return;
    }

    this.require(name).setEnabled(true);
  }

  /** The name of the active built-in tool, or `null` if none is active. */
  public get active(): ToolName | null {
    for (const name of toolNames) {
      if (this.get(name)?.isEnabled()) {
        return name;
      }
    }
    return null;
  }

  /**
   * Updates the options of a tool. Only the given options change.
   *
   * @example
   * ```ts
   * editor.tools.configure('pen', { color: 'rgb(0, 0, 255)', thickness: 4, style: 'natural' });
   * editor.tools.configure('eraser', { mode: 'partial-stroke' });
   * ```
   */
  public configure<Name extends ToolName>(name: Name, options: ToolOptionsMap[Name]) {
    applyToolOptions(this.require(name), options);
  }

  /**
   * Calls `callback` whenever the active tool changes.
   * @returns a function that removes the listener.
   */
  public onChange(callback: (active: ToolName | null) => void): () => void {
    let lastActive = this.active;
    const listener = this.editor.notifier.on(EditorEventType.ToolEnabled, () => {
      const active = this.active;
      if (active !== lastActive) {
        lastActive = active;
        callback(active);
      }
    });
    const disabledListener = this.editor.notifier.on(EditorEventType.ToolDisabled, () => {
      // Wait: another tool may be about to be enabled.
      queueMicrotask(() => {
        const active = this.active;
        if (active !== lastActive) {
          lastActive = active;
          callback(active);
        }
      });
    });

    return () => {
      listener.remove();
      disabledListener.remove();
    };
  }
}

export interface ToolTypeMap {
  select: SelectionTool;
  text: TextTool;
  pen: Pen;
  highlighter: Pen;
  eraser: Eraser;
  shape: ShapeTool;
  laser: LaserPointer;
  eyedropper: PipetteTool;
}
