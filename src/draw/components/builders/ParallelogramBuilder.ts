import { type Rect2, Path, PathCommandType, Vec3 } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

export const makeParallelogramBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new ParallelogramBuilder(initialPoint, true, viewport);
  },
);

export default class ParallelogramBuilder implements ComponentBuilder {
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

    // Calculate the side length for the parallelogram based on the larger dimension
    const xDiff = endPoint.x - startPoint.x;
    const yDiff = endPoint.y - startPoint.y;
    const sideLength = Math.max(Math.abs(xDiff), Math.abs(yDiff));

    // Determine the direction to extend the parallelogram
    const xSign = Math.sign(xDiff) || 1; // Default to positive if zero
    const ySign = Math.sign(yDiff) || 1; // Default to positive if zero

    // Calculate the parallelogram's points
    const point2 = { x: startPoint.x + sideLength * xSign, y: startPoint.y };
    const point3 = { x: point2.x + sideLength * xSign / 2, y: point2.y + sideLength * ySign };
    const point4 = { x: startPoint.x + sideLength * xSign / 2, y: startPoint.y + sideLength * ySign };

    // Create the parallelogram path
    const path = new Path(startPoint, [
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(point2.x, point2.y, 0),
      },
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(point3.x, point3.y, 0),
      },
      {
        kind: PathCommandType.LineTo,
        point: Vec3.of(point4.x, point4.y, 0),
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
