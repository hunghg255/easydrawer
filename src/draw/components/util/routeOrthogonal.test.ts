import { describe, expect, it } from 'vitest';

import { type IVec2, LineSegment2, Rect2, Vec2 } from '~/math';

import routeOrthogonal from './routeOrthogonal';

function crosses (points: IVec2[], rect: Rect2) {
  const inner = rect.grownBy(-1);
  for (let i = 1; i < points.length; i++) {
    const segment = new LineSegment2(Vec2.ofXY(points[i - 1]), Vec2.ofXY(points[i]));
    if (inner.containsPoint(segment.p1) || inner.containsPoint(segment.p2)) return true;
    if (inner.getEdges().some((edge) => edge.intersection(segment))) return true;
  }
  return false;
}

function isOrthogonal (points: IVec2[]) {
  return points.slice(1).every((p, i) => Math.abs(p.x - points[i].x) < 1e-6 || Math.abs(p.y - points[i].y) < 1e-6);
}

describe('routeOrthogonal', () => {
  it('goes straight between facing rectangles', () => {
    const route = routeOrthogonal({ rect: new Rect2(0, 0, 100, 50) }, { rect: new Rect2(0, 200, 100, 50) }, [], { margin: 20 });
    expect(route).toHaveLength(2);
    expect(route![0].y).toBeGreaterThan(50);
    expect(route![1].y).toBeLessThan(200);
  });

  it('goes around obstacles with right angles', () => {
    const obstacle = new Rect2(-50, 100, 200, 50);
    const route = routeOrthogonal(
      { rect: new Rect2(0, 0, 100, 50) },
      { rect: new Rect2(0, 250, 100, 50) },
      [obstacle],
      { margin: 20 },
    )!;
    expect(route).not.toBeNull();
    expect(isOrthogonal(route)).toBe(true);
    expect(crosses(route, obstacle)).toBe(false);
  });

  it('routes a "back" edge around the shapes in between', () => {
    // a → b → c vertically; route c back to a without crossing b.
    const a = new Rect2(0, 0, 100, 50);
    const b = new Rect2(0, 120, 100, 50);
    const c = new Rect2(0, 240, 100, 50);
    const route = routeOrthogonal({ rect: c }, { rect: a }, [b], { margin: 20 })!;
    expect(crosses(route, b)).toBe(false);
    expect(crosses(route, a.grownBy(-6))).toBe(false);
    expect(crosses(route, c.grownBy(-6))).toBe(false);
  });

  it('supports free ends', () => {
    const route = routeOrthogonal({ point: Vec2.of(0, 0) }, { point: Vec2.of(200, 100) }, [], { margin: 20 })!;
    expect(route[0]).toMatchObject({ x: 0, y: 0 });
    expect(route[route.length - 1]).toMatchObject({ x: 200, y: 100 });
    expect(isOrthogonal(route)).toBe(true);
  });
});
