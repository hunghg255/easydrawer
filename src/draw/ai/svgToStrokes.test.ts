import { describe, expect, it } from 'vitest';

import { Mat33, Vec2 } from '~/math';

import buildChart, { validateChart } from './charts';
import { parsePathData, parseTransform, shapeToPathData } from './svgToStrokes';
import { AIError } from './types';

function fakeElement (tagName: string, attributes: Record<string, string>) {
  return { tagName, getAttribute: (name: string) => attributes[name] ?? null } as unknown as Element;
}

describe('parsePathData', () => {
  it('supports relative commands, H/V, S/T and Z', () => {
    const path = parsePathData('m10 10 h20 v20 h-20 z')!;
    const box = path.bbox;
    expect(box.x).toBeCloseTo(10);
    expect(box.w).toBeCloseTo(20);
    expect(box.h).toBeCloseTo(20);
    expect(parsePathData('M0 0 C 10 0 10 10 20 10 S 30 20 40 20 Q 50 0 60 0 T 80 0')).not.toBeNull();
  });

  it('converts arcs to curves', () => {
    // A full circle of radius 10 around (0, 0), as two arcs.
    const box = parsePathData('M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z')!.bbox;
    expect(box.x).toBeCloseTo(-10, 0);
    expect(box.y).toBeCloseTo(-10, 0);
    expect(box.w).toBeCloseTo(20, 0);
    expect(box.h).toBeCloseTo(20, 0);
  });

  it('applies transforms and rejects invalid data', () => {
    const box = parsePathData('M0 0 L10 0 L10 10 Z', parseTransform('translate(100 50) scale(2)'))!.bbox;
    expect(box.x).toBeCloseTo(100);
    expect(box.y).toBeCloseTo(50);
    expect(box.w).toBeCloseTo(20);
    expect(parsePathData('')).toBeNull();
    expect(parsePathData('hello')).toBeNull();
  });
});

describe('parseTransform', () => {
  it('combines transforms left to right', () => {
    const m = parseTransform('translate(10, 0) rotate(90)');
    const p = m.transformVec2(Vec2.of(1, 0));
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(1);
    expect(parseTransform(null)).toEqual(Mat33.identity);
  });
});

describe('shapeToPathData', () => {
  it('converts basic shapes', () => {
    const rect = parsePathData(shapeToPathData(fakeElement('rect', { x: '5', y: '5', width: '10', height: '20', rx: '2' }))!)!;
    expect(rect.bbox.w).toBeCloseTo(10, 0);
    expect(rect.bbox.h).toBeCloseTo(20, 0);
    const circle = parsePathData(shapeToPathData(fakeElement('circle', { cx: '0', cy: '0', r: '5' }))!)!;
    expect(circle.bbox.w).toBeCloseTo(10, 0);
    expect(shapeToPathData(fakeElement('polygon', { points: '0,0 10,0 5,8' }))).toBe('M0,0 10,0 5,8 Z');
    expect(shapeToPathData(fakeElement('text', {}))).toBeNull();
  });
});

describe('charts', () => {
  it('validates chart data', () => {
    const chart = validateChart({ type: 'donut', labels: ['A', 'B'], series: [{ name: 'S', values: [1, 'x'] }] });
    expect(chart.type).toBe('bar');
    expect(chart.series[0].values).toEqual([1, 0]);
    expect(() => validateChart({ labels: [] })).toThrow(AIError);
  });

  it('builds bar, line and pie charts', () => {
    for (const type of ['bar', 'line', 'pie'] as const) {
      const chart = validateChart({
        type,
        title: 'Revenue',
        labels: ['Q1', 'Q2', 'Q3'],
        series: [{ name: 'A', values: [10, 20, 15] }, { name: 'B', values: [5, 8, 12] }],
      });
      const { components, size } = buildChart(chart, Vec2.zero, 1);
      expect(components.length).toBeGreaterThan(5);
      expect(size.x).toBeGreaterThan(100);
      expect(size.y).toBeGreaterThan(100);
    }
  });
});
