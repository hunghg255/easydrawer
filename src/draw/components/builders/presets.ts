import { makeArrowBuilder } from './ArrowBuilder';
import { makeCircleBuilder } from './CircleBuilder';
import { makeCloudBuilder } from './CloudBuilder';
import { makeFilledDiamondBuilder } from './DiamondBuilder';
import { makeFreehandLineBuilder } from './FreehandLineBuilder';
import { makeHeartBuilder } from './HeartBuilder';
import { makeFilledHexagonalBuilder } from './HexagonalBuilder';
import { makeLineBuilder } from './LineBuilder';
import {
  makeCalligraphyBuilder,
  makeHighlighterBuilder,
  makeNaturalPenBuilder,
  makePencilBuilder,
} from './NaturalPenBuilder';
import { makeParallelogramBuilder } from './ParallelogramBuilder';
import { makePolylineBuilder } from './PolylineBuilder';
import { makePressureSensitiveFreehandLineBuilder } from './PressureSensitiveFreehandLineBuilder';
import { makeFilledRectangleBuilder } from './RectangleBuilder';
import { makeFilledSquareBuilder } from './SquareBuilder';
import { makeStarBuilder } from './StarBuilder';
import { makeFilledTriangleBuilder } from './TriangleBuilder';
import { type ComponentBuilderFactory } from './types';

/** Built-in stroke styles for pen tools, by name. */
export const penStyles = {
  /** Natural ink with pressure (real or simulated from speed). The default. */
  natural: makeNaturalPenBuilder,
  /** Smooth, constant-width marker. The default for the highlighter. */
  marker: makeHighlighterBuilder,
  /** Pencil: graphite grain, slightly uneven strokes with tapered ends. */
  pencil: makePencilBuilder,
  /** Calligraphy pen with a flat nib: width depends on the direction of the stroke. */
  calligraphy: makeCalligraphyBuilder,
  /** Flat-tip pen with pressure. */
  'flat-tip': makePressureSensitiveFreehandLineBuilder,
  /** Round-tip pen with constant width. */
  'round-tip': makeFreehandLineBuilder,
  /** Straight segments between input points. */
  polyline: makePolylineBuilder,
} satisfies Record<string, ComponentBuilderFactory>;

export type PenStyleName = keyof typeof penStyles;

/** Built-in shapes for the shape tool, by name. */
export const shapeTypes = {
  square: makeFilledSquareBuilder,
  rectangle: makeFilledRectangleBuilder,
  circle: makeCircleBuilder,
  triangle: makeFilledTriangleBuilder,
  hexagon: makeFilledHexagonalBuilder,
  diamond: makeFilledDiamondBuilder,
  arrow: makeArrowBuilder,
  line: makeLineBuilder,
  heart: makeHeartBuilder,
  star: makeStarBuilder,
  cloud: makeCloudBuilder,
  parallelogram: makeParallelogramBuilder,
} satisfies Record<string, ComponentBuilderFactory>;

export type ShapeTypeName = keyof typeof shapeTypes;

/** Returns the name of a built-in factory, or `null` for custom factories. */
export function nameOfFactory <Name extends string>(table: Record<Name, ComponentBuilderFactory>,
  factory: ComponentBuilderFactory): Name | null {
  for (const name in table) {
    if (table[name] === factory) {
      return name;
    }
  }
  return null;
}
