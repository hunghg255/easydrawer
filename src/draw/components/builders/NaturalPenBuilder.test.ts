import { describe, expect, it } from 'vitest';

import { Color4, Vec2 } from '~/math';

import NaturalPenBuilder, { defaultNaturalPenOptions } from './NaturalPenBuilder';
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
});
