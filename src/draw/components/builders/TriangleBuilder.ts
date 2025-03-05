import { type Rect2, Path, PathCommandType } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import   Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates filled rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeFilledTriangleBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new TriangleBuilder(initialPoint, true, viewport);
  },
);

/**
 * Creates outlined rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeOutlinedTriangleBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new TriangleBuilder(initialPoint, false, viewport);
  },
);

export default class TriangleBuilder implements ComponentBuilder {
  private endPoint: StrokeDataPoint;

  public constructor(
    private readonly startPoint: StrokeDataPoint,
    private filled: boolean,
    private viewport: Viewport,
  ) {
    // Initially, the start and end points are the same.
    this.endPoint = startPoint;
  }

  public getBBox(): Rect2 {
    const preview = this.buildPreview();
    return preview.getBBox();
  }

  private buildPreview(): Stroke {
    const startPoint = this.startPoint.pos;
    const endPoint = this.endPoint.pos;
    const strokeWidth = Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );
    // Calculate the third point of the triangle
    // Creating an equilateral-like triangle where the third point is perpendicular to the line
    const vector = endPoint.minus(startPoint);
    const perpendicular = vector.orthog().normalized();
    const height = vector.magnitude() * 0.866; // Approximately sqrt(3)/2 for equilateral proportions
    const thirdPoint = startPoint.plus(vector.times(0.5)).plus(perpendicular.times(height));

    // Create the triangle path
    const path = new Path(startPoint, [
      {
        kind: PathCommandType.LineTo,
        point: endPoint,
      },
      {
        kind: PathCommandType.LineTo,
        point: thirdPoint,
      },
      {
        kind: PathCommandType.LineTo,
        point: startPoint,
      },
    ]).mapPoints((point) => this.viewport.roundPoint(point));

    const preview = new Stroke([
      pathToRenderable(path, {
        fill: this.endPoint.color,
        stroke: {
          width: strokeWidth,
          color: this.endPoint.borderColor || this.endPoint.color,
        },
      }),
    ]);
    return preview;
  }

  private getLineWidth(): number {
    return Math.max(this.startPoint.width, this.endPoint.width);
  }

  public build(): AbstractComponent {
    return this.buildPreview();
  }

  public preview(renderer: AbstractRenderer): void {
    this.buildPreview().render(renderer);
  }

  public addPoint(point: StrokeDataPoint): void {
    this.endPoint = point;
  }
}
