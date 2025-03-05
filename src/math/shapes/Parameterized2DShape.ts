import Abstract2DShape from './Abstract2DShape';
import type LineSegment2 from './LineSegment2';
import {  type IVec2 } from '../Vector';

/**
 * A 2-dimensional path with parameter interval $t \in [0, 1]$.
 *
 * **Note:** Avoid extending this class outside of `easydrawer` --- new abstract methods
 * may be added between minor versions.
 */
export abstract class Parameterized2DShape extends Abstract2DShape {
  /** Returns this at a given parameter. $t \in [0, 1]$ */
  abstract at(t: number): IVec2;

  /** Computes the unit normal vector at $t$. */
  abstract normalAt(t: number): IVec2;

  abstract tangentAt(t: number): IVec2;

  /**
	 * Divides this shape into two separate shapes at parameter value $t$.
	 */
  abstract splitAt(
    t: number,
  ): [Parameterized2DShape] | [Parameterized2DShape, Parameterized2DShape];

  /**
	 * Returns the nearest point on `this` to `point` and the `parameterValue` at which
	 * that point occurs.
	 */
  abstract nearestPointTo(point: IVec2): { point: IVec2; parameterValue: number };

  /**
	 * Returns the **parameter values** at which `lineSegment` intersects this shape.
	 *
	 * See also {@link intersectsLineSegment}
	 */
  public abstract argIntersectsLineSegment(lineSegment: LineSegment2): number[];

  public override intersectsLineSegment(line: LineSegment2): IVec2[] {
    return this.argIntersectsLineSegment(line).map((t) => this.at(t));
  }
}

export default Parameterized2DShape;
