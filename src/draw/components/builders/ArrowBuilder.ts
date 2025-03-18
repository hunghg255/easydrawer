import { Path, PathCommandType, type Rect2 } from '~/math';

import makeSnapToGridAutocorrect from './autocorrect/makeSnapToGridAutocorrect';
import { type ComponentBuilder, type ComponentBuilderFactory } from './types';
import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';
import Stroke from '../Stroke';

/**
 * Creates a stroke builder that generates arrows.
 *
 * Example:
 * [[include:doc-pages/inline-examples/changing-pen-types.md]]
 */
export const makeArrowBuilder: ComponentBuilderFactory = makeSnapToGridAutocorrect(
  (initialPoint: StrokeDataPoint, viewport: Viewport) => {
    return new ArrowBuilder(initialPoint, viewport);
  },
);

export default class ArrowBuilder implements ComponentBuilder {
  private endPoint: StrokeDataPoint;

  public constructor(
    private readonly startPoint: StrokeDataPoint,
    private readonly viewport: Viewport,
  ) {
    this.endPoint = startPoint;
  }

  private getLineWidth(): number {
    return Math.max(this.endPoint.width || 5, this.startPoint.width || 5);
  }

  public getBBox(): Rect2 {
    const preview = this.buildPreview();
    return preview.getBBox();
  }

  private buildPreview(): Stroke {
    const lineStartPoint = this.startPoint.pos;
    const endPoint = this.endPoint.pos;
    const toEnd = endPoint.minus(lineStartPoint).normalized();
    const arrowLength = endPoint.distanceTo(lineStartPoint);

    // Round the stroke width so that when exported it doesn't have unnecessary trailing decimals.
    const strokeWidth = this.endPoint.width === 0 ? this.endPoint.width : Viewport.roundPoint(
      this.endPoint.width,
      5 / this.viewport.getScaleFactor(),
    );

    // Ensure that the arrow tip is smaller than the arrow.
    const arrowTipSize = Math.min(strokeWidth + 3, arrowLength / 2);
    const startSize = strokeWidth + 3;
    const endSize = strokeWidth + 3;

    const arrowTipBase = endPoint.minus(toEnd.times(arrowTipSize));

    // Scaled normal vectors.
    const lineNormal = toEnd.orthog();
    const scaledStartNormal = lineNormal.times(startSize);
    const scaledBaseNormal = lineNormal.times(endSize);

    const path = new Path(arrowTipBase.minus(scaledBaseNormal), [
      // Stem
      {
        kind: PathCommandType.LineTo,
        point: lineStartPoint.minus(scaledStartNormal),
      },
      {
        kind: PathCommandType.LineTo,
        point: lineStartPoint.plus(scaledStartNormal),
      },
      {
        kind: PathCommandType.LineTo,
        point: arrowTipBase.plus(scaledBaseNormal),
      },

      // Head
      {
        kind: PathCommandType.LineTo,
        point: arrowTipBase.plus(lineNormal.times(arrowTipSize).plus(scaledBaseNormal)),
      },
      {
        kind: PathCommandType.LineTo,
        point: endPoint.plus(toEnd.times(endSize)),
      },
      {
        kind: PathCommandType.LineTo,
        point: arrowTipBase.plus(lineNormal.times(-arrowTipSize).minus(scaledBaseNormal)),
      },
      {
        kind: PathCommandType.LineTo,
        point: arrowTipBase.minus(scaledBaseNormal),
      },
      // Round all points in the arrow (to remove unnecessary decimal places)
    ]).mapPoints((point) => this.viewport.roundPoint(point));

    const preview = new Stroke([
      {
        startPoint: path.startPoint,
        commands: path.parts,
        style: {
          fill: this.startPoint.color,
          stroke: {
            width: strokeWidth,
            color: strokeWidth === 0 ? this.endPoint.color : this.endPoint.borderColor || this.endPoint.color,
          },
        },
      },
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
