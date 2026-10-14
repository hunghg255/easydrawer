import { describe, expect, it } from 'vitest';

import { Color4, Vec2 } from '~/math';

import NaturalPenBuilder, { defaultNaturalPenOptions, makeNaturalPenBuilder } from './NaturalPenBuilder';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';

function makeViewport () {
  const viewport = new Viewport(() => {});
  viewport.updateScreenSize(Vec2.of(500, 500));
  return viewport;
}

function point (x: number, y: number, time: number, pressure?: number): StrokeDataPoint {
  return {
    pos: Vec2.of(x, y),
    width: 2,
    baseWidth: 4,
    pressure,
    color: Color4.red,
    time,
  };
}

describe('NaturalPenBuilder', () => {
  it('should create a filled stroke that covers the input', () => {
    const builder = new NaturalPenBuilder(point(0, 0, 0), makeViewport(), defaultNaturalPenOptions);
    for (let i = 1; i <= 50; i++) {
      builder.addPoint(point(i * 4, Math.sin(i / 5) * 20, i * 8));
    }
    const stroke = builder.build();
    const bbox = stroke.getBBox();

    expect(bbox.x).toBeLessThan(0);
    expect(bbox.x + bbox.w).toBeGreaterThan(200);
    expect(stroke.getStyle().color?.eq(Color4.red)).toBe(true);
  });

  it('should create a dot for a single tap', () => {
    const builder = new NaturalPenBuilder(point(10, 10, 0, 0.5), makeViewport(), defaultNaturalPenOptions);
    const bbox = builder.build().getBBox();

    expect(bbox.area).toBeGreaterThan(0);
    expect(bbox.center.distanceTo(Vec2.of(10, 10))).toBeLessThan(0.5);
  });

  it('should make strokes wider with more pressure', () => {
    const widthWithPressure = (pressure: number) => {
      const builder = new NaturalPenBuilder(point(0, 0, 0, pressure), makeViewport(), defaultNaturalPenOptions);
      for (let i = 1; i <= 30; i++) {
        builder.addPoint(point(i * 5, 0, i * 8, pressure));
      }
      return builder.build().getBBox().h;
    };

    expect(widthWithPressure(1)).toBeGreaterThan(widthWithPressure(0.2) * 2);
  });

  it('should ignore non-finite points', () => {
    const builder = new NaturalPenBuilder(point(0, 0, 0), makeViewport(), defaultNaturalPenOptions);
    builder.addPoint(point(Number.NaN, 3, 8));
    builder.addPoint(point(20, 0, 16));

    const bbox = builder.build().getBBox();
    expect(isFinite(bbox.area)).toBe(true);
  });

  it('should keep sharp corners for sparse points (e.g. autocorrected rectangles)', () => {
    const corners = [[0, 0], [300, 0], [300, 150], [0, 150], [0, 0]];
    const builder = new NaturalPenBuilder(point(0, 0, 0, 0.5), makeViewport(), defaultNaturalPenOptions);
    corners.slice(1).forEach(([x, y], i) => builder.addPoint(point(x, y, (i + 1) * 100, 0.5)));

    // The outline must still reach the corners (smoothing would shrink it).
    const bbox = builder.build().getBBox();
    expect(bbox.x).toBeLessThan(0);
    expect(bbox.y).toBeLessThan(0);
    expect(bbox.x + bbox.w).toBeGreaterThan(300);
    expect(bbox.y + bbox.h).toBeGreaterThan(150);
  });
});

describe('shape recognition', () => {
  const drawAndCorrect = async (points: Array<[number, number]>) => {
    const builder = makeNaturalPenBuilder(point(...points[0], 0, 0.5), makeViewport());
    points.slice(1).forEach(([x, y], i) => builder.addPoint(point(x, y, (i + 1) * 10, 0.5)));
    return builder.autocorrectShape!();
  };

  it('should snap a wobbly circle to a circle', async () => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const radius = 100 + Math.sin(i * 1.7) * 6;
      points.push([250 + radius * Math.cos(angle), 250 + radius * Math.sin(angle)]);
    }

    const shape = await drawAndCorrect(points);
    expect(shape).not.toBeNull();
    const bbox = shape!.getBBox();
    expect(bbox.center.distanceTo(Vec2.of(250, 250))).toBeLessThan(10);
    expect(Math.abs(bbox.w - bbox.h)).toBeLessThan(10);
  });

  it('should snap a wobbly line to a straight line', async () => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      points.push([50 + i * 8, 100 + Math.sin(i) * 4]);
    }

    const shape = await drawAndCorrect(points);
    expect(shape).not.toBeNull();
    expect(shape!.getBBox().h).toBeLessThan(10);
  });

  it('should not snap a scribble', async () => {
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= 60; i++) {
      points.push([50 + i * 5, 100 + Math.sin(i / 2) * 60]);
    }

    expect(await drawAndCorrect(points)).toBeNull();
  });
});
