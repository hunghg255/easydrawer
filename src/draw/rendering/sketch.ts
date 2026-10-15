import { RoughGenerator } from 'roughjs/bin/generator';

import { Color4, Mat33, Path } from '~/math';

import { pathFromRenderable, pathToRenderable, type RenderablePathSpecWithPath } from './RenderablePathSpec';
import type RenderablePathSpec from './RenderablePathSpec';
import type RenderingStyle from './RenderingStyle';

/** How filled shapes are filled in the hand-drawn style. */
export type SketchFillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag' | 'dots';

export interface SketchOptions {
  /** How sloppy the lines are: `0` (straight) to `3` (very sloppy). Default: `1.3`. */
  roughness?: number;
  /** How lines bend. Default: `1.5`. */
  bowing?: number;
  /** Fill style for filled paths. Default: `'hachure'` (diagonal lines). */
  fillStyle?: SketchFillStyle;
  /**
   * The size of a screen pixel on the canvas when drawing (e.g.
   * `viewport.getSizeOfPixelOnCanvas()`), so that shapes look as sloppy at any zoom. Default: `1`.
   */
  scale?: number;
  /** Seed for the randomness: the same seed gives the same lines. Default: random. */
  seed?: number;
}

let generator: RoughGenerator | null = null;

/** A seed for {@link sketchPath} from a string (e.g. a component ID), so it looks the same each time. */
export function sketchSeedOf (text: string) {
  let hash = 0;
  for (const char of text) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) % 2_147_483_647;
  return (Math.abs(hash) % 2_000_000_000) + 1;
}

/**
 * Turns a path into a hand-drawn version of it (like [Excalidraw](https://excalidraw.com),
 * using [Rough.js](https://roughjs.com)): double, slightly wobbly outlines, and fills made of
 * diagonal lines.
 *
 * @returns the parts to draw (e.g. to give to a {@link Stroke}).
 */
export function sketchPath (path: Path, style: RenderingStyle, options: SketchOptions = {}): RenderablePathSpecWithPath[] {
  generator ??= new RoughGenerator();

  // Work in screen pixels, so that the randomness looks the same at any zoom.
  const scale = options.scale ?? 1;
  const toScreen = Mat33.scaling2D(1 / scale);
  const toCanvas = Mat33.scaling2D(scale);
  const screenPath = path.transformedBy(toScreen);

  const strokeWidth = style.stroke && style.stroke.width > 0 && style.stroke.color.a > 0 ? style.stroke.width / scale : 0;
  const hasFill = style.fill.a > 0;
  // A path with a fill but no outline (e.g. a filled shape without border): outline it with
  // the fill color, thinner.
  const fillLineWidth = Math.max(1, (strokeWidth || 2) / 2);

  const drawable = generator.path(screenPath.toString(), {
    roughness: options.roughness ?? 1.3,
    bowing: options.bowing ?? 1.5,
    seed: options.seed ?? RoughGenerator.newSeed(),
    stroke: strokeWidth > 0 ? 'stroke' : 'none',
    strokeWidth: strokeWidth || 1,
    fill: hasFill ? 'fill' : undefined,
    fillStyle: options.fillStyle ?? 'hachure',
    fillWeight: fillLineWidth,
    hachureGap: Math.max(4, (strokeWidth || 2) * 4),
    preserveVertices: false,
  });

  const result: RenderablePathSpecWithPath[] = [];
  for (const set of drawable.sets) {
    const d = generator.opsToPath(set);
    if (!d.trim()) continue;
    const part = Path.fromString(d).transformedBy(toCanvas);
    if (set.type === 'path' && strokeWidth > 0) {
      result.push(pathToRenderable(part, { fill: Color4.transparent, stroke: { color: style.stroke!.color, width: strokeWidth * scale } }));
    } else if (set.type === 'fillPath') {
      // Solid fills, and the background of hachure fills when the fill is light.
      result.push(pathToRenderable(part, { fill: style.fill }));
    } else if (set.type === 'fillSketch') {
      result.push(pathToRenderable(part, { fill: Color4.transparent, stroke: { color: style.fill, width: fillLineWidth * scale } }));
    }
  }
  return result;
}

/**
 * The hand-drawn version of the parts of a {@link Stroke} (see {@link sketchPath}). Thin
 * freehand strokes are left as they are.
 */
export function sketchParts (parts: RenderablePathSpec[], options: SketchOptions = {}): RenderablePathSpec[] {
  return parts.flatMap((part, i) => {
    const path = pathFromRenderable(part);
    const seed = options.seed === undefined ? undefined : options.seed + i;
    return sketchPath(path, part.style, { ...options, seed });
  });
}
