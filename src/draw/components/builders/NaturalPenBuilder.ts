import { type IVec2, Vec2, Rect2, type Color4, type PathCommand, PathCommandType } from '~/math';

import makeShapeFitAutocorrect from './autocorrect/makeShapeFitAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import type RenderablePathSpec from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';
import Stroke from '../Stroke';

/**
 * Options for {@link naturalPenBuilderFactory}.
 */
export interface NaturalPenOptions {
  /**
   * How strongly pressure changes the stroke width, from 0 (constant width) to 1.
   * Used when the device reports real pressure (e.g. Apple Pencil, Wacom stylus).
   */
  thinning: number;

  /**
   * Like `thinning`, but used when pressure is simulated from the drawing speed
   * (mouse, finger). Fast movements make thinner lines, slow movements thicker ones.
   */
  simulatedThinning: number;

  /** Simulate pressure from drawing speed when the device reports no pressure. */
  simulatePressure: boolean;

  /**
   * Input smoothing, from 0 (raw input) to 1 (very smooth). Higher values remove
   * more hand jitter. The stroke tip always follows the pointer, so this adds no
   * visible lag while drawing.
   */
  smoothing: number;

  /** Length of the tapered start of the stroke, as a multiple of the stroke width. 0 disables. */
  taperStart: number;

  /** Length of the tapered end of the stroke, as a multiple of the stroke width. 0 disables. */
  taperEnd: number;

  /**
   * Calligraphy: angle (radians) of a flat nib. Strokes are widest perpendicular to the
   * nib and thinnest along it. `null` for a round tip.
   */
  nibAngle?: number | null;

  /** Pencil-like unevenness of the width, from 0 (smooth) to 1. */
  roughness?: number;

  /** Opacity multiplied into the color's alpha, from 0 to 1. */
  opacity?: number;
}

export const defaultNaturalPenOptions: Readonly<NaturalPenOptions> = {
  thinning: 0.6,
  simulatedThinning: 0.4,
  simulatePressure: true,
  smoothing: 0.5,
  taperStart: 0,
  taperEnd: 0,
};

export const defaultHighlighterOptions: Readonly<NaturalPenOptions> = {
  thinning: 0,
  simulatedThinning: 0,
  simulatePressure: false,
  smoothing: 0.65,
  taperStart: 0,
  taperEnd: 0,
};

export const defaultPencilOptions: Readonly<NaturalPenOptions> = {
  ...defaultNaturalPenOptions,
  thinning: 0.75,
  simulatedThinning: 0.3,
  smoothing: 0.35,
  taperStart: 1.5,
  taperEnd: 2,
  roughness: 0.45,
  opacity: 0.85,
};

export const defaultCalligraphyOptions: Readonly<NaturalPenOptions> = {
  ...defaultNaturalPenOptions,
  thinning: 0.35,
  simulatedThinning: 0.15,
  smoothing: 0.55,
  nibAngle: -Math.PI / 4,
};

/**
 * Creates a {@link ComponentBuilderFactory} for a natural-looking ink pen with the
 * given options.
 *
 * @example
 * ```ts
 * const brush = naturalPenBuilderFactory({ thinning: 0.8, taperEnd: 4 });
 * editor.tools.pen.setStrokeFactory(brush);
 * ```
 */
export function naturalPenBuilderFactory (options: Partial<NaturalPenOptions> = {}): ComponentBuilderFactory {
  const fullOptions = { ...defaultNaturalPenOptions, ...options };
  return makeShapeFitAutocorrect((startPoint: StrokeDataPoint, viewport: Viewport) => {
    return new NaturalPenBuilder(startPoint, viewport, fullOptions);
  });
}

/**
 * A pen that looks like real ink: smoothed input, pressure (real or simulated from
 * speed) controlling the width, and round caps/joins. Strokes are stored as a single
 * filled outline, so semi-transparent colors render evenly.
 */
export const makeNaturalPenBuilder: ComponentBuilderFactory = naturalPenBuilderFactory();

/** A pencil: lighter, slightly uneven strokes with tapered ends. */
export const makePencilBuilder: ComponentBuilderFactory = naturalPenBuilderFactory(defaultPencilOptions);

/** A calligraphy pen with a flat nib: width depends on the stroke's direction. */
export const makeCalligraphyBuilder: ComponentBuilderFactory =
  naturalPenBuilderFactory(defaultCalligraphyOptions);

