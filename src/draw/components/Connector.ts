import { Color4, LineSegment2, Mat33, Path, Rect2, Vec2, type IVec2 } from '~/math';

import AbstractComponent, { componentSVGAttribute } from './AbstractComponent';
import { type ImageComponentLocalization } from './localization';
import type RestyleableComponent from './RestylableComponent';
import { type ComponentStyle, createRestyleComponentCommand } from './RestylableComponent';
import TextComponent from './TextComponent';
import routeOrthogonal, { type RouteEnd, type RouteSide } from './util/routeOrthogonal';
import type SerializableCommand from '../commands/SerializableCommand';
import type Editor from '../Editor';
import type EditorImage from '../image/EditorImage';
import { EditorImageEventType } from '../image/EditorImage';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type AbstractRenderer from '../rendering/renderers/AbstractRenderer';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';

const componentKind = 'connector';

/**
 * Finds components (an {@link EditorImage}, or a stand-in, e.g. for previews).
 * `getComponentsIntersecting` is needed for `'elbow'` routing around other components.
 */
export type ComponentLookup = Pick<EditorImage, 'lookupElement'> &
  Partial<Pick<EditorImage, 'getComponentsIntersecting'>>;

/** `'straight'`: a straight line. `'elbow'`: horizontal and vertical segments that go around other components. */
export type ConnectorRouting = 'straight' | 'elbow';

/** Where arrowheads are drawn. */
export type ConnectorArrowMode = 'end' | 'both' | 'none';

/** One end of a {@link Connector}. */
export interface ConnectorEnd {
  /** Position, in canvas coordinates. For attached ends, the last computed position. */
  point: IVec2;
  /** ID of the component this end is attached to, if any. */
  targetId?: string;
  /** For `'elbow'` routing: the side of the component the line leaves from/arrives at. Default: the best one. */
  side?: RouteSide;
}

export interface ConnectorStyle {
  color: Color4;
  /** Line width, in canvas units. */
  thickness: number;
  arrow: ConnectorArrowMode;
  /** Text shown in the middle of the line (e.g. "yes"/"no"). */
  label?: string;
  /** Default: `'straight'`. */
  routing?: ConnectorRouting;
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

  // The points of an 'elbow' route, from start to end (null for straight connectors, or
  // before the route is known).
  private route: IVec2[] | null = null;

