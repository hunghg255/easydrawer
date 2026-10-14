import { Color4, LineSegment2, Mat33, Path, Rect2, Vec2, type IVec2 } from '~/math';

import AbstractComponent, { componentSVGAttribute } from './AbstractComponent';
import { type ImageComponentLocalization } from './localization';
import type RestyleableComponent from './RestylableComponent';
import { type ComponentStyle, createRestyleComponentCommand } from './RestylableComponent';
import TextComponent from './TextComponent';
import type SerializableCommand from '../commands/SerializableCommand';
import type Editor from '../Editor';
import type EditorImage from '../image/EditorImage';
import { EditorImageEventType } from '../image/EditorImage';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type AbstractRenderer from '../rendering/renderers/AbstractRenderer';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';

const componentKind = 'connector';

/** Finds components by ID (an {@link EditorImage}, or a stand-in, e.g. for previews). */
export type ComponentLookup = Pick<EditorImage, 'lookupElement'>;

/** Where arrowheads are drawn. */
export type ConnectorArrowMode = 'end' | 'both' | 'none';

/** One end of a {@link Connector}. */
export interface ConnectorEnd {
  /** Position, in canvas coordinates. For attached ends, the last computed position. */
  point: IVec2;
  /** ID of the component this end is attached to, if any. */
  targetId?: string;
}

export interface ConnectorStyle {
  color: Color4;
  /** Line width, in canvas units. */
  thickness: number;
  arrow: ConnectorArrowMode;
  /** Text shown in the middle of the line (e.g. "yes"/"no"). */
  label?: string;
}

/**
 * A straight line or arrow whose ends can be attached to other components (shapes,
 * sticky notes, text…). Attached ends follow the components when they move.
 *
 * Created with the `'connector'` tool.
 */
export default class Connector extends AbstractComponent implements RestyleableComponent {
  protected contentBBox: Rect2 = Rect2.empty;
  public readonly isRestylableComponent = true;

  private start: ConnectorEnd;
  private end: ConnectorEnd;
  private style: ConnectorStyle;

  private image: EditorImage | null = null;
  private updateScheduled = false;

  public constructor(start: ConnectorEnd, end: ConnectorEnd, style: Partial<ConnectorStyle> = {}) {
    super(componentKind);
    this.start = { ...start };
    this.end = { ...end };
    this.style = {
      color: Color4.black,
      thickness: 2,
      arrow: 'end',
      ...style,
    };
    this.recomputeBBox();
  }

  /** @returns true if at least one end is attached to a component. */
  public isAttached() {
    return !!(this.start.targetId || this.end.targetId);
  }

  /** @returns true if an end is attached to the component with the given ID. */
  public isAttachedTo(id: string) {
    return this.start.targetId === id || this.end.targetId === id;
  }

  public getStart(): ConnectorEnd {
    return { ...this.start };
  }

  public getEnd(): ConnectorEnd {
    return { ...this.end };
  }

  public getConnectorStyle(): ConnectorStyle {
    return { ...this.style };
  }

  private get arrowSize() {
    return Math.max(10, this.style.thickness * 4);
  }

  private recomputeBBox() {
    const margin = this.arrowSize + this.style.thickness;
    let bbox = Rect2.bboxOf([this.start.point, this.end.point]).grownBy(margin);
    const labelRect = this.labelRect();
    if (labelRect) {
      bbox = bbox.union(labelRect);
    }
    this.contentBBox = bbox;
  }

  private get labelStyle(): TextRenderingStyle {
    return {
      size: Math.max(12, this.style.thickness * 6),
      fontFamily: 'sans-serif',
      renderingStyle: { fill: this.style.color },
    };
  }

  // The label's background rectangle, centered on the line.
  private labelRect(): Rect2 | null {
    const label = this.style.label;
    if (!label) return null;

    const style = this.labelStyle;
    const width = TextComponent.measureTextWidth(label, style);
    const padding = style.size * 0.35;
    const center = Vec2.ofXY(this.start.point).lerp(Vec2.ofXY(this.end.point), 0.5);
    return new Rect2(
      center.x - width / 2 - padding,
      center.y - style.size / 2 - padding,
      width + padding * 2,
      style.size + padding * 2,
    );
  }

  public getLabel(): string {
    return this.style.label ?? '';
  }

  // Returns the component an end is attached to, if it's in the image.
  private targetOf(end: ConnectorEnd, image: ComponentLookup | null) {
    if (!end.targetId || !image) return null;
    const target = image.lookupElement(end.targetId);
    return target && target !== this ? target : null;
  }