/** A smooth, constant-width marker suitable for highlighters. */
export const makeHighlighterBuilder: ComponentBuilderFactory =
  naturalPenBuilderFactory(defaultHighlighterOptions);

interface InkPoint {
  x: number;
  y: number;
  // Radius before tapering
  r: number;
  // Distance along the stroke from the start
  dist: number;
}

// Pressure assumed for devices that don't report it, before any movement.
const initialSimulatedPressure = 0.6;
// Screen speed (px/ms) at which simulated pressure reaches 0.
const maxSimulatedSpeed = 3;
// Time constants (ms) for pressure smoothing.
const realPressureTimeConstant = 12;
const simulatedPressureTimeConstant = 60;
// Minimum radius, relative to the nominal radius.
const minRadiusFraction = 0.15;
// Number of segments used to approximate a half circle.
const capSegments = 8;

export default class NaturalPenBuilder implements ComponentBuilder {
  private points: InkPoint[] = [];
  private lastInput: StrokeDataPoint;
  private pressure: number;
  private readonly hasRealPressure: boolean;
  private readonly baseRadius: number;
  private readonly pixelSize: number;
  private readonly color: Color4;
  private maxRadius: number;
  private readonly fillColor: Color4;
  private bbox: Rect2;

  public constructor(
    startPoint: StrokeDataPoint,
    private viewport: Viewport,
    private options: NaturalPenOptions,
  ) {
    this.hasRealPressure = startPoint.pressure !== undefined;
    this.baseRadius = Math.max((startPoint.baseWidth ?? startPoint.width) / 2, 1e-6);
    this.pixelSize = viewport.getSizeOfPixelOnCanvas();
    this.color = startPoint.color;
    const opacity = Math.min(Math.max(options.opacity ?? 1, 0), 1);
    this.fillColor = opacity < 1 ? this.color.withAlpha(this.color.a * opacity) : this.color;

    this.pressure = this.hasRealPressure
      ? startPoint.pressure!
      : initialSimulatedPressure;

    this.lastInput = startPoint;

    const r = this.radiusFor(this.pressure);
    this.maxRadius = r;
    this.points.push({ x: startPoint.pos.x, y: startPoint.pos.y, r, dist: 0 });
    this.bbox = Rect2.bboxOf([startPoint.pos], r);
  }

  private get thinning() {
    if (this.hasRealPressure) {
      return this.options.thinning;
    }
    return this.options.simulatePressure ? this.options.simulatedThinning : 0;
  }

  private radiusFor(pressure: number) {
    const factor = 1 + this.thinning * (2 * pressure - 1);
    return this.baseRadius * Math.max(minRadiusFraction, factor);
  }

  public getBBox(): Rect2 {
    return this.bbox;
  }

  public addPoint(point: StrokeDataPoint) {
    const { x, y } = point.pos;
    if (!isFinite(x) || !isFinite(y)) {
      return;
    }

    const last = this.points[this.points.length - 1];
    const dt = Math.max(point.time - this.lastInput.time, 1);

    // Update pressure
    let targetPressure: number;
    let timeConstant: number;
    if (this.hasRealPressure && point.pressure !== undefined) {
      targetPressure = point.pressure;
      timeConstant = realPressureTimeConstant;
    } else if (!this.hasRealPressure && this.options.simulatePressure) {
      const screenDist = Math.hypot(x - this.lastInput.pos.x, y - this.lastInput.pos.y) / this.pixelSize;
      const speed = screenDist / dt;
      targetPressure = 1 - Math.min(speed / maxSimulatedSpeed, 1);
      timeConstant = simulatedPressureTimeConstant;
    } else {
      targetPressure = this.pressure;
      timeConstant = 1;
    }
    this.pressure += (targetPressure - this.pressure) * (1 - Math.exp(-dt / timeConstant));
    this.lastInput = point;

    // Skip points that are too close together: they add size and jitter, not detail.
    const segmentLength = Math.hypot(x - last.x, y - last.y);
    const minDist = Math.max(this.pixelSize, this.baseRadius / 2);
    if (segmentLength < minDist) {
      return;
    }

    const r = this.radiusFor(this.pressure);
    this.points.push({
      x,
      y,
      r,
      dist: last.dist + segmentLength,
    });
    this.maxRadius = Math.max(this.maxRadius, r);
    this.bbox = this.bbox.grownToPoint(Vec2.of(x, y), this.maxRadius);
  }

