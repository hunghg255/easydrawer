import { type Rect2, Path, PathCommandType, Vec3 } from '~/math';

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
export const makeFilledSquareBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new SquareBuilder(initialPoint, true, viewport);
  },
);

/**
 * Creates outlined rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeOutlinedSquareBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new SquareBuilder(initialPoint, false, viewport);
  },
);

export default class SquareBuilder implements ComponentBuilder {
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
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    // Calculate the side length for the square based on the larger dimension
    const xDiff = endPoint.x - startPoint.x;
    const yDiff = endPoint.y - startPoint.y;
    const sideLength = Math.max(Math.abs(xDiff), Math.abs(yDiff));

    // Determine the direction to extend the square
    const xSign = Math.sign(xDiff) || 1; // Default to positive if zero
    const ySign = Math.sign(yDiff) || 1; // Default to positive if zero

    // Calculate the square's end point
    const squareEndX = startPoint.x + sideLength * xSign;
    const squareEndY = startPoint.y + sideLength * ySign;

    // Create the square path
    const path = new Path(startPoint, [
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(squareEndX, startPoint.y, 0),
      },
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(squareEndX, squareEndY, 0),
      },
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(startPoint.x, squareEndY, 0),
      },
      {
        kind: PathCommandType.LineTo,
        point: startPoint,
      },
    ]).mapPoints((point) => this.viewport.roundPoint(point));

    const style = {
      fill: this.endPoint.color,
      stroke: {
        width: strokeWidth,
        color: strokeWidth === 0 ? this.endPoint.color : this.endPoint.borderColor || this.endPoint.color,
      },
    };

    const preview = new Stroke([pathToRenderable(path, style)]);
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
