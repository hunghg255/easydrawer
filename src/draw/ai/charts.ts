import { Color4, type IVec2, Mat33, Path, Vec2 } from '~/math';

import { parsePathData } from './svgToStrokes';
import { AIError } from './types';
import type AbstractComponent from '../components/AbstractComponent';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSeries {
  name: string;
  values: number[];
}

/** Data for {@link buildChart} (and `editor.ai.drawChart`). */
export interface Chart {
  type: ChartType;
  title: string;
  /** Category names (x axis, or pie slices). */
  labels: string[];
  /** One or more series of values, one value per label. Pie charts use the first series. */
  series: ChartSeries[];
  /** Unit shown after values, e.g. `'%'` or `'k$'`. */
  unit?: string;
}

/** Colors of the series (or pie slices). */
export const chartColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/** Checks and cleans up chart data returned by an AI. @internal */
export function validateChart (json: any): Chart {
  const labels: string[] = (Array.isArray(json?.labels) ? json.labels : [])
    .slice(0, 24)
    .map((l: unknown) => String(l ?? '').slice(0, 30));
  const series: ChartSeries[] = (Array.isArray(json?.series) ? json.series : [])
    .slice(0, 6)
    .map((s: any, i: number) => ({
      name: String(s?.name ?? `Series ${i + 1}`).slice(0, 30),
      values: labels.map((_, j) => {
        const value = Number(Array.isArray(s?.values) ? s.values[j] : Number.NaN);
        return isFinite(value) ? value : 0;
      }),
    }));

  if (labels.length === 0 || series.length === 0) {
    throw new AIError('The AI did not return chart data.');
  }
  const type = ['bar', 'line', 'pie'].includes(json?.type) ? json.type : 'bar';
  return {
    type,
    title: String(json?.title ?? '').slice(0, 80),
    labels,
    series,
    unit: typeof json?.unit === 'string' ? json.unit.slice(0, 8) : undefined,
  };
}