  // Returns the smoothed center line of the stroke. It ends at the latest input point so
  // that the stroke follows the pointer without lag.
  private getCenterLine(predicted: StrokeDataPoint[] = []): InkPoint[] {
    const points = this.points.slice();
    const tipRadius = this.radiusFor(this.pressure);
    const minTipDist = Math.min(this.pixelSize, this.baseRadius / 4);

    for (const { pos } of [this.lastInput, ...predicted]) {
      const last = points[points.length - 1];
      const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
      if (dist > minTipDist && isFinite(dist)) {
        points.push({ x: pos.x, y: pos.y, r: tipRadius, dist: last.dist + dist });
      }
    }

    const smoothing = Math.min(Math.max(this.options.smoothing, 0), 1);
    // Only jitter-sized segments are smoothed. Long segments (fast strokes, generated
    // shapes like autocorrected rectangles) are kept exactly.
    const maxSmoothedSegment = Math.max(this.baseRadius * 8, this.pixelSize * 24);
    return smoothCenterLine(points, Math.round(smoothing * 6), maxSmoothedSegment);
  }

  private applyTapers(points: InkPoint[], taperEnd: boolean): number[] {
    const totalLength = points[points.length - 1].dist;
    const diameter = this.baseRadius * 2;

    // Never taper away more than half of the stroke.
    const startLength = Math.min(this.options.taperStart * diameter, totalLength / 2);
    const endLength = taperEnd ? Math.min(this.options.taperEnd * diameter, totalLength / 2) : 0;
    const easeOut = (t: number) => t * (2 - t);

    return points.map((point) => {
      let scale = 1;
      if (startLength > 0) {
        scale = Math.min(scale, easeOut(Math.min(point.dist / startLength, 1)));
      }
      if (endLength > 0) {
        scale = Math.min(scale, easeOut(Math.min((totalLength - point.dist) / endLength, 1)));
      }
      return point.r * Math.max(scale, minRadiusFraction / 2);
    });
  }

  // Calligraphy and pencil effects: adjust each point's radius in place.
  private applyNibAndRoughness(
    points: InkPoint[],
    radii: number[],
    segmentDirs: Array<[number, number]>,
  ) {
    const { nibAngle, roughness } = this.options;
    const hasNib = nibAngle !== null && nibAngle !== undefined;
    if (!hasNib && !roughness) return;

    for (const [i, point] of points.entries()) {
      if (hasNib) {
        const dirIn = segmentDirs[Math.max(i - 1, 0)];
        const dirOut = segmentDirs[Math.min(i, segmentDirs.length - 1)];
        const angle = Math.atan2(dirIn[1] + dirOut[1], dirIn[0] + dirOut[0]);
        // Widest when moving perpendicular to the nib
        const across = Math.abs(Math.sin(angle - nibAngle));
        radii[i] *= 0.25 + 1.15 * across;
      }

      if (roughness) {
        // Noise along the stroke's length, so it doesn't change while drawing.
        const noise = valueNoise(point.dist / Math.max(this.baseRadius * 1.5, this.pixelSize * 2));
        radii[i] *= 1 + roughness * 0.9 * (noise - 0.5);
      }
    }
  }

  private computeOutline(isFinal: boolean, predicted?: StrokeDataPoint[]): IVec2[] {
    const points = simplifyCenterLine(this.getCenterLine(predicted), this.pixelSize * 0.25);
    const radii = this.applyTapers(points, isFinal);
    const count = points.length;

    const strokeLength = points[count - 1].dist;
    if (count === 1 || strokeLength < radii[0] / 2) {
      const center = points[0];
      return arcPoints(center.x, center.y, Math.max(...radii), 0, Math.PI * 2, capSegments * 2);
    }

    // Unit direction of each segment
    const segmentDirs: Array<[number, number]> = [];
    for (let i = 0; i < count - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy) || 1;
      segmentDirs.push([dx / len, dy / len]);
    }

    this.applyNibAndRoughness(points, radii, segmentDirs);

    const left: IVec2[] = [];
    const right: IVec2[] = [];