  /**
   * Where a line from the center of `target` towards `towards` leaves the target's bounding box,
   * plus a small gap.
   */
  private anchorOn(target: AbstractComponent, towards: IVec2): IVec2 {
    const bbox = target.getBBox();
    const center = bbox.center;
    const direction = Vec2.ofXY(towards).minus(center);
    if (direction.magnitude() < 1e-6) {
      return center;
    }

    const tx = direction.x === 0 ? Infinity : bbox.w / 2 / Math.abs(direction.x);
    const ty = direction.y === 0 ? Infinity : bbox.h / 2 / Math.abs(direction.y);
    const unit = direction.normalized();
    // Just outside the bounding box
    const edgePoint = center.plus(direction.times(Math.min(tx, ty, 1))).plus(unit);

    // Move inwards to the component's outline (e.g. for circles), with a binary search
    // for the shortest segment from `edgePoint` towards the center that touches it.
    const towardsCenter = (t: number) => edgePoint.plus(center.minus(edgePoint).times(t));
    let boundary = edgePoint;
    if (target.intersects(new LineSegment2(edgePoint, center))) {
      let low = 0;
      let high = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        if (target.intersects(new LineSegment2(edgePoint, towardsCenter(mid)))) {
          high = mid;
        } else {
          low = mid;
        }
      }
      boundary = towardsCenter(high);
    }

