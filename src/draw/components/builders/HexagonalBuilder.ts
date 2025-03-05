import { type Rect2, Path, PathCommandType, Vec3 } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import  Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates filled rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeFilledHexagonalBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new HexagonalBuilder(initialPoint, true, viewport);
  },
);

/**
 * Creates outlined rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeOutlinedHexagonalBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new HexagonalBuilder(initialPoint, false, viewport);
  },
);

export default class HexagonalBuilder implements ComponentBuilder {
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

    // Calculate the center point of the hexagon
    const center = startPoint.plus(endPoint.minus(startPoint).times(0.5));

    // Calculate the radius of the hexagon (distance from center to any vertex)
    const width = Math.abs(endPoint.x - startPoint.x) / 2;
    const height = Math.abs(endPoint.y - startPoint.y) / 2;
    const radius = Math.min(width, height);

    // Calculate the six points of the hexagon
    const hexPoints = [] as any;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i; // 60 degrees in radians
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      hexPoints.push(Vec3.of(x, y, 0));
    }

    // Create the hexagon path
    const path = new Path(hexPoints[0], [
      ...hexPoints.slice(1).map((point: any) => ({
        kind: PathCommandType.LineTo,
        point,
      })),
      {
        kind: PathCommandType.LineTo,
        point: hexPoints[0],
      }
    ]).mapPoints((point) => this.viewport.roundPoint(point));

    const preview = new Stroke([
      pathToRenderable(path, {
        fill: this.endPoint.color ,
        stroke: {
          width: strokeWidth,
          color: this.endPoint.borderColor || this.endPoint.color,
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
