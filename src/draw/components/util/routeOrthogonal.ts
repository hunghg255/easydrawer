import { type IVec2, Rect2, Vec2 } from '~/math';

export type RouteSide = 'right' | 'bottom' | 'left' | 'top';
const sideNames: RouteSide[] = ['right', 'bottom', 'left', 'top'];

/**
 * One end of a route: attached to a rectangle (by default, any of its sides can be used),
 * or a free point.
 */
export type RouteEnd = { rect: Rect2; side?: RouteSide } | { point: IVec2 };

export interface RouteOptions {
  /** Distance kept between the route and obstacles (and the length of the first/last segments). */
  margin: number;
  /** Space between the route's ends and the rectangles they're attached to. Default: `margin / 4`. */
  gap?: number;
}

// Directions: right, down, left, up
const directions = [Vec2.of(1, 0), Vec2.of(0, 1), Vec2.of(-1, 0), Vec2.of(0, -1)];
const noDirection = 4;

interface Port {
  /** Where the route touches the rectangle (or the free point). */
  point: IVec2;
  /** First/last grid point, `margin` away from the rectangle. */
  stub: IVec2;
  /** Direction from `point` to `stub` (`noDirection` for free points). */
  direction: number;
  cost: number;
}

function portsOf (end: RouteEnd, margin: number, gap: number, towards: IVec2): Port[] {
  if ('point' in end) {
    return [{ point: end.point, stub: end.point, direction: noDirection, cost: 0 }];
  }

  const r = end.rect;
  const center = r.center;
  const sides = [
    { point: Vec2.of(r.x + r.w, center.y), direction: 0 },
    { point: Vec2.of(center.x, r.y + r.h), direction: 1 },
    { point: Vec2.of(r.x, center.y), direction: 2 },
    { point: Vec2.of(center.x, r.y), direction: 3 },
  ];
  const allowed = end.side ? sides.filter(({ direction }) => sideNames[direction] === end.side) : sides;
  return allowed.map(({ point, direction }) => {
    const normal = directions[direction];
    // Sides that face away from the other end cost a little more (ties go to facing sides).
    const facing = normal.dot(Vec2.ofXY(towards).minus(center)) > 0;
    return {
      point: point.plus(normal.times(gap)),
      stub: point.plus(normal.times(margin)),
      direction,
      cost: margin + (facing ? 0 : margin * 0.5),
    };
  });
}

function centerOf (end: RouteEnd) {
  return 'point' in end ? end.point : end.rect.center;
}

/** A minimal binary heap, ordered by `priority`. */
class Heap<T> {
  private items: Array<{ priority: number; value: T }> = [];

  public get size() {
    return this.items.length;
  }

