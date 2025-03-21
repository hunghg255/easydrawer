import { Vec2, Path, type PathCommand, PathCommandType, type Rect2 } from '~/math';

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
export const makeCircleBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new CircleBuilder(initialPoint, viewport);
  },
);

class CircleBuilder implements ComponentBuilder {
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
    const numDivisions = 6;
    const stepSize = (Math.PI * 2) / numDivisions;

    // Round the stroke width so that when exported it doesn't have unnecessary trailing decimals.
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    const center = this.startPoint.pos.lerp(this.endPoint.pos, 0.5);
    const startEndDelta = this.endPoint.pos.minus(center);
    const radius = startEndDelta.length() - strokeWidth / 2;

    const startPoint = center.plus(Vec2.of(radius, 0));

    for (let t = stepSize; t <= Math.PI * 2; t += stepSize) {
      const endPoint = Vec2.of(radius * Math.cos(t), -radius * Math.sin(t)).plus(center);

      // controlPointRadiusScale is selected to make the circles appear circular and
      // **does** depend on stepSize.
      const controlPointRadiusScale = 1.141;
      const controlPoint = Vec2.of(Math.cos(t - stepSize / 2), -Math.sin(t - stepSize / 2))
        .times(radius * controlPointRadiusScale)
        .plus(center);

      pathCommands.push({
        kind: PathCommandType.QuadraticBezierTo,
        controlPoint,
        endPoint,
      });
    }

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
