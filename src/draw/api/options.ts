import { Color4 } from '~/math';

import {
  type PenStyleName,
  type ShapeTypeName,
} from '../components/builders/presets';
import { type ComponentBuilderFactory } from '../components/builders/types';

/** A color: a {@link Color4} or any CSS color string (`'#ff0000'`, `'rgba(0,0,0,0.3)'`, `'red'`…). */
export type ColorInput = Color4 | string;

export function toColor4 (color: ColorInput): Color4 {
  return typeof color === 'string' ? Color4.fromString(color) : color;
}

/** Names of the built-in tools. */
export type ToolName = 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'laser';

export const toolNames: readonly ToolName[] = [
  'select',
  'text',
  'pen',
  'highlighter',
  'eraser',
  'shape',
  'laser',
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

/** Maps each tool name to its options type. */
export interface ToolOptionsMap {
  select: SelectToolOptions;
  laser: LaserToolOptions;
  text: TextToolOptions;
  pen: PenToolOptions;
  highlighter: PenToolOptions;
  eraser: EraserToolOptions;
  shape: ShapeToolOptions;
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