/** A "nice" number at least `value` (1, 2, 2.5, 5 × 10ⁿ). */
function niceCeil (value: number) {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

function formatNumber (value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return String(Math.round(value * 100) / 100);
}

/**
 * Builds the components of a chart (bars or lines with axes and labels, or a pie with a
 * legend), with its top-left corner at `origin`. `scale` is the size of a screen pixel on the
 * canvas, so the chart has the same size on screen at any zoom.
 *
 * @returns the components, and the size of the chart.
 */
export default function buildChart (chart: Chart, origin: IVec2, scale: number): { components: AbstractComponent[]; size: IVec2 } {
  const components: AbstractComponent[] = [];
  const dark = Color4.fromHex('#1f2937');
  const muted = Color4.fromHex('#6b7280');
  const grid = Color4.fromHex('#e5e7eb');

  const text = (value: string, x: number, baseline: number, size: number, options: { color?: Color4; align?: 'left' | 'center' | 'right'; bold?: boolean } = {}) => {
    if (!value) return;
    const style: TextRenderingStyle = {
      size: size * scale,
      fontFamily: 'sans-serif',
      ...(options.bold ? { fontWeight: 'bold' } : {}),
      renderingStyle: { fill: options.color ?? dark },
    };
    const width = TextComponent.measureTextWidth(value, style);
    const left = options.align === 'center' ? x - width / 2 : options.align === 'right' ? x - width : x;
    components.push(TextComponent.fromLines([value], Mat33.translation(Vec2.of(left, baseline)), style));
  };
  const fillPath = (path: Path | null, color: Color4) => {
    if (path) components.push(new Stroke([pathToRenderable(path, { fill: color })]));
  };
  const linePath = (path: Path | null, color: Color4, width: number) => {
    if (path) components.push(new Stroke([pathToRenderable(path, { fill: Color4.transparent, stroke: { color, width: width * scale } })]));
  };
  const rect = (x: number, y: number, w: number, h: number) =>
    Path.fromString(`M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`);
  const circle = (c: IVec2, r: number) =>
    parsePathData(`M${c.x - r},${c.y} A${r},${r} 0 1 0 ${c.x + r},${c.y} A${r},${r} 0 1 0 ${c.x - r},${c.y} Z`);

  const s = (n: number) => n * scale;
  const o = Vec2.ofXY(origin);
  const unit = chart.unit ?? '';
  const color = (i: number) => Color4.fromHex(chartColors[i % chartColors.length]);
  const showLegend = chart.type === 'pie' || chart.series.length > 1;

  text(chart.title, o.x, o.y + s(20), 18, { bold: true });
  const top = o.y + s(44);

  // Legend (on the right)
  const legend = (entries: Array<{ label: string; color: Color4 }>, x: number) => {
    for (const [i, entry] of entries.entries()) {
      const y = top + s(8) + i * s(24);
      fillPath(rect(x, y, s(14), s(14)), entry.color);
      text(entry.label, x + s(22), y + s(12), 13);
    }
  };

  if (chart.type === 'pie') {
    const values = chart.series[0].values.map((v) => Math.max(0, v));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const radius = s(130);
    const center = Vec2.of(o.x + radius + s(10), top + radius + s(10));
    let angle = -Math.PI / 2;
    for (const [i, value] of values.entries()) {
      const sweep = (value / total) * Math.PI * 2;
      if (sweep <= 0) continue;
      const a = center.plus(Vec2.of(Math.cos(angle), Math.sin(angle)).times(radius));
      const end = angle + sweep;
      const b = center.plus(Vec2.of(Math.cos(end), Math.sin(end)).times(radius));
      const path =
        sweep >= Math.PI * 2 - 1e-6
          ? circle(center, radius)
          : parsePathData(`M${center.x},${center.y} L${a.x},${a.y} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${b.x},${b.y} Z`);
      fillPath(path, color(i));
      // Percentage on big slices
      if (sweep > 0.35) {
        const middle = center.plus(Vec2.of(Math.cos(angle + sweep / 2), Math.sin(angle + sweep / 2)).times(radius * 0.62));
        text(`${Math.round((value / total) * 100)}%`, middle.x, middle.y + s(5), 13, { color: Color4.white, align: 'center', bold: true });
      }
      angle = end;
    }
    const legendX = center.x + radius + s(30);
    legend(
      chart.labels.map((label, i) => ({ label: `${label} (${formatNumber(values[i])}${unit})`, color: color(i) })),
      legendX,
    );
    const legendWidth = Math.max(...chart.labels.map((l) => l.length)) * s(8) + s(90);
    return {
      components,
      size: Vec2.of(legendX - o.x + legendWidth, Math.max(radius * 2 + s(64), s(44) + chart.labels.length * s(24) + s(20))),
    };
  }

  // Bar and line charts: axes
  const allValues = chart.series.flatMap((series) => series.values);
  const maxValue = niceCeil(Math.max(0, ...allValues));
  const minValue = -niceCeil(Math.max(0, ...allValues.map((v) => -v)));
  const range = maxValue - minValue || 1;
  const left = o.x + s(56);
  const width = s(Math.max(360, Math.min(640, chart.labels.length * (chart.type === 'bar' ? 40 * chart.series.length + 30 : 60))));
  const height = s(240);
  const yOf = (value: number) => top + height - ((value - minValue) / range) * height;

  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const value = minValue + (range * i) / ticks;
    const y = yOf(value);
    linePath(Path.fromString(`M${left},${y} L${left + width},${y}`), value === 0 ? muted : grid, value === 0 ? 1.5 : 1);
    text(`${formatNumber(value)}${unit}`, left - s(8), y + s(4), 11, { color: muted, align: 'right' });
  }

  const groupWidth = width / chart.labels.length;
  const maxLabelChars = Math.max(4, Math.floor(groupWidth / s(7)));
  for (const [i, label] of chart.labels.entries()) {
    const shortLabel = label.length > maxLabelChars ? `${label.slice(0, maxLabelChars - 1)}…` : label;
    text(shortLabel, left + groupWidth * (i + 0.5), top + height + s(18), 12, { color: muted, align: 'center' });
  }

  if (chart.type === 'bar') {
    const barWidth = (groupWidth * 0.72) / chart.series.length;
    const showValues = chart.labels.length * chart.series.length <= 16;
    for (const [j, series] of chart.series.entries()) {
      for (const [i, value] of series.values.entries()) {
        const x = left + groupWidth * i + groupWidth * 0.14 + barWidth * j;
        const y0 = yOf(0);
        const y1 = yOf(value);
        fillPath(rect(x, Math.min(y0, y1), barWidth * 0.92, Math.abs(y1 - y0)), color(j));
        if (showValues) {
          text(`${formatNumber(value)}${unit}`, x + barWidth * 0.46, Math.min(y0, y1) - s(5), 11, { align: 'center' });
        }
      }
    }
  } else {
    for (const [j, series] of chart.series.entries()) {
      const points = series.values.map((value, i) => Vec2.of(left + groupWidth * (i + 0.5), yOf(value)));
      linePath(Path.fromString(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')), color(j), 3);
      for (const point of points) {
        fillPath(circle(point, s(4.5)), color(j));
      }
    }
  }

  if (showLegend) {
    legend(chart.series.map((series, i) => ({ label: series.name, color: color(i) })), left + width + s(24));
  }
  const legendWidth = showLegend ? Math.max(...chart.series.map((series) => series.name.length)) * s(8) + s(60) : 0;
  return { components, size: Vec2.of(left - o.x + width + legendWidth + s(10), top - o.y + height + s(30)) };
}