    const gap = Math.max(4, this.style.thickness * 1.5);
    return boundary.plus(unit.times(gap));
  }

  /**
   * Moves attached ends to the current position of their components.
   * @returns true if an end moved.
   */
  public updateEnds(image: ComponentLookup | null = this.image): boolean {
    const startTarget = this.targetOf(this.start, image);
    const endTarget = this.targetOf(this.end, image);

    // Each end points towards the center of the other end's component (or the other end).
    const startRef = startTarget?.getBBox().center ?? this.start.point;
    const endRef = endTarget?.getBBox().center ?? this.end.point;
    const newStart = startTarget ? this.anchorOn(startTarget, endRef) : this.start.point;
    const newEnd = endTarget ? this.anchorOn(endTarget, startRef) : this.end.point;

    const changed =
      !Vec2.ofXY(newStart).eq(this.start.point, 1e-6) || !Vec2.ofXY(newEnd).eq(this.end.point, 1e-6);
    this.start.point = newStart;
    this.end.point = newEnd;
    if (changed) {
      this.recomputeBBox();
    }
    return changed;
  }

  public override onAddToImage(image: EditorImage): void {
    if (this.image !== image) {
      this.image = image;
      image.notifier.on(EditorImageEventType.ComponentAdded, (event) => {
        if (event.kind !== EditorImageEventType.ComponentAdded) return;
        if (event.componentId === this.start.targetId || event.componentId === this.end.targetId) {
          this.scheduleUpdate();
        }
      });
    }

    for (const end of [this.start, this.end]) {
      const target = this.targetOf(end, image);
      if (target) target.keepIdInSVG = true;
    }
    this.updateEnds(image);
  }

  // Attached components are re-added to the image when they move (and on undo/redo).
  // Update after the current change, rather than while the image is being modified.
  private scheduleUpdate() {
    if (this.updateScheduled) return;
    this.updateScheduled = true;

    queueMicrotask(() => {
      this.updateScheduled = false;
      const image = this.image;
      if (!image || image.lookupElement(this.getId()) !== this) return;

      if (this.updateEnds(image)) {
        image.queueRerenderOf(this);
      }
    });
  }

  public override remapReferences(idMap: Map<string, string>): void {
    for (const end of [this.start, this.end]) {
      if (end.targetId) {
        end.targetId = idMap.get(end.targetId);
      }
    }
    this.scheduleUpdate();
  }

  public override render(canvas: AbstractRenderer, _visibleRect?: Rect2): void {
    canvas.startObject(this.contentBBox);

    const start = Vec2.ofXY(this.start.point);
    const end = Vec2.ofXY(this.end.point);
    const direction = end.minus(start);
    const length = direction.magnitude();
    const { color, thickness, arrow } = this.style;
    const unit = length > 0 ? direction.times(1 / length) : Vec2.unitX;
    const arrowSize = Math.min(this.arrowSize, length / 2);

    // Shorten the line so it doesn't poke through the arrowheads.
    const hasEndArrow = arrow !== 'none';
    const hasStartArrow = arrow === 'both';
    const lineStart = hasStartArrow ? start.plus(unit.times(arrowSize * 0.8)) : start;
    const lineEnd = hasEndArrow ? end.minus(unit.times(arrowSize * 0.8)) : end;

    canvas.drawPath(
      pathToRenderable(Path.fromString(`M${lineStart.x},${lineStart.y} L${lineEnd.x},${lineEnd.y}`), {
        fill: Color4.transparent,
        stroke: { color, width: thickness },
      }),
    );

    const drawArrowhead = (tip: IVec2, dir: IVec2) => {
      const base = tip.minus(dir.times(arrowSize));
      const side = dir.orthog().times(arrowSize * 0.5);
      const a = base.plus(side);
      const b = base.minus(side);
      canvas.drawPath(
        pathToRenderable(Path.fromString(`M${tip.x},${tip.y} L${a.x},${a.y} L${b.x},${b.y} Z`), {
          fill: color,
          stroke: { color, width: Math.min(thickness, 2) },
        }),
      );
    };

    if (length > 0) {
      if (hasEndArrow) drawArrowhead(end, unit);
      if (hasStartArrow) drawArrowhead(start, unit.times(-1));
    }

    const labelRect = this.labelRect();
    if (labelRect) {
      // A background behind the text hides the line.
      canvas.fillRect(labelRect, Color4.ofRGBA(1, 1, 1, 0.92));
      const style = this.labelStyle;
      const padding = style.size * 0.35;
      // pushTransform also draws the paths above, so they stay below the text.
      canvas.pushTransform(Mat33.identity);
      canvas.drawText(
        this.style.label!,
        Mat33.translation(Vec2.of(labelRect.x + padding, labelRect.y + padding + style.size * 0.8)),
        style,
      );
      canvas.popTransform();
    }

    canvas.endObject(this.getLoadSaveData());
  }

  public override intersects(lineSegment: LineSegment2): boolean {
    const line = new LineSegment2(Vec2.ofXY(this.start.point), Vec2.ofXY(this.end.point));
    if (line.intersection(lineSegment)) {
      return true;
    }

    // Also count segments that pass very close to the line (it can be thin).
    const radius = this.style.thickness / 2 + 2;
    return (
      line.distance(lineSegment.p1) <= radius ||
      line.distance(lineSegment.p2) <= radius ||
      lineSegment.distance(line.p1) <= radius ||
      lineSegment.distance(line.p2) <= radius
    );
  }

  public override intersectsRect(rect: Rect2): boolean {
    if (rect.containsPoint(this.start.point) || rect.containsPoint(this.end.point)) {
      return true;
    }
    return rect.getEdges().some((edge) => this.intersects(edge));
  }

  public override keyPoints() {
    return [this.start.point, this.end.point];
  }

  protected applyTransformation(affineTransfm: Mat33): void {
    this.start.point = affineTransfm.transformVec2(this.start.point);
    this.end.point = affineTransfm.transformVec2(this.end.point);
    this.recomputeBBox();
    this.scheduleUpdate();
  }

  public getStyle(): ComponentStyle {
    return { color: this.style.color };
  }

  public updateStyle(style: ComponentStyle): SerializableCommand {
    return createRestyleComponentCommand(this.getStyle(), style, this);
  }

  public forceStyle(style: ComponentStyle, editor: Editor | null): void {
    if (!style.color) return;
    this.style = { ...this.style, color: style.color };

    if (editor) {
      editor.image.queueRerenderOf(this);
      editor.queueRerender();
    }
  }

  protected override getEasydrawerSVGAttributes(): Array<[string, string]> {
    const json = { name: componentKind, id: this.getId(), zIndex: this.getZIndex(), data: this.serializeToJSON() };
    return [...super.getEasydrawerSVGAttributes(), [componentSVGAttribute, JSON.stringify(json)]];
  }

  public description(localizationTable: ImageComponentLocalization): string {
    return localizationTable.connector;
  }

  protected createClone(): AbstractComponent {
    return new Connector(this.start, this.end, this.style);
  }

  protected serializeToJSON() {
    const serializeEnd = (end: ConnectorEnd) => ({
      point: [end.point.x, end.point.y],
      ...(end.targetId ? { target: end.targetId } : {}),
    });

    return {
      start: serializeEnd(this.start),
      end: serializeEnd(this.end),
      color: this.style.color.toHexString(),
      thickness: this.style.thickness,
      arrow: this.style.arrow,
      ...(this.style.label ? { label: this.style.label } : {}),
    };
  }

  public static deserializeFromJSON(json: any): Connector {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    const parseEnd = (data: any): ConnectorEnd => {
      const x = Number(data?.point?.[0]);
      const y = Number(data?.point?.[1]);
      if (!isFinite(x) || !isFinite(y)) {
        throw new TypeError(`Invalid connector end: ${JSON.stringify(data)}`);
      }
      return {
        point: Vec2.of(x, y),
        targetId: typeof data.target === 'string' ? data.target : undefined,
      };
    };

    const arrow: ConnectorArrowMode = ['end', 'both', 'none'].includes(json.arrow) ? json.arrow : 'end';
    const thickness = Number(json.thickness);
    return new Connector(parseEnd(json.start), parseEnd(json.end), {
      color: typeof json.color === 'string' ? Color4.fromString(json.color) : Color4.black,
      thickness: isFinite(thickness) && thickness > 0 ? thickness : 2,
      arrow,
      label: typeof json.label === 'string' ? json.label : undefined,
    });
  }
}

AbstractComponent.registerComponent(componentKind, Connector.deserializeFromJSON);
