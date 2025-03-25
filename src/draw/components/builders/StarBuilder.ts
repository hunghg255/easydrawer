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
export const makeStarBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new StarBuilder(initialPoint, viewport);
  },
);

class StarBuilder implements ComponentBuilder {
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
    // Round the stroke width so that when exported it doesn't have unnecessary trailing decimals.
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    const center = this.startPoint.pos.lerp(this.endPoint.pos, 0.5);
    const radius = center.distanceTo(this.endPoint.pos);
    const numPoints = 5; // 5-point star
    const innerRadiusRatio = 0.4; // Ratio of inner radius to outer radius
    const innerRadius = radius * innerRadiusRatio;

    const points: IVec2[] = [];
    const angleStep = Math.PI * 2 / (numPoints * 2);

    // Generate the star points
    for (let i = 0; i < numPoints * 2; i++) {
      const angle = -Math.PI / 2 + i * angleStep; // Start from top point
      const currentRadius = i % 2 === 0 ? radius : innerRadius;

      const point = Vec2.of(
        center.x + currentRadius * Math.cos(angle),
        center.y + currentRadius * Math.sin(angle)
      );

      points.push(point);
    }

    // Create the path commands
    const pathCommands: PathCommand[] = [];
    for (let i = 1; i < points.length; i++) {
      pathCommands.push({
        kind: PathCommandType.LineTo,
        point: points[i],
      });
    }

    // Close the path
    pathCommands.push({
      kind: PathCommandType.LineTo,
      point: points[0],
    });

    const path = new Path(points[0], pathCommands).mapPoints((point) =>
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
