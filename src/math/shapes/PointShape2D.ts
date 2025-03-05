/* eslint-disable @typescript-eslint/no-unused-vars */
import { type IVec2, type IVec3, Vec2 } from '~/math/Vector';

import type LineSegment2 from './LineSegment2';
import Parameterized2DShape from './Parameterized2DShape';
import Rect2 from './Rect2';

/**
 * Like a {@link Vec2}, but with additional functionality (e.g. SDF).
 *
 * Access the internal `Vec2` using the `p` property.
 */
class PointShape2D extends Parameterized2DShape {
  public constructor(public readonly p: IVec2) {
    super();
  }

  public override signedDistance(point: IVec2): number {
    return this.p.distanceTo(point);
  }

  public override argIntersectsLineSegment(lineSegment: LineSegment2, epsilon?: number): number[] {
    if (lineSegment.containsPoint(this.p, epsilon)) {
      return [0];
    }
    return [];
  }

  public override getTightBoundingBox(): Rect2 {
    return new Rect2(this.p.x, this.p.y, 0, 0);
  }

  public override at(_t: number) {
    return this.p;
  }

  /**
	 * Returns an arbitrary unit-length vector.
	 */
  public override normalAt(_t: number) {
    // Return a vector that makes sense.
    return Vec2.unitY;
  }

  public override tangentAt(_t: number): IVec3 {
    return Vec2.unitX;
  }

  public override splitAt(_t: number): [PointShape2D] {
    return [this];
  }

  public override nearestPointTo(_point: IVec2) {
    return {
      point: this.p,
      parameterValue: 0,
    };
  }
}

export default PointShape2D;
