import { Color4 } from '~/math';

import {
  type PenStyleName,
  type ShapeTypeName,
} from '../components/builders/presets';
import { type ComponentBuilderFactory } from '../components/builders/types';
import { type SketchOptions } from '../rendering/sketch';

/** A color: a {@link Color4} or any CSS color string (`'#ff0000'`, `'rgba(0,0,0,0.3)'`, `'red'`…). */
export type ColorInput = Color4 | string;

export function toColor4 (color: ColorInput): Color4 {
  return typeof color === 'string' ? Color4.fromString(color) : color;
}

/** Names of the built-in tools. */
export type ToolName =
  | 'select'
  | 'text'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'laser'
  | 'eyedropper'
  | 'sticky'
  | 'connector';

export const toolNames: readonly ToolName[] = [
  'select',
  'text',
  'pen',
  'highlighter',
  'eraser',
  'shape',
  'laser',
  'eyedropper',
  'sticky',
  'connector',
];

export interface PenToolOptions {
  color?: ColorInput;
  /** Stroke width in pixels (at 100% zoom), at medium pressure. */
  thickness?: number;
  /** A built-in style name, or a custom {@link ComponentBuilderFactory}. */
  style?: PenStyleName | ComponentBuilderFactory;
  /** Whether stylus pressure changes the stroke width. Default: `true`. */
  pressureSensitive?: boolean;
  /** Extra inertia-based input stabilization. Default: `false`. */
  stabilization?: boolean;
  /** Convert a stroke into a shape when the pen is held still at the end. Default: `false`. */
  autocorrect?: boolean;
}

export interface ShapeToolOptions {
  /** A built-in shape name, or a custom {@link ComponentBuilderFactory}. */
  shape?: ShapeTypeName | ComponentBuilderFactory;
  /** Fill color. */
  color?: ColorInput;
  borderColor?: ColorInput;
  /** Border width. `0` for no border. */
  thickness?: number;
  /**
   * Hand-drawn style (like Excalidraw): `true`, or options such as
   * `{ roughness: 2, fillStyle: 'cross-hatch' }`. Default: `false`.
   */
  sketch?: boolean | SketchOptions;
}

export interface EraserToolOptions {
  thickness?: number;
  /** `'full-stroke'` erases whole strokes, `'partial-stroke'` erases only the touched parts. */
  mode?: 'full-stroke' | 'partial-stroke';
}

export interface TextToolOptions {
  color?: ColorInput;
  fontSize?: number;
  fontFamily?: string;
}

export interface SelectToolOptions {
  /** `'rectangle'` (default) drags a box; `'lasso'` selects inside a freehand loop. */
  mode?: 'rectangle' | 'lasso';
}

export interface LaserToolOptions {
  color?: ColorInput;
  /** Trail width in screen pixels. Default: `6`. */
  thickness?: number;
}

export interface StickyToolOptions {
  /** Color of new notes. */
  color?: ColorInput;
}

export interface ConnectorToolOptions {
  color?: ColorInput;
  /** Line width in pixels (at the zoom level used when drawing). Default: `2`. */
  thickness?: number;
  /** Where to draw arrowheads. Default: `'end'`. */
  arrow?: 'end' | 'both' | 'none';
  /** `'straight'` (default), or `'elbow'`: right-angle lines that go around other shapes. */
  routing?: 'straight' | 'elbow';
  /** Hand-drawn style (like Excalidraw). Default: `false`. */
  sketch?: boolean;
}

/** Maps each tool name to its options type. */
export interface ToolOptionsMap {
  select: SelectToolOptions;
  laser: LaserToolOptions;
  eyedropper: Record<string, never>;
  text: TextToolOptions;
  pen: PenToolOptions;
  highlighter: PenToolOptions;
  eraser: EraserToolOptions;
  shape: ShapeToolOptions;
  sticky: StickyToolOptions;
  connector: ConnectorToolOptions;
}

/** Initial configuration of the built-in tools. */
export interface ToolsSettings {
  /** The tool enabled when the editor starts. `null` for none. Default: `'pen'`. */
  initial?: ToolName | null;

  pen?: PenToolOptions;
  highlighter?: PenToolOptions;
  eraser?: EraserToolOptions;
  shape?: ShapeToolOptions;
  text?: TextToolOptions;
  select?: SelectToolOptions;
  laser?: LaserToolOptions;
  sticky?: StickyToolOptions;
  connector?: ConnectorToolOptions;
}

export interface InputSettings {
  /**
   * Palm rejection for tablets.
   *
   * - `'auto'` (default): once a stylus (e.g. Apple Pencil) is used, fingers only
   *   pan/zoom and never draw.
   * - `true`: fingers never draw.
   * - `false`: fingers always draw.
   */
  stylusOnly?: boolean | 'auto';
}

export type BackgroundTypeName = 'none' | 'solid' | 'grid' | 'dot';

export interface BackgroundOptions {
  type?: BackgroundTypeName;
  color?: ColorInput;
}
