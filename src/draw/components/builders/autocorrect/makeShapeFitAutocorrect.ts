import { Rect2, LineSegment2, type IVec2 } from '~/math';

import type AbstractRenderer from '../../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../../types';
import type Viewport from '../../../Viewport';
import type AbstractComponent from '../../AbstractComponent';
import { type ComponentBuilder, type ComponentBuilderFactory } from '../types';

function makeShapeFitAutocorrect (sourceFactory: ComponentBuilderFactory): ComponentBuilderFactory {
  return (startPoint: StrokeDataPoint, viewport: Viewport) => {
    return new ShapeFitBuilder(sourceFactory, startPoint, viewport);
  };
}

export default makeShapeFitAutocorrect;

interface ShapeTemplate {
  points: IVec2[];
  toleranceMultiplier?: number;
}

function makeLineTemplate (startPoint: IVec2, points: IVec2[], _bbox: Rect2): ShapeTemplate {
  const templatePoints = [startPoint, points[points.length - 1]];
  return { points: templatePoints };
}

function makeRectangleTemplate (_startPoint: IVec2,
  _points: IVec2[],
  bbox: Rect2): ShapeTemplate {
  return { points: [...bbox.corners, bbox.corners[0]] };
}

class ShapeFitBuilder implements ComponentBuilder {
  private builder: ComponentBuilder;
  private points: StrokeDataPoint[];

  public constructor(
    private sourceFactory: ComponentBuilderFactory,
    private startPoint: StrokeDataPoint,
    private viewport: Viewport,
  ) {
    this.builder = sourceFactory(startPoint, viewport);
    this.points = [startPoint];
  }

  public getBBox(): Rect2 {
    return this.builder.getBBox();
  }

  public build(): AbstractComponent {
    return this.builder.build();
  }

  public preview(renderer: AbstractRenderer) {
    this.builder.preview(renderer);
  }

  public addPoint(point: StrokeDataPoint): void {
    this.points.push(point);
    this.builder.addPoint(point);
  }

  public async autocorrectShape() {
    // Use screen points so that autocorrected shapes rotate with the screen.
    const startPoint = this.viewport.canvasToScreen(this.startPoint.pos);
    const points = this.points.map((point) => this.viewport.canvasToScreen(point.pos));
    const bbox = Rect2.bboxOf(points);

    const snappedStartPoint = this.viewport.canvasToScreen(
      this.viewport.snapToGrid(this.startPoint.pos),
    );
    const snappedPoints = this.points.map((point) =>
      this.viewport.canvasToScreen(this.viewport.snapToGrid(point.pos)),
    );
    const snappedBBox = Rect2.bboxOf(snappedPoints);

    // Only fit larger shapes
    if (bbox.maxDimension < 32) {
      return null;
    }

    const maxError = Math.min(30, bbox.maxDimension / 4);

    // Create templates
    const templates = [
      {
        ...makeLineTemplate(snappedStartPoint, snappedPoints, snappedBBox),
        toleranceMultiplier: 0.5,
      },
      makeLineTemplate(startPoint, points, bbox),
      {
        ...makeRectangleTemplate(snappedStartPoint, snappedPoints, snappedBBox),
        toleranceMultiplier: 0.6,
      },
      makeRectangleTemplate(startPoint, points, bbox),
    ];

    // Find a good fit fit
    const selectTemplate = (maximumAllowedError: number) => {
      for (const template of templates) {
        const templatePoints = template.points;

        // Maximum square error to accept the template
        const acceptMaximumSquareError =
					maximumAllowedError * maximumAllowedError * (template.toleranceMultiplier ?? 1);

        // Gets the point at index, wrapping the the start of the template if
        // outside the array of points.
        const templateAt = (index: number) => {
          while (index < 0) {
            index += templatePoints.length;
          }

          index %= templatePoints.length;
          return templatePoints[index];
        };

        let closestToFirst: IVec2 | null = null;
        let closestToFirstSqrDist = Infinity;
        let templateStartIndex = 0;

        // Find the closest point to the startPoint
        for (const [i, current] of templatePoints.entries()) {
          const currentSqrDist = current.squareDistanceTo(startPoint);
          if (!closestToFirst || currentSqrDist < closestToFirstSqrDist) {
            closestToFirstSqrDist = currentSqrDist;
            closestToFirst = current;
            templateStartIndex = i;
          }
        }

        // Walk through the points and find the maximum error
        let maximumSqrError = 0;
        let templateIndex = templateStartIndex;
        for (const point of points) {
          let minimumCurrentSqrError = Infinity;
          let minimumErrorAtIndex = templateIndex;

          const windowRadius = 6;
          for (let i = -windowRadius; i <= windowRadius; i++) {
            const index = templateIndex + i;

            const prevTemplatePoint = templateAt(index - 1);
            const currentTemplatePoint = templateAt(index);
            const nextTemplatePoint = templateAt(index + 1);

            const prevToCurrent = new LineSegment2(prevTemplatePoint, currentTemplatePoint);
            const currentToNext = new LineSegment2(currentTemplatePoint, nextTemplatePoint);

            const prevToCurrentDist = prevToCurrent.distance(point);
            const nextToCurrentDist = currentToNext.distance(point);

            const error = Math.min(prevToCurrentDist, nextToCurrentDist);
            const squareError = error * error;

            if (squareError < minimumCurrentSqrError) {
              minimumCurrentSqrError = squareError;
              minimumErrorAtIndex = index;
            }
          }

          templateIndex = minimumErrorAtIndex;
          maximumSqrError = Math.max(minimumCurrentSqrError, maximumSqrError);

          if (maximumSqrError > acceptMaximumSquareError) {
            break;
          }
        }

        if (maximumSqrError < acceptMaximumSquareError) {
          return templatePoints;
        }
      }

      return null;
    };

    const template = selectTemplate(maxError);

    if (!template) {
      return null;
    }

    const lastDataPoint = this.points[this.points.length - 1];
    const startWidth = this.startPoint.width;
    const endWidth = lastDataPoint.width;
    const startColor = this.startPoint.color;
    const endColor = lastDataPoint.color;
    const startTime = this.startPoint.time;
    const endTime = lastDataPoint.time;

    const templateIndexToStrokeDataPoint = (index: number): StrokeDataPoint => {
      const prevPoint = template[Math.max(0, Math.floor(index))];
      const nextPoint = template[Math.min(Math.ceil(index), template.length - 1)];
      const point = prevPoint.lerp(nextPoint, index - Math.floor(index));
      const fractionToEnd = index / template.length;

      return {
        pos: this.viewport.screenToCanvas(point),
        width: startWidth * (1 - fractionToEnd) + endWidth * fractionToEnd,
        color: startColor.mix(endColor, fractionToEnd),
        time: startTime * (1 - fractionToEnd) + endTime * fractionToEnd,
      };
    };

    const builder = this.sourceFactory(templateIndexToStrokeDataPoint(0), this.viewport);

    // Prevent the original builder from doing stroke smoothing if the template is short
    // enough to likely have sharp corners.
    const preventSmoothing = template.length < 10;

    for (let i = 0; i < template.length; i++) {
      if (preventSmoothing) {
        builder.addPoint(templateIndexToStrokeDataPoint(i - 0.001));
      }
      builder.addPoint(templateIndexToStrokeDataPoint(i));
      if (preventSmoothing) {
        builder.addPoint(templateIndexToStrokeDataPoint(i + 0.001));
      }
    }

    return builder.build();
  }
}
