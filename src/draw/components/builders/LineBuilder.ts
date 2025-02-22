import { Path, PathCommandType, type Rect2 } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import { pathToRenderable } from '../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import type Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates a stroke builder that generates filled lines.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeLineBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new LineBuilder(initialPoint, viewport);
  },
);

export default class LineBuilder implements ComponentBuilder {
  private endPoint: StrokeDataPoint;

  public constructor(
    private readonly startPoint: StrokeDataPoint,
    private readonly viewport: Viewport,
  ) {
    this.endPoint = startPoint;
  }

  public getBBox(): Rect2 {
    const preview = this.buildPreview();
    return preview.getBBox();
  }

  private buildPreview(): Stroke {
    const startPoint = this.startPoint.pos;
    const endPoint = this.endPoint.pos;
    const toEnd = endPoint.minus(startPoint).normalized();

    const startSize = this.startPoint.width / 2;
    const endSize = this.endPoint.width / 2;

    const lineNormal = toEnd.orthog();
    const scaledStartNormal = lineNormal.times(startSize);
    const scaledEndNormal = lineNormal.times(endSize);

    const strokeStartPoint = startPoint.minus(scaledStartNormal);

    const path = new Path(strokeStartPoint, [
      {
        kind: PathCommandType.LineTo,
        point: startPoint.plus(scaledStartNormal),
      },
      {
        kind: PathCommandType.LineTo,
        point: endPoint.plus(scaledEndNormal),
      },
      {
        kind: PathCommandType.LineTo,
        point: endPoint.minus(scaledEndNormal),
      },
      {
        kind: PathCommandType.LineTo,
        point: startPoint.minus(scaledStartNormal),
      },
    ]).mapPoints((point) => this.viewport.roundPoint(point));

    const preview = new Stroke([pathToRenderable(path, { fill: this.startPoint.color })]);

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