    for (let i = 0; i < count; i++) {
      const { x, y } = points[i];
      const r = radii[i];
      const dirIn = segmentDirs[Math.max(i - 1, 0)];
      const dirOut = segmentDirs[Math.min(i, count - 2)];
      const cosTurn = dirIn[0] * dirOut[0] + dirIn[1] * dirOut[1];

      if (cosTurn < -0.3) {
        // Sharp corner: a round join on the outer side, a pinch through the
        // center on the inner side.
        const angleIn = Math.atan2(dirIn[0], -dirIn[1]); // angle of the left normal
        const angleOut = Math.atan2(dirOut[0], -dirOut[1]);
        const travelAngle = Math.atan2(dirIn[1], dirIn[0]);
        const center = Vec2.of(x, y);
        const turnsLeft = -dirIn[1] * dirOut[0] + dirIn[0] * dirOut[1] > 0;

        const leftArc = arcThrough(x, y, r, angleIn, angleOut, travelAngle);
        const rightArc = arcThrough(x, y, r, angleIn + Math.PI, angleOut + Math.PI, travelAngle);
        if (turnsLeft) {
          left.push(leftArc[0], center, leftArc[leftArc.length - 1]);
          right.push(...rightArc);
        } else {
          left.push(...leftArc);
          right.push(rightArc[0], center, rightArc[rightArc.length - 1]);
        }
        continue;
      }

      let nx = -(dirIn[1] + dirOut[1]);
      let ny = dirIn[0] + dirOut[0];
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) {
        nx = -dirIn[1];
        ny = dirIn[0];
      } else {
        nx /= len;
        ny /= len;
      }

      // Keep the width constant around bends (limited miter).
      const halfAngleCos = Math.max(nx * -dirIn[1] + ny * dirIn[0], 0.5);
      const offset = r / halfAngleCos;

      left.push(Vec2.of(x + nx * offset, y + ny * offset));
      right.push(Vec2.of(x - nx * offset, y - ny * offset));
    }

    const first = points[0];
    const last = points[count - 1];
    const startDir = segmentDirs[0];
    const endDir = segmentDirs[count - 2];
    const startNormalAngle = Math.atan2(startDir[0], -startDir[1]);
    const endNormalAngle = Math.atan2(endDir[0], -endDir[1]);

    // Left side → end cap → right side (reversed) → start cap
    const endCap = arcPoints(
      last.x, last.y, radii[count - 1],
      endNormalAngle, -Math.PI, capSegments,
    );
    const startCap = arcPoints(
      first.x, first.y, radii[0],
      startNormalAngle + Math.PI, -Math.PI, capSegments,
    );

    return [
      ...left,
      ...endCap.slice(1, -1),
      ...right.reverse(),
      ...startCap.slice(1, -1),
    ];
  }

  private roundPoint(point: IVec2) {
    return Viewport.roundPoint(point, Math.min(this.pixelSize, this.baseRadius) / 4);
  }

  private outlineToPath(sparseOutline: IVec2[]): RenderablePathSpec {
    // The outline is drawn as a smooth curve through the midpoints of its edges. Long
    // edges (straight lines, rectangles) would turn their corners into large arcs: add
    // points close to both ends of each long edge so corners stay tight.
    const cornerRadius = Math.max(this.baseRadius, this.pixelSize);
    const longEdge = Math.max(this.baseRadius * 12, this.pixelSize * 30);
    const outline: IVec2[] = [];
    for (let i = 0; i < sparseOutline.length; i++) {
      const current = sparseOutline[i];
      const next = sparseOutline[(i + 1) % sparseOutline.length];
      const length = current.distanceTo(next);
      outline.push(current);
      if (length > longEdge) {
        outline.push(current.lerp(next, cornerRadius / length));
        outline.push(next.lerp(current, cornerRadius / length));
      }
    }

    const count = outline.length;
    const midpoint = (i: number) => outline[i % count].lerp(outline[(i + 1) % count], 0.5);

    // Smooth closed curve through the midpoints of the outline, using outline
    // points as control points.
    const commands: PathCommand[] = [];
    for (let i = 1; i <= count; i++) {
      commands.push({
        kind: PathCommandType.QuadraticBezierTo,
        controlPoint: this.roundPoint(outline[i % count]),
        endPoint: this.roundPoint(midpoint(i)),
      });
    }

    return {
      startPoint: this.roundPoint(midpoint(0)),
      commands,
      style: { fill: this.fillColor },
    };
  }

  private toRenderable(isFinal: boolean, predicted?: StrokeDataPoint[]) {
    return this.outlineToPath(this.computeOutline(isFinal, predicted));
  }

  public preview(renderer: AbstractRenderer, predictedPoints?: StrokeDataPoint[]) {
    renderer.startObject(this.viewport.visibleRect);
    renderer.drawPath(this.toRenderable(false, predictedPoints));
    renderer.endObject();
  }

  public build(): Stroke {
    return new Stroke([this.toRenderable(true)]);
  }
}

