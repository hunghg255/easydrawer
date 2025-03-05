/* eslint-disable @typescript-eslint/no-unused-vars */
import { Vec2, type IVec3, type Rect2, type Mat33 } from '~/math';

import AbstractRenderer, { type RenderableImage } from './AbstractRenderer';
import type Viewport from '../../Viewport';
import { type TextRendererLocalization } from '../localization';
import type RenderingStyle from '../RenderingStyle';
import type TextRenderingStyle from '../TextRenderingStyle';

// Outputs a description of what was rendered.
export default class TextOnlyRenderer extends AbstractRenderer {
  private descriptionBuilder: string[] = [];
  private pathCount = 0;
  private textNodeCount = 0;
  private imageNodeCount = 0;

  public constructor(
    viewport: Viewport,
    private localizationTable: TextRendererLocalization,
  ) {
    super(viewport);
  }

  public displaySize(): IVec3 {
    // We don't have a graphical display, export a reasonable size.
    return Vec2.of(500, 500);
  }

  public clear(): void {
    this.descriptionBuilder = [];
    this.pathCount = 0;
    this.textNodeCount = 0;
    this.imageNodeCount = 0;
  }

  public getDescription(): string {
    return [
      this.localizationTable.pathNodeCount(this.pathCount),
      ...(this.textNodeCount > 0 ? [this.localizationTable.textNodeCount(this.textNodeCount)] : []),
      ...(this.imageNodeCount > 0
        ? [this.localizationTable.imageNodeCount(this.imageNodeCount)]
        : []),
      ...this.descriptionBuilder,
    ].join('\n');
  }

  protected beginPath(_startPoint: IVec3): void {}
  protected endPath(_style: RenderingStyle): void {
    this.pathCount++;
  }
  protected lineTo(_point: IVec3): void {}
  protected moveTo(_point: IVec3): void {}
  protected traceCubicBezierCurve(_p1: IVec3, _p2: IVec3, _p3: IVec3): void {}
  protected traceQuadraticBezierCurve(_controlPoint: IVec3, _endPoint: IVec3): void {}
  public drawText(text: string, _transform: Mat33, _style: TextRenderingStyle): void {
    this.descriptionBuilder.push(this.localizationTable.textNode(text));
    this.textNodeCount++;
  }
  public drawImage(image: RenderableImage) {
    const label = image.label
      ? this.localizationTable.imageNode(image.label)
      : this.localizationTable.unlabeledImageNode;

    this.descriptionBuilder.push(label);
    this.imageNodeCount++;
  }
  public isTooSmallToRender(rect: Rect2): boolean {
    return rect.maxDimension < 15 / this.getSizeOfCanvasPixelOnScreen();
  }
  public drawPoints(..._points: IVec3[]): void {}
}