  /** The points the line goes through, from start to end. */
  public getPoints(): IVec2[] {
    return this.route ?? [this.start.point, this.end.point];
  }

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
    let bbox = Rect2.bboxOf(this.getPoints()).grownBy(margin);
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
    const center = this.labelPosition(width + padding * 2, style.size + padding * 2);
    return new Rect2(
      center.x - width / 2 - padding,
      center.y - style.size / 2 - padding,
      width + padding * 2,
      style.size + padding * 2,
    );
  }

  // Elbow routes: on the first segment (next to where the line leaves, e.g. "yes"/"no" next
  // to a decision) when it is long enough. Otherwise, halfway along the line.
  private labelPosition(width: number, height: number): IVec2 {
    if (this.route && this.route.length > 2) {
      const a = Vec2.ofXY(this.route[0]);
      const b = Vec2.ofXY(this.route[1]);
      const horizontal = Math.abs(a.y - b.y) < 1e-6;
      if (a.distanceTo(b) > (horizontal ? width : height) + this.arrowSize) {
        return a.lerp(b, 0.5);
      }
    }
    return this.pointAtMiddle();
  }

  // The point halfway along the line.
  private pointAtMiddle(): IVec2 {
    const points = this.getPoints().map((p) => Vec2.ofXY(p));
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
    for (const [i, length] of lengths.entries()) {
      if (remaining <= length && length > 0) {
        return points[i].lerp(points[i + 1], remaining / length);
      }
      remaining -= length;
    }
    return points[0];
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

    if (this.style.routing === 'elbow') {
      const route = this.computeElbowRoute(startTarget, endTarget, image);
      if (route) {
        const old = this.route;
        const changed = !old || old.length !== route.length || route.some((p, i) => !Vec2.ofXY(p).eq(old[i], 1e-6));
        this.route = route;
        this.start.point = route[0];
        this.end.point = route[route.length - 1];
        if (changed) this.recomputeBBox();
        return changed;
      }
    }
    if (this.route) {
      this.route = null;
      this.recomputeBBox();
    }

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

  // An 'elbow' route around the components between the ends. `null` if there is none.
  private computeElbowRoute(
    startTarget: AbstractComponent | null,
    endTarget: AbstractComponent | null,
    image: ComponentLookup | null,
  ): IVec2[] | null {
    const toRouteEnd = (end: ConnectorEnd, target: AbstractComponent | null): RouteEnd =>
      target ? { rect: target.getBBox(), side: end.side } : { point: end.point };
    const startEnd = toRouteEnd(this.start, startTarget);
    const endEnd = toRouteEnd(this.end, endTarget);

    const endRects = [startTarget, endTarget].filter((t) => t !== null).map((t) => t.getBBox());
    const area = Rect2.bboxOf([...endRects.flatMap((r) => r.corners), this.start.point, this.end.point]);
    const margin = Math.max(12, this.style.thickness * 8);

    // Other components in the area (except connectors, and things containing an end, like a frame).
    const containsEnd = (r: Rect2) =>
      endRects.some((e) => r.containsRect(e)) ||
      (!startTarget && r.containsPoint(this.start.point)) ||
      (!endTarget && r.containsPoint(this.end.point));
    const searchArea = area.grownBy(area.maxDimension * 0.5 + margin * 4);
    const obstacles = (image?.getComponentsIntersecting?.(searchArea) ?? [])
      .filter((c) => c !== this && c !== startTarget && c !== endTarget && !(c instanceof Connector))
      .filter((c) => c.isSelectable())
      .map((c) => c.getBBox())
      .filter((r) => !containsEnd(r))
      .slice(0, 150);

    const options = { margin, gap: Math.max(4, this.style.thickness * 1.5) };
    const withoutSide = (end: RouteEnd): RouteEnd => ('rect' in end ? { rect: end.rect } : end);
    // If the chosen sides are blocked, use any side.
    return (
      routeOrthogonal(startEnd, endEnd, obstacles, options) ??
      routeOrthogonal(withoutSide(startEnd), withoutSide(endEnd), obstacles, options)
    );
  }

  public override onAddToImage(image: EditorImage): void {
    if (this.image !== image) {
      this.image = image;
      image.notifier.on(EditorImageEventType.ComponentAdded, (event) => {
        if (event.kind !== EditorImageEventType.ComponentAdded) return;
        if (event.componentId === this.start.targetId || event.componentId === this.end.targetId) {
          this.scheduleUpdate();
          return;
        }

        // Elbow routes go around other components: update when one moves nearby.
        if (this.style.routing === 'elbow' && event.componentId !== this.getId()) {
          const component = image.lookupElement(event.componentId);
          if (component && !(component instanceof Connector) && component.getBBox().intersects(this.getBBox())) {
            this.scheduleUpdate();
          }
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

      // Out of the image while the route (and bounding box) changes, so it's redrawn correctly.
      image.updateComponent(this, () => this.updateEnds(image));
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

    const points = this.getPoints().map((p) => Vec2.ofXY(p));
    const { color, thickness, arrow } = this.style;
    const segmentDirection = (from: IVec2, to: IVec2) => {
      const d = to.minus(from);
      return d.magnitude() > 0 ? d.normalized() : Vec2.unitX;
    };
    const first = points[0];
    const last = points[points.length - 1];
    const firstLength = points[1].distanceTo(first);
    const lastLength = last.distanceTo(points[points.length - 2]);
    const startUnit = segmentDirection(points[1], first);
    const endUnit = segmentDirection(points[points.length - 2], last);
    const length = points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(points[i]), 0);
    const arrowSize = Math.min(this.arrowSize, firstLength * 0.9, lastLength * 0.9, length / 2);

    // Shorten the line so it doesn't poke through the arrowheads.
    const hasEndArrow = arrow !== 'none';
    const hasStartArrow = arrow === 'both';
    const linePoints = [...points];
    if (hasStartArrow) linePoints[0] = first.minus(startUnit.times(arrowSize * 0.8));
    if (hasEndArrow) linePoints[linePoints.length - 1] = last.minus(endUnit.times(arrowSize * 0.8));

    // Rounded corners
    const cornerRadius = Math.max(6, thickness * 5);
    let pathString = `M${linePoints[0].x},${linePoints[0].y}`;
    for (let i = 1; i < linePoints.length - 1; i++) {
      const corner = linePoints[i];
      const before = linePoints[i - 1];
      const after = linePoints[i + 1];
      const radius = Math.min(cornerRadius, corner.distanceTo(before) / 2, corner.distanceTo(after) / 2);
      const inPoint = corner.plus(segmentDirection(corner, before).times(radius));
      const outPoint = corner.plus(segmentDirection(corner, after).times(radius));
      pathString += ` L${inPoint.x},${inPoint.y} Q${corner.x},${corner.y} ${outPoint.x},${outPoint.y}`;
    }
    const lineEnd = linePoints[linePoints.length - 1];
    pathString += ` L${lineEnd.x},${lineEnd.y}`;

    canvas.drawPath(
      pathToRenderable(Path.fromString(pathString), {
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
      if (hasEndArrow) drawArrowhead(last, endUnit);
      if (hasStartArrow) drawArrowhead(first, startUnit);
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

  private segments() {
    const points = this.getPoints().map((p) => Vec2.ofXY(p));
    return points.slice(1).map((p, i) => new LineSegment2(points[i], p));
  }

  public override intersects(lineSegment: LineSegment2): boolean {
    // Also count segments that pass very close to the line (it can be thin).
    const radius = this.style.thickness / 2 + 2;
    return this.segments().some(
      (line) =>
        !!line.intersection(lineSegment) ||
        line.distance(lineSegment.p1) <= radius ||
        line.distance(lineSegment.p2) <= radius ||
        lineSegment.distance(line.p1) <= radius ||
        lineSegment.distance(line.p2) <= radius,
    );
  }

  public override intersectsRect(rect: Rect2): boolean {
    if (this.getPoints().some((p) => rect.containsPoint(p))) {
      return true;
    }
    return rect.getEdges().some((edge) => this.intersects(edge));
  }

  public override keyPoints() {
    return this.getPoints();
  }

  protected applyTransformation(affineTransfm: Mat33): void {
    this.start.point = affineTransfm.transformVec2(this.start.point);
    this.end.point = affineTransfm.transformVec2(this.end.point);
    this.route = this.route?.map((p) => affineTransfm.transformVec2(p)) ?? null;
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
      ...(end.side ? { side: end.side } : {}),
    });

    return {
      start: serializeEnd(this.start),
      end: serializeEnd(this.end),
      color: this.style.color.toHexString(),
      thickness: this.style.thickness,
      arrow: this.style.arrow,
      ...(this.style.label ? { label: this.style.label } : {}),
      ...(this.style.routing === 'elbow' ? { routing: 'elbow' } : {}),
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
        side: ['top', 'right', 'bottom', 'left'].includes(data.side) ? data.side : undefined,
      };
    };

    const arrow: ConnectorArrowMode = ['end', 'both', 'none'].includes(json.arrow) ? json.arrow : 'end';
    const thickness = Number(json.thickness);
    return new Connector(parseEnd(json.start), parseEnd(json.end), {
      color: typeof json.color === 'string' ? Color4.fromString(json.color) : Color4.black,
      thickness: isFinite(thickness) && thickness > 0 ? thickness : 2,
      arrow,
      label: typeof json.label === 'string' ? json.label : undefined,
      routing: json.routing === 'elbow' ? 'elbow' : 'straight',
    });
  }
}

AbstractComponent.registerComponent(componentKind, Connector.deserializeFromJSON);