  public push(value: T, priority: number) {
    const items = this.items;
    items.push({ priority, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  public pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}

function uniqueSorted (values: number[]) {
  const sorted = values.filter((v) => isFinite(v)).sort((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > 1e-6);
}

/**
 * Finds a path made of horizontal and vertical segments from `start` to `end` that goes
 * around `obstacles`, with few bends (like the connectors of diagram editors).
 *
 * Ends attached to a rectangle can leave from any of its four sides.
 *
 * @returns the points of the path (from `start` to `end`), or `null` if there is none.
 */
export default function routeOrthogonal (
  start: RouteEnd,
  end: RouteEnd,
  obstacles: Rect2[],
  options: RouteOptions,
): IVec2[] | null {
  const margin = options.margin;
  const gap = options.gap ?? margin / 4;
  const bendCost = margin * 2;

  const startPorts = portsOf(start, margin, gap, centerOf(end));
  const endPorts = portsOf(end, margin, gap, centerOf(start));

  // Areas the route can't cross. Free ends can be inside an obstacle: ignore those.
  const freePoints = [start, end].filter((e): e is { point: IVec2 } => 'point' in e).map((e) => e.point);
  const blocked = [
    ...obstacles.filter((o) => !freePoints.some((p) => o.containsPoint(p))),
    ...[start, end].filter((e): e is { rect: Rect2 } => 'rect' in e).map((e) => e.rect),
  ].map((r) => r.grownBy(margin / 2));

  const stubs = [...startPorts, ...endPorts].map((p) => p.stub);
  const bounds = Rect2.bboxOf([...blocked.flatMap((r) => r.corners), ...stubs]).grownBy(margin);

  // Grid lines: obstacle edges, lanes just outside them, ends, and the middle between the ends.
  const middle = Vec2.ofXY(centerOf(start)).lerp(Vec2.ofXY(centerOf(end)), 0.5);
  const xs = uniqueSorted([
    ...blocked.flatMap((r) => [r.x, r.x + r.w, r.x - margin / 2, r.x + r.w + margin / 2]),
    ...stubs.map((p) => p.x),
    middle.x,
    bounds.x,
    bounds.x + bounds.w,
  ]);
  const ys = uniqueSorted([
    ...blocked.flatMap((r) => [r.y, r.y + r.h, r.y - margin / 2, r.y + r.h + margin / 2]),
    ...stubs.map((p) => p.y),
    middle.y,
    bounds.y,
    bounds.y + bounds.h,
  ]);

  const isInside = (x: number, y: number) =>
    blocked.some((r) => x > r.x + 1e-6 && x < r.x + r.w - 1e-6 && y > r.y + 1e-6 && y < r.y + r.h - 1e-6);
  const free = xs.map((x) => ys.map((y) => !isInside(x, y)));
  const indexOf = (value: number, values: number[]) => {
    let best = 0;
    for (const [i, v] of values.entries()) {
      if (Math.abs(v - value) < Math.abs(values[best] - value)) best = i;
    }
    return best;
  };

  // Moving between neighboring grid points: the segment is free if its middle is (grid
  // lines include every obstacle edge).
  const canMove = (i: number, j: number, direction: number) => {
    const ni = i + Math.round(directions[direction].x);
    const nj = j + Math.round(directions[direction].y);
    if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length || !free[ni][nj]) return null;
    if (isInside((xs[i] + xs[ni]) / 2, (ys[j] + ys[nj]) / 2)) return null;
    return [ni, nj] as const;
  };

  const goals = new Map<string, Port>();
  for (const port of endPorts) {
    const i = indexOf(port.stub.x, xs);
    const j = indexOf(port.stub.y, ys);
    if (free[i][j]) goals.set(`${i},${j}`, port);
  }
  if (goals.size === 0) return null;

  const heuristic = (i: number, j: number) => {
    let best = Infinity;
    for (const port of goals.values()) {
      best = Math.min(best, Math.abs(xs[i] - port.stub.x) + Math.abs(ys[j] - port.stub.y));
    }
    return best;
  };

  // A* over (grid point, direction of arrival)
  const key = (i: number, j: number, d: number) => (i * ys.length + j) * 5 + d;
  const bestCost = new Map<number, number>();
  const previous = new Map<number, number>();
  const startPortOf = new Map<number, Port>();
  const heap = new Heap<{ i: number; j: number; d: number; cost: number }>();

  for (const port of startPorts) {
    const i = indexOf(port.stub.x, xs);
    const j = indexOf(port.stub.y, ys);
    if (!free[i][j]) continue;
    const k = key(i, j, port.direction);
    if (port.cost < (bestCost.get(k) ?? Infinity)) {
      bestCost.set(k, port.cost);
      startPortOf.set(k, port);
      heap.push({ i, j, d: port.direction, cost: port.cost }, port.cost + heuristic(i, j));
    }
  }

  let found: { k: number; port: Port } | null = null;
  let foundCost = Infinity;
  const maxSteps = 200_000;
  for (let steps = 0; heap.size > 0 && steps < maxSteps; steps++) {
    const { i, j, d, cost } = heap.pop();
    const k = key(i, j, d);
    if (cost > (bestCost.get(k) ?? Infinity)) continue;
    if (cost >= foundCost) break;

    const goal = goals.get(`${i},${j}`);
    if (goal) {
      // Arriving at the stub, then turning towards the rectangle.
      const into = goal.direction === noDirection ? d : (goal.direction + 2) % 4;
      const total = cost + goal.cost + (d !== noDirection && d !== into ? bendCost : 0);
      if (total < foundCost) {
        foundCost = total;
        found = { k, port: goal };
      }
    }

    for (let direction = 0; direction < 4; direction++) {
      if (d !== noDirection && direction === (d + 2) % 4) continue;
      const next = canMove(i, j, direction);
      if (!next) continue;
      const [ni, nj] = next;
      const length = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      const nextCost = cost + length + (d !== noDirection && d !== direction ? bendCost : 0);
      const nk = key(ni, nj, direction);
      if (nextCost < (bestCost.get(nk) ?? Infinity)) {
        bestCost.set(nk, nextCost);
        previous.set(nk, k);
        heap.push({ i: ni, j: nj, d: direction, cost: nextCost }, nextCost + heuristic(ni, nj));
      }
    }
  }

  if (!found) return null;

  // Walk back to the start.
  const gridPoints: IVec2[] = [];
  let k: number | undefined = found.k;
  let startPort: Port | undefined;
  while (k !== undefined) {
    const cell = Math.floor(k / 5);
    gridPoints.unshift(Vec2.of(xs[Math.floor(cell / ys.length)], ys[cell % ys.length]));
    const prev = previous.get(k);
    if (prev === undefined) startPort = startPortOf.get(k);
    k = prev;
  }
  if (!startPort) return null;

  const points = [startPort.point, ...gridPoints, found.port.point];
  return simplifyPath(points);
}

/** Removes repeated points and points in the middle of straight segments. */
export function simplifyPath (points: IVec2[]): IVec2[] {
  const result: IVec2[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && Vec2.ofXY(point).eq(last, 1e-6)) continue;

    const beforeLast = result[result.length - 2];
    if (beforeLast && last) {
      const collinear =
        (Math.abs(beforeLast.x - last.x) < 1e-6 && Math.abs(last.x - point.x) < 1e-6) ||
        (Math.abs(beforeLast.y - last.y) < 1e-6 && Math.abs(last.y - point.y) < 1e-6);
      if (collinear) result.pop();
    }
    result.push(point);
  }
  return result;
}
