import { Color4, LineSegment2, Mat33, Path, Rect2, Vec2, type IVec2 } from '~/math';

import AbstractComponent, { componentSVGAttribute } from './AbstractComponent';
import { type ImageComponentLocalization } from './localization';
import type RestyleableComponent from './RestylableComponent';
import { type ComponentStyle, createRestyleComponentCommand } from './RestylableComponent';
import TextComponent from './TextComponent';
import routeOrthogonal, { type RouteEnd, type RouteSide } from './util/routeOrthogonal';
import SerializableCommand from '../commands/SerializableCommand';
import UnresolvedSerializableCommand from '../commands/UnresolvedCommand';
import type Editor from '../Editor';
import type EditorImage from '../image/EditorImage';
import { EditorImageEventType } from '../image/EditorImage';
import { type EditorLocalization } from '../localization';
import type RenderablePathSpec from '../rendering/RenderablePathSpec';
import { pathFromRenderable, pathToRenderable } from '../rendering/RenderablePathSpec';
import type AbstractRenderer from '../rendering/renderers/AbstractRenderer';
import { sketchParts, sketchSeedOf } from '../rendering/sketch';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';
import { assertIsString } from '../util/assertions';

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
  /** Hand-drawn look (like Excalidraw). Default: `false`. */
  sketch?: boolean;
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
  // The last elbow route, and what it was computed from (relative to its start), to skip
  // computing it again when everything around it just moved together.
  private routeCache: { key: number[][]; sides: string; origin: IVec2; route: IVec2[] } | null = null;
  private sketchCache: { key: string; parts: RenderablePathSpec[] } | null = null;
  // The boxes of the ends and where the line touched them, last time (see updateEnds).
  private straightCache: { startBox: Rect2; endBox: Rect2; start: IVec2; end: IVec2 } | null = null;
  // While scheduleUpdate takes this out of the image and adds it back.
  private updatingInImage = false;

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

  /** Where the label is (or would be) drawn: the center of its box. */
  public getLabelCenter(): IVec2 {
    const rect = this.labelRect();
    return rect ? rect.center : this.labelPosition(0, 0);
  }

  /** The size of the label's text (in canvas units). */
  public getLabelFontSize(): number {
    return this.labelStyle.size;
  }

  /** Returns a command that changes the text shown on the line (`''` for none). */
  public setLabel(label: string): SerializableCommand {
    return new Connector.SetLabelCommand(this.getId(), this.getLabel(), label, this);
  }

  private static setLabelCommandId = 'connector-set-label';
  private static SetLabelCommand = class extends UnresolvedSerializableCommand {
    public constructor(
      componentID: string,
      private oldLabel: string,
      private newLabel: string,
      component?: AbstractComponent,
    ) {
      super(Connector.setLabelCommandId, componentID, component);
    }

    private setLabel(editor: Editor, label: string) {
      this.resolveComponent(editor.image);
      const connector = this.component as Connector;
      // The bounding box changes with the label.
      editor.image.updateComponent(connector, () => {
        connector.style = { ...connector.style, label: label || undefined };
      });
      editor.image.queueRerenderOf(connector);
      editor.queueRerender();
    }

    public apply(editor: Editor) {
      this.setLabel(editor, this.newLabel);
    }

    public unapply(editor: Editor) {
      this.setLabel(editor, this.oldLabel);
    }

    public description(_editor: Editor, localizationTable: EditorLocalization) {
      return localizationTable.editedConnectorLabel;
    }

    protected serializeToJSON() {
      return { id: this.componentID, oldLabel: this.oldLabel, newLabel: this.newLabel };
    }

    static {
      SerializableCommand.register(Connector.setLabelCommandId, (json: any, editor: Editor) => {
        assertIsString(json.id);
        assertIsString(json.oldLabel);
        assertIsString(json.newLabel);
        const elem = editor.image.lookupElement(json.id) ?? undefined;
        return new Connector.SetLabelCommand(json.id, json.oldLabel, json.newLabel, elem);
      });
    }
  };

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
    // Finding where the line leaves a shape is slow: when both ends just moved together (e.g.
    // dragged together), move the line with them.
    const boxOf = (end: ConnectorEnd, target: AbstractComponent | null) =>
      target ? target.getBBox() : new Rect2(end.point.x, end.point.y, 0, 0);
    const startBox = boxOf(this.start, startTarget);
    const endBox = boxOf(this.end, endTarget);
    const cache = this.straightCache;
    const tolerance = 1e-6 * Math.max(1, startBox.maxDimension, endBox.maxDimension);
    const offset = cache ? startBox.topLeft.minus(cache.startBox.topLeft) : Vec2.zero;
    const movedTogether =
      !!cache &&
      Vec2.ofXY(startBox.size).eq(cache.startBox.size, tolerance) &&
      Vec2.ofXY(endBox.size).eq(cache.endBox.size, tolerance) &&
      endBox.topLeft.minus(cache.endBox.topLeft).eq(offset, tolerance * 10);

    let newStart: IVec2;
    let newEnd: IVec2;
    if (cache && movedTogether) {
      newStart = Vec2.ofXY(cache.start).plus(offset);
      newEnd = Vec2.ofXY(cache.end).plus(offset);
    } else {
      const startRef = startTarget?.getBBox().center ?? this.start.point;
      const endRef = endTarget?.getBBox().center ?? this.end.point;
      newStart = startTarget ? this.anchorOn(startTarget, endRef) : this.start.point;
      newEnd = endTarget ? this.anchorOn(endTarget, startRef) : this.end.point;
    }
    this.straightCache = { startBox, endBox, start: newStart, end: newEnd };

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

    // Everything relative to the start, to reuse the route when it all just moved.
    const origin = Vec2.ofXY('rect' in startEnd ? startEnd.rect.topLeft : startEnd.point);
    const relative = (r: Rect2) => [r.x - origin.x, r.y - origin.y, r.w, r.h];
    const describeEnd = (end: RouteEnd) =>
      'rect' in end ? relative(end.rect) : relative(new Rect2(end.point.x, end.point.y, 0, 0));
    const sides = `${'side' in startEnd ? startEnd.side ?? '' : ''}|${'side' in endEnd ? endEnd.side ?? '' : ''}|${margin}`;
    const key = [
      describeEnd(startEnd),
      describeEnd(endEnd),
      ...obstacles.map(relative).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]),
    ];
    const cache = this.routeCache;
    // Moving things adds tiny rounding errors.
    const tolerance = margin * 0.01;
    if (
      cache &&
      cache.sides === sides &&
      cache.key.length === key.length &&
      cache.key.every((values, i) => values.every((v, j) => Math.abs(v - key[i][j]) < tolerance))
    ) {
      const offset = origin.minus(cache.origin);
      return cache.route.map((p) => Vec2.ofXY(p).plus(offset));
    }

    const withoutSide = (end: RouteEnd): RouteEnd => ('rect' in end ? { rect: end.rect } : end);
    // If the chosen sides are blocked, use any side.
    const route =
      routeOrthogonal(startEnd, endEnd, obstacles, options) ??
      routeOrthogonal(withoutSide(startEnd), withoutSide(endEnd), obstacles, options);
    this.routeCache = route ? { key, sides, origin, route } : null;
    return route;
  }

  public override onAddToImage(image: EditorImage): void {
    if (this.image !== image) {
      this.image = image;
      image.notifier.on(EditorImageEventType.ComponentAdded, (event) => {
        if (event.kind !== EditorImageEventType.ComponentAdded) return;
        if (event.componentId === this.start.targetId || event.componentId === this.end.targetId) {
          // Right away if the line no longer touches it.
          this.scheduleUpdate(this.style.routing === 'elbow' && this.routeStillFits(image));
          return;
        }

        // Elbow routes go around other components: update when one moves nearby.
        if (this.style.routing === 'elbow' && event.componentId !== this.getId()) {
          const component = image.lookupElement(event.componentId);
          if (component && !(component instanceof Connector) && component.getBBox().intersects(this.getBBox())) {
            // Going around it can wait a moment.
            this.scheduleUpdate(true);
          }
        }
      });
    }

    for (const end of [this.start, this.end]) {
      const target = this.targetOf(end, image);
      if (target) target.keepIdInSVG = true;
    }
    if (this.updatingInImage) {
      // Re-added by scheduleUpdate: already up to date.
    } else if (this.style.routing === 'elbow' && this.route) {
      // Re-added (e.g. after being dragged with the shapes it links): route again once
      // everything else has been added too. Usually the cached route (see computeElbowRoute)
      // can be used then, instead of computing a route around a half-empty image now. If the
      // route still touches both of its shapes (they moved together), it can even wait until
      // the browser is idle (finding routes is slow when many connectors are dropped at once).
      this.scheduleUpdate(this.routeStillFits(image));
    } else {
      this.updateEnds(image);
    }
  }

  // Whether the elbow route still starts and ends at the components it links.
  private routeStillFits(image: ComponentLookup) {
    const route = this.route;
    if (!route || route.length < 2) return false;
    const margin = Math.max(12, this.style.thickness * 8);
    const touches = (end: ConnectorEnd, point: IVec2) => {
      const target = this.targetOf(end, image);
      return target ? target.getBBox().grownBy(margin).containsPoint(point) : Vec2.ofXY(end.point).eq(point, margin);
    };
    return touches(this.start, route[0]) && touches(this.end, route[route.length - 1]);
  }

  // Attached components are re-added to the image when they move (and on undo/redo).
  // Update after the current change, rather than while the image is being modified.
  private scheduleUpdate(whenIdle = false) {
    if (this.updateScheduled) return;
    this.updateScheduled = true;

    const schedule = whenIdle && typeof requestIdleCallback === 'function'
      ? (callback: () => void) => requestIdleCallback(callback, { timeout: 300 })
      : queueMicrotask;
    schedule(() => {
      this.updateScheduled = false;
      const image = this.image;
      if (!image || image.lookupElement(this.getId()) !== this) return;

      // Out of the image while the route (and bounding box) changes, so it's redrawn correctly.
      this.updatingInImage = true;
      try {
        image.updateComponent(this, () => this.updateEnds(image));
      } finally {
        this.updatingInImage = false;
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

  public override getProportionalRenderingTime(): number {
    // The line and arrowheads, and the label (see TextComponent).
    return 4 + (this.style.label ? 8 : 0);
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

    const parts: RenderablePathSpec[] = [
      pathToRenderable(Path.fromString(pathString), {
        fill: Color4.transparent,
        stroke: { color, width: thickness },
      }),
    ];

    const arrowhead = (tip: IVec2, dir: IVec2) => {
      const base = tip.minus(dir.times(arrowSize));
      const side = dir.orthog().times(arrowSize * 0.5);
      const a = base.plus(side);
      const b = base.minus(side);
      return pathToRenderable(Path.fromString(`M${tip.x},${tip.y} L${a.x},${a.y} L${b.x},${b.y} Z`), {
        fill: color,
        stroke: { color, width: Math.min(thickness, 2) },
      });
    };

    if (length > 0) {
      if (hasEndArrow) parts.push(arrowhead(last, endUnit));
      if (hasStartArrow) parts.push(arrowhead(first, startUnit));
    }

    if (this.style.sketch) {
      // Computing the hand-drawn lines is slow: only when the shape of the line changes (not
      // when it just moves, e.g. while dragging).
      const origin = points[0];
      const toLocal = Mat33.translation(origin.times(-1));
      const toCanvas = Mat33.translation(origin);
      const localParts = parts.map((part) => pathToRenderable(pathFromRenderable(part).transformedBy(toLocal), part.style));
      const key = `${localParts.map((part) => part.path.toString()).join('|')}|${color.toHexString()}|${thickness}`;
      if (this.sketchCache?.key !== key) {
        const sketched = sketchParts(localParts, { scale: thickness / 2, seed: sketchSeedOf(this.getId()), fillStyle: 'solid' });
        this.sketchCache = { key, parts: sketched };
      }
      for (const part of this.sketchCache.parts) {
        canvas.drawPath(pathToRenderable(pathFromRenderable(part).transformedBy(toCanvas), part.style));
      }
    } else {
      for (const part of parts) canvas.drawPath(part);
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
    const clone = new Connector(this.start, this.end, this.style);
    // Previews (e.g. while dragging) keep the elbow route until it is computed again.
    clone.route = this.route?.slice() ?? null;
    clone.routeCache = this.routeCache;
    clone.sketchCache = this.sketchCache;
    clone.straightCache = this.straightCache;
    clone.recomputeBBox();
    return clone;
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
      ...(this.style.sketch ? { sketch: true } : {}),
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
      sketch: json.sketch === true,
    });
  }
}

AbstractComponent.registerComponent(componentKind, Connector.deserializeFromJSON);
