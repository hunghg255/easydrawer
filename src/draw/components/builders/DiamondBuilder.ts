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
export const makeFilledDiamondBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new DiamondBuilder(initialPoint, true, viewport);
  },
);

/**
 * Creates outlined rectangles with sharp corners.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeOutlinedDiamondBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new DiamondBuilder(initialPoint, false, viewport);
  },
);

export default class DiamondBuilder implements ComponentBuilder {
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

    // Calculate the center point of the diamond
    const center = startPoint.plus(endPoint.minus(startPoint).times(0.5));

    // Calculate width and height vectors for the diamond
    const widthVector = { x: (endPoint.x - startPoint.x) * 0.5, y: 0 };
    const heightVector = { x: 0, y: (endPoint.y - startPoint.y) * 0.5 };

    // Calculate the four points of the diamond
    const leftPoint = center.plus( Vec3.of(-widthVector.x, 0, 0));
    const rightPoint = center.plus(Vec3.of(widthVector.x, 0, 0));
    const topPoint = center.plus(Vec3.of(0, -heightVector.y, 0));
    const bottomPoint = center.plus(Vec3.of(0, heightVector.y, 0));

    // Create the diamond path
    const path = new Path(leftPoint, [
      {
        kind: PathCommandType.LineTo,
        point: topPoint,
      },
      {
        kind: PathCommandType.LineTo,
        point: rightPoint,
      },
      {
        kind: PathCommandType.LineTo,
        point: bottomPoint,
      },
      {
        kind: PathCommandType.LineTo,
        point: leftPoint,
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
