import { Vec2, Path, type PathCommand, PathCommandType, type Rect2, type IVec2 } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates a stroke builder that generates outlined circles.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeHeartBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new HeartBuilder(initialPoint, viewport);
  },
);

class HeartBuilder implements ComponentBuilder {
  private endPoint: StrokeDataPoint;

  public constructor(
    private readonly startPoint: StrokeDataPoint,
    private readonly viewport: Viewport,
  ) {
    // Initially, the start and end points are the same.
    this.endPoint = startPoint;
  }

  public getBBox(): Rect2 {
    const preview = this.buildPreview();
    return preview.getBBox();
  }

  private buildPreview(): Stroke {
    const pathCommands: PathCommand[] = [];
    const numDivisions = 150;
    const stepSize = (Math.PI * 2) / numDivisions;

    // Round the stroke width so that when exported it doesn't have unnecessary trailing decimals.
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    const center = this.startPoint.pos.lerp(this.endPoint.pos, 0.5);
    const startEndDelta = this.endPoint.pos.minus(center);
    const width = startEndDelta.length(); // Width of the heart
    const height = width * 0.9; // Height of the heart

    // Standard parametric equation for heart shape:
    // x = 16 * sin(t)^3
    // y = 13 * cos(t) - 5 * cos(2t) - 2 * cos(3t) - cos(4t)
    // We'll use this to generate our heart shape points

    const heartPoints: IVec2[] = [];
    for (let i = 0; i <= numDivisions; i++) {
      const t = i * stepSize;
      // Modified heart equation with scaling to match our size
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      // Scale and position the heart
      const scaleFactor = width / 16;
      const point = Vec2.of(
        x * scaleFactor,
        -y * scaleFactor * 0.9 // Flip y and adjust height
      ).plus(center);

      heartPoints.push(point);
    }

    // Create the path using the points
    const startPoint = heartPoints[0];

    // Create a smooth path with bezier curves
    for (let i = 1; i < heartPoints.length; i += 2) {
      const nextIndex = (i + 1) % heartPoints.length;
      const endPoint = heartPoints[nextIndex];
      const controlPoint = heartPoints[i];

      pathCommands.push({
        kind: PathCommandType.QuadraticBezierTo,
        controlPoint,
        endPoint,
      });
    }

    // Close the path
    pathCommands.push({
      kind: PathCommandType.LineTo,
      point: startPoint,
    });

    const path = new Path(startPoint, pathCommands).mapPoints((point) =>
      this.viewport.roundPoint(point),
    );

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