// Points on the arc of a circle starting at `startAngle` and sweeping by `sweep` radians.
// Angles follow the canvas convention (y axis pointing down).
function arcPoints(
  cx: number, cy: number, r: number,
  startAngle: number, sweep: number, segments: number,
): IVec2[] {
  const result: IVec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (sweep * i) / segments;
    result.push(Vec2.of(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
  }
  return result;
}

// Arc from `fromAngle` to `toAngle` that passes the side facing `throughAngle`.
function arcThrough(
  cx: number, cy: number, r: number,
  fromAngle: number, toAngle: number, throughAngle: number,
): IVec2[] {
  const tau = Math.PI * 2;
  let ccwSweep = (((toAngle - fromAngle) % tau) + tau) % tau;
  if (ccwSweep === 0) ccwSweep = tau;
  const cwSweep = ccwSweep - tau;

  const midAngleCcw = fromAngle + ccwSweep / 2;
  const sweep = Math.cos(midAngleCcw - throughAngle) >= 0 ? ccwSweep : cwSweep;
  const segments = Math.max(2, Math.ceil((Math.abs(sweep) / Math.PI) * capSegments));
  return arcPoints(cx, cy, r, fromAngle, sweep, segments);
}

// Smooth 1D value noise in [0, 1].
function valueNoise(x: number): number {
  const hash = (n: number) => {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const i = Math.floor(x);
  const t = x - i;
  const smoothT = t * t * (3 - 2 * t);
  return hash(i) * (1 - smoothT) + hash(i + 1) * smoothT;
}

// Symmetric (lag-free) Laplacian smoothing. The end points and sharp corners don't move,
// so corners stay crisp.
function smoothCenterLine(points: InkPoint[], iterations: number, maxSegmentLength: number): InkPoint[] {
  const count = points.length;
  if (count < 3 || iterations <= 0) {
    return points;
  }

  const isCorner = new Uint8Array(count);
  for (let i = 1; i < count - 1; i++) {
    const ax = points[i].x - points[i - 1].x;
    const ay = points[i].y - points[i - 1].y;
    const bx = points[i + 1].x - points[i].x;
    const by = points[i + 1].y - points[i].y;
    const lengthA = Math.hypot(ax, ay);
    const lengthB = Math.hypot(bx, by);
    const cosTurn = (ax * bx + ay * by) / (lengthA * lengthB || 1);
    const isLongSegment = lengthA > maxSegmentLength || lengthB > maxSegmentLength;
    isCorner[i] = cosTurn < -0.2 || isLongSegment ? 1 : 0;
  }

  let xs = points.map((p) => p.x);
  let ys = points.map((p) => p.y);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const newXs = xs.slice();
    const newYs = ys.slice();
    for (let i = 1; i < count - 1; i++) {
      if (isCorner[i]) continue;
      newXs[i] = xs[i] * 0.5 + (xs[i - 1] + xs[i + 1]) * 0.25;
      newYs[i] = ys[i] * 0.5 + (ys[i - 1] + ys[i + 1]) * 0.25;
    }
    xs = newXs;
    ys = newYs;
  }

  return points.map((point, i) => ({ ...point, x: xs[i], y: ys[i] }));
}

// Ramer–Douglas–Peucker simplification of the center line that also preserves
// width changes.
function simplifyCenterLine(points: InkPoint[], tolerance: number): InkPoint[] {
  if (points.length < 3) {
    return points;
  }

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    const a = points[start];
    const b = points[end];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let maxError = 0;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
      t = Math.min(Math.max(t, 0), 1);
      const posError = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
      const radiusError = Math.abs(a.r + (b.r - a.r) * t - p.r);
      const error = Math.max(posError, radiusError);

      if (error > maxError) {
        maxError = error;
        maxIndex = i;
      }
    }

    if (maxIndex !== -1 && maxError > tolerance) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
