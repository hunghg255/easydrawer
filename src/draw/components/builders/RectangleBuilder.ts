import { Mat33, Rect2, Path } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates filled rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeFilledRectangleBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new RectangleBuilder(initialPoint, true, viewport);
  },
);

/**
 * Creates outlined rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeOutlinedRectangleBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new RectangleBuilder(initialPoint, false, viewport);
  },
);

export default class RectangleBuilder implements ComponentBuilder {
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
    const canvasAngle = this.viewport.getRotationAngle();
    const rotationMat = Mat33.zRotation(-canvasAngle);
    // Round the stroke width so that when exported it doesn't have unnecessary trailing decimals.
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    // Adjust startPoint and endPoint such that applying [rotationMat] to them
    // brings them to this.startPoint and this.endPoint.
    const startPoint = rotationMat.inverse().transformVec2(this.startPoint.pos);
    const endPoint = rotationMat.inverse().transformVec2(this.endPoint.pos);

    const rect = Rect2.fromCorners(startPoint, endPoint);
    const path = Path.fromRect(rect, this.filled ? null : this.endPoint.width)
      .transformedBy(
        // Rotate the canvas rectangle so that its rotation matches the screen
        rotationMat,
      )
      .mapPoints((point) => this.viewport.roundPoint(point));

    const preview = new Stroke([
      pathToRenderable(path, {
        fill: this.endPoint.color,
        stroke: {
          width: strokeWidth,
          color: strokeWidth === 0 ? this.endPoint.color : this.endPoint.borderColor || this.endPoint.color,
        },
      }),
    ]);

    return preview;
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
