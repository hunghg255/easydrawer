import { type Mat33, type Rect2, type IVec2, Vec2,  } from '~/math';

import AbstractRenderer, { type RenderableImage } from './AbstractRenderer';
import type Viewport from '../../Viewport';
import type RenderingStyle from '../RenderingStyle';
import type TextRenderingStyle from '../TextRenderingStyle';

// Renderer that outputs almost nothing. Useful for automated tests.
export default class DummyRenderer extends AbstractRenderer {
  // Variables that track the state of what's been rendered
  public clearedCount = 0;
  public renderedPathCount = 0;
  public lastFillStyle: RenderingStyle | null = null;
  public lastPoint: IVec2 | null = null;
  public objectNestingLevel = 0;
  public lastText: string | null = null;
  public lastImage: RenderableImage | null = null;

  // List of points drawn since the last clear.
  public pointBuffer: IVec2[] = [];

  public constructor(viewport: Viewport) {
    super(viewport);
  }

  public displaySize(): IVec2 {
    // Do we have a stored viewport size?
    const viewportSize = this.getViewport().getScreenRectSize();

    // Don't use a 0x0 viewport — DummyRenderer is often used
    // for tests that run without a display, so pretend we have a
    // reasonable-sized display.
    if (viewportSize.x === 0 || viewportSize.y === 0) {
      return Vec2.of(640, 480);
    }

    return viewportSize;
  }

  public clear() {
    this.clearedCount++;
    this.renderedPathCount = 0;
    this.pointBuffer = [];
    this.lastText = null;
    this.lastImage = null;

    // Ensure all objects finished rendering
    if (this.objectNestingLevel > 0) {
      throw new Error(`Within an object while clearing! Nesting level: ${this.objectNestingLevel}`);
    }
  }

  protected beginPath(startPoint: IVec2) {
    this.lastPoint = startPoint;
    this.pointBuffer.push(startPoint);
  }

  protected endPath(style: RenderingStyle) {
    this.renderedPathCount++;
    this.lastFillStyle = style;
  }

  protected lineTo(point: IVec2) {
    point = this.canvasToScreen(point);

    this.lastPoint = point;
    this.pointBuffer.push(point);
  }

  protected moveTo(point: IVec2) {
    point = this.canvasToScreen(point);

    this.lastPoint = point;
    this.pointBuffer.push(point);
  }

  protected traceCubicBezierCurve(p1: IVec2, p2: IVec2, p3: IVec2) {
    p1 = this.canvasToScreen(p1);
    p2 = this.canvasToScreen(p2);
    p3 = this.canvasToScreen(p3);

    this.lastPoint = p3;
    this.pointBuffer.push(p1, p2, p3);
  }

  protected traceQuadraticBezierCurve(controlPoint: IVec2, endPoint: IVec2) {
    controlPoint = this.canvasToScreen(controlPoint);
    endPoint = this.canvasToScreen(endPoint);

    this.lastPoint = endPoint;
    this.pointBuffer.push(controlPoint, endPoint);
  }

  public drawPoints(..._points: IVec2[]) {
    // drawPoints is intended for debugging.
    // As such, it is unlikely to be the target of automated tests.
  }

  public drawText(text: string, _transform: Mat33, _style: TextRenderingStyle): void {
    this.lastText = text;
  }

  public drawImage(image: RenderableImage) {
    this.lastImage = image;
  }

  public override startObject(boundingBox: Rect2, _clip: boolean) {
    super.startObject(boundingBox);

    this.objectNestingLevel += 1;
  }

  public override endObject() {
    super.endObject();

    this.objectNestingLevel -= 1;
  }

  public isTooSmallToRender(_rect: Rect2): boolean {
    return false;
  }

  public override canRenderFromWithoutDataLoss(other: AbstractRenderer) {
    return other instanceof DummyRenderer;
  }

  public override renderFromOtherOfSameType(transform: Mat33, other: AbstractRenderer): void {
    if (!(other instanceof DummyRenderer)) {
      throw new TypeError(`${other} cannot be rendered onto ${this}`);
    }

    this.renderedPathCount += other.renderedPathCount;
    this.lastFillStyle = other.lastFillStyle;
    this.lastPoint = other.lastPoint;
    this.pointBuffer.push(
      ...other.pointBuffer.map((point) => {
        return transform.transformVec2(point);
      }),
    );
  }

  public override toString() {
    return '[DummyRenderer]';
  }
}
