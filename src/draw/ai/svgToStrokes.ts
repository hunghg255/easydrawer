import { Color4, type IVec2, Mat33, Path, type PathCommand, PathCommandType, Vec2 } from '~/math';

import Stroke from '../components/Stroke';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type RenderingStyle from '../rendering/RenderingStyle';

/**
 * Converts SVG path data (`d`) to a {@link Path}, applying `transform`. Supports every
 * command: M L H V C S Q T A Z, absolute and relative (arcs become Bézier curves).
 *
 * @returns `null` if the data is empty or invalid.
 */
export function parsePathData (d: string, transform: Mat33 = Mat33.identity): Path | null {
  const tokens = d.match(/[a-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi);
  if (!tokens) return null;

  const commands: PathCommand[] = [];
  let start: IVec2 | null = null;
  let current = Vec2.zero;
  let subpathStart = Vec2.zero;
  let lastControl: IVec2 | null = null;
  let lastCommand = '';

  const t = (p: IVec2) => transform.transformVec2(p);
  const lineTo = (p: IVec2) => commands.push({ kind: PathCommandType.LineTo, point: t(p) });
  const moveTo = (p: IVec2) => {
    if (start === null) {
      start = t(p);
    } else {
      commands.push({ kind: PathCommandType.MoveTo, point: t(p) });
    }
  };
  const cubicTo = (c1: IVec2, c2: IVec2, p: IVec2) =>
    commands.push({ kind: PathCommandType.CubicBezierTo, controlPoint1: t(c1), controlPoint2: t(c2), endPoint: t(p) });
  const quadTo = (c: IVec2, p: IVec2) =>
    commands.push({ kind: PathCommandType.QuadraticBezierTo, controlPoint: t(c), endPoint: t(p) });

  let i = 0;
  let command = '';
  const isCommand = (token: string) => /^[a-z]$/i.test(token);
  const next = () => {
    const value = Number(tokens[i++]);
    if (!isFinite(value)) throw new Error('Invalid number in path data');
    return value;
  };

  try {
    while (i < tokens.length) {
      if (isCommand(tokens[i])) {
        command = tokens[i++];
      } else if (!command) {
        return null;
      }

      const relative = command === command.toLowerCase();
      const base = relative ? current : Vec2.zero;
      const point = () => {
        const x = next();
        const y = next();
        return Vec2.of(x, y).plus(base);
      };

      switch (command.toUpperCase()) {
        case 'M': {
          const p = point();
          moveTo(p);
          current = p;
          subpathStart = p;
          // Following pairs are line-tos.
          command = relative ? 'l' : 'L';
          break;
        }
        case 'L': {
          const p = point();
          lineTo(p);
          current = p;
          break;
        }
        case 'H': {
          const x = next() + (relative ? current.x : 0);
          current = Vec2.of(x, current.y);
          lineTo(current);
          break;
        }
        case 'V': {
          const y = next() + (relative ? current.y : 0);
          current = Vec2.of(current.x, y);
          lineTo(current);
          break;
        }
        case 'C': {
          const c1 = point();
          const c2 = point();
          const p = point();
          cubicTo(c1, c2, p);
          lastControl = c2;
          current = p;
          break;
        }
        case 'S': {
          const c1 = lastControl && /[cs]/i.test(lastCommand) ? current.times(2).minus(lastControl) : current;
          const c2 = point();
          const p = point();
          cubicTo(c1, c2, p);
          lastControl = c2;
          current = p;
          break;
        }
        case 'Q': {
          const c = point();
          const p = point();
          quadTo(c, p);
          lastControl = c;
          current = p;
          break;
        }
        case 'T': {
          const c: IVec2 = lastControl && /[qt]/i.test(lastCommand) ? current.times(2).minus(lastControl) : current;
          const p = point();
          quadTo(c, p);
          lastControl = c;
          current = p;
          break;
        }
        case 'A': {
          const rx = next();
          const ry = next();
          const rotation = next();
          const largeArc = next() !== 0;
          const sweep = next() !== 0;
          const p = point();
          for (const [c1, c2, end] of arcToCubics(current, p, rx, ry, rotation, largeArc, sweep)) {
            cubicTo(c1, c2, end);
          }
          current = p;
          break;
        }
        case 'Z':
          lineTo(subpathStart);
          current = subpathStart;
          break;
        default:
          return null;
      }

      if (!/[cqst]/i.test(command)) lastControl = null;
      lastCommand = command;
    }
  } catch {
    return null;
  }

  if (start === null) return null;
  return new Path(start, commands);
}

/** Converts an SVG elliptical arc to cubic Bézier curves (SVG spec, appendix F.6). */
function arcToCubics (
  from: IVec2,
  to: IVec2,
  rx: number,
  ry: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
): Array<[IVec2, IVec2, IVec2]> {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0 || Vec2.ofXY(from).eq(to)) {
    return [[from, to, to]];
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;

  // Scale up the radii if needed.
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  const sign = largeArc === sweep ? -1 : 1;
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coefficient = sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cx1 = (coefficient * rx * y1) / ry;
  const cy1 = (-coefficient * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  const pointAt = (a: number) => {
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    return Vec2.of(cos * x - sin * y + cx, sin * x + cos * y + cy);
  };
  const derivativeAt = (a: number) => {
    const x = -rx * Math.sin(a);
    const y = ry * Math.cos(a);
    return Vec2.of(cos * x - sin * y, sin * x + cos * y);
  };

  const result: Array<[IVec2, IVec2, IVec2]> = [];
  for (let s = 0; s < segments; s++) {
    const a1 = theta1 + s * step;
    const a2 = a1 + step;
    const p1 = pointAt(a1);
    const p2 = s === segments - 1 ? Vec2.ofXY(to) : pointAt(a2);
    result.push([p1.plus(derivativeAt(a1).times(k)), p2.minus(derivativeAt(a2).times(k)), p2]);
  }
  return result;
}

/** Parses an SVG `transform` attribute. */
export function parseTransform (value: string | null): Mat33 {
  let result = Mat33.identity;
  if (!value) return result;

  for (const match of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const args = (match[2].match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    let m = Mat33.identity;
    switch (match[1]) {
      case 'matrix':
        if (args.length === 6) {
          m = new Mat33(args[0], args[2], args[4], args[1], args[3], args[5], 0, 0, 1);
        }
        break;
      case 'translate':
        m = Mat33.translation(Vec2.of(args[0] ?? 0, args[1] ?? 0));
        break;
      case 'scale':
        m = Mat33.scaling2D(Vec2.of(args[0] ?? 1, args[1] ?? args[0] ?? 1));
        break;
      case 'rotate':
        m = Mat33.zRotation(((args[0] ?? 0) * Math.PI) / 180, Vec2.of(args[1] ?? 0, args[2] ?? 0));
        break;
      case 'skewX':
        m = new Mat33(1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 0, 1, 0, 0, 0, 1);
        break;
      case 'skewY':
        m = new Mat33(1, 0, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0, 0, 1);
        break;
    }
    result = result.rightMul(m);
  }
  return result;
}

function number (element: Element, name: string, fallback = 0) {
  const value = Number.parseFloat(element.getAttribute(name) ?? '');
  return isFinite(value) ? value : fallback;
}

/** Path data for basic SVG shapes (rect, circle, ellipse, line, polyline, polygon). */
export function shapeToPathData (element: Element): string | null {
  switch (element.tagName.toLowerCase()) {
    case 'path':
      return element.getAttribute('d');
    case 'rect': {
      const x = number(element, 'x');
      const y = number(element, 'y');
      const w = number(element, 'width');
      const h = number(element, 'height');
      if (w <= 0 || h <= 0) return null;
      let rx = number(element, 'rx', Number.NaN);
      let ry = number(element, 'ry', Number.NaN);
      if (isNaN(rx)) rx = isNaN(ry) ? 0 : ry;
      if (isNaN(ry)) ry = rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (rx <= 0 || ry <= 0) {
        return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
      }
      return (
        `M${x + rx},${y} H${x + w - rx} A${rx},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} ` +
        `A${rx},${ry} 0 0 1 ${x + w - rx},${y + h} H${x + rx} A${rx},${ry} 0 0 1 ${x},${y + h - ry} ` +
        `V${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} Z`
      );
    }
    case 'circle':
    case 'ellipse': {
      const cx = number(element, 'cx');
      const cy = number(element, 'cy');
      const rx = element.tagName.toLowerCase() === 'circle' ? number(element, 'r') : number(element, 'rx');
      const ry = element.tagName.toLowerCase() === 'circle' ? rx : number(element, 'ry');
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx},${cy} A${rx},${ry} 0 1 0 ${cx + rx},${cy} A${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`;
    }
    case 'line':
      return `M${number(element, 'x1')},${number(element, 'y1')} L${number(element, 'x2')},${number(element, 'y2')}`;
    case 'polyline':
    case 'polygon': {
      const points = (element.getAttribute('points') ?? '').trim();
      if (!points) return null;
      return `M${points}${element.tagName.toLowerCase() === 'polygon' ? ' Z' : ''}`;
    }
    default:
      return null;
  }
}

interface PaintStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
}

const paintProperties = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity'];

/** The paint style of `element`, inheriting from `parent`. */
function styleOf (element: Element, parent: PaintStyle): PaintStyle {
  const values: Record<string, string> = {};
  for (const name of paintProperties) {
    const attribute = element.getAttribute(name);
    if (attribute) values[name] = attribute.trim();
  }
  // style="fill: red; stroke: blue"
  for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
    const [name, value] = declaration.split(':').map((s) => s?.trim());
    if (name && value && paintProperties.includes(name)) values[name] = value;
  }

  const num = (value: string | undefined, fallback: number) => {
    const n = Number.parseFloat(value ?? '');
    return isFinite(n) ? n : fallback;
  };
  return {
    fill: values.fill ?? parent.fill,
    stroke: values.stroke ?? parent.stroke,
    strokeWidth: num(values['stroke-width'], parent.strokeWidth),
    // `opacity` doesn't inherit in SVG, but multiplies down the tree.
    opacity: parent.opacity * num(values.opacity, 1),
    fillOpacity: num(values['fill-opacity'], parent.fillOpacity),
    strokeOpacity: num(values['stroke-opacity'], parent.strokeOpacity),
  };
}

function toColor (value: string, opacity: number): Color4 | null {
  if (!value || value === 'none' || value === 'transparent' || value.startsWith('url(')) return null;
  try {
    const color = value === 'currentColor' ? Color4.black : Color4.fromString(value);
    return color.withAlpha(color.a * opacity);
  } catch {
    return null;
  }
}

/**
 * Converts an SVG image (e.g. written by an AI) to editable strokes. Supports paths and basic
 * shapes, groups, transforms and fill/stroke styles. Text, images, gradients and scripts are
 * ignored.
 *
 * @param parse - parses the SVG markup (e.g. with `DOMParser`).
 */
export default function svgToStrokes (
  svg: string,
  parse: (svg: string) => Document = (text) => new DOMParser().parseFromString(text, 'image/svg+xml'),
): Stroke[] {
  const root = parse(svg).documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return [];

  const strokes: Stroke[] = [];
  const visit = (element: Element, transform: Mat33, inherited: PaintStyle) => {
    const tag = element.tagName.toLowerCase();
    if (['defs', 'style', 'script', 'text', 'image', 'foreignobject', 'clippath', 'mask', 'pattern', 'symbol'].includes(tag)) {
      return;
    }

    const elementTransform = transform.rightMul(parseTransform(element.getAttribute('transform')));
    const style = styleOf(element, inherited);

    const pathData = shapeToPathData(element);
    if (pathData) {
      const path = parsePathData(pathData, elementTransform);
      const fill = tag === 'line' || tag === 'polyline' ? null : toColor(style.fill, style.fillOpacity * style.opacity);
      const strokeColor = toColor(style.stroke, style.strokeOpacity * style.opacity);
      if (path && (fill || strokeColor)) {
        const scale = Math.sqrt(Math.abs(elementTransform.a1 * elementTransform.b2 - elementTransform.a2 * elementTransform.b1));
        const renderingStyle: RenderingStyle = {
          fill: fill ?? Color4.transparent,
          ...(strokeColor && style.strokeWidth > 0
            ? { stroke: { color: strokeColor, width: style.strokeWidth * scale } }
            : {}),
        };
        strokes.push(new Stroke([pathToRenderable(path, renderingStyle)]));
      }
    }

    for (const child of Array.from(element.children)) {
      visit(child, elementTransform, style);
    }
  };

  // The viewBox origin
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const origin = viewBox.length === 4 && viewBox.every(isFinite) ? Mat33.translation(Vec2.of(-viewBox[0], -viewBox[1])) : Mat33.identity;

  visit(root, origin, {
    fill: 'black',
    stroke: 'none',
    strokeWidth: 1,
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
  });
  return strokes;
}
