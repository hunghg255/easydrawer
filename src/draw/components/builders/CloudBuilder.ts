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
export const makeCloudBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new CloudBuilder(initialPoint, viewport);
  },
);

class CloudBuilder implements ComponentBuilder {
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

    // Round the stroke width
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    // Calculate center and size based on start and end points
    const center = this.startPoint.pos;
    const size = this.startPoint.pos.distanceTo(this.endPoint.pos);
    
    // Scale factor to adjust the cloud size based on the distance
    const scale = size / 200; // Original cloud is roughly 300x200 pixels
    
    // Function to create a point relative to the center
    const p = (x: number, y: number): IVec2 => {
      return center.plus(Vec2.of((x - 250) * scale, (y - 100) * scale));
    };

    // Starting point
    const startPoint = p(170, 80);
    pathCommands.push({
      kind: PathCommandType.MoveTo,
      point: startPoint
    });

    // Define the cloud shape using bezier curves
    // Each array contains [cp1x, cp1y, cp2x, cp2y, endX, endY]
    const curves = [
      [130, 100, 130, 150, 230, 150], // Bottom left curve
      [250, 180, 320, 180, 340, 150], // Bottom middle curve
      [420, 150, 420, 120, 390, 100], // Bottom right curve
      [430, 40, 370, 30, 340, 50],    // Top right curve
      [320, 5, 250, 20, 250, 50],     // Top middle curve
      [200, 5, 150, 20, 170, 80]      // Top left curve (back to start)
    ];

    // Add all bezier curves
    for (const [cp1x, cp1y, cp2x, cp2y, endX, endY] of curves) {
      pathCommands.push({
        kind: PathCommandType.CubicBezierTo,
        controlPoint1: p(cp1x, cp1y),
        controlPoint2: p(cp2x, cp2y),
        endPoint: p(endX, endY)
      });
    }

    // Close the path
    pathCommands.push({
      kind: PathCommandType.LineTo,
      point: startPoint
    });

    const path = new Path(startPoint, pathCommands).mapPoints((point) =>
      this.viewport.roundPoint(point)
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
