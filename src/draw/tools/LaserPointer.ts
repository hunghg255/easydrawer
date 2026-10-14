import { Color4, PathCommandType, type IVec2, Vec2 } from '~/math';

import BaseTool from './BaseTool';
import type Editor from '../Editor';
import { type PointerEvt } from '../inputEvents';
import { EditorEventType } from '../types';

interface TrailPoint {
  pos: IVec2;
  time: number;
}

export interface LaserPointerStyle {
  readonly color: Color4;
  /** Width of the trail in screen pixels. */
  readonly thickness: number;
}

/** How long (ms) a point of the trail stays visible. */
const trailLifetime = 700;

/**
 * A laser pointer for presenting and teaching: draws a glowing trail that fades
 * away on its own and is never added to the drawing.
 *
 * Works in read-only editors too.
 */
export default class LaserPointer extends BaseTool {
  private trails: TrailPoint[][] = [];
  private currentTrail: TrailPoint[] | null = null;
  private currentPointerId: number | null = null;
  private animating = false;
  private style: LaserPointerStyle;

  public constructor(
    private editor: Editor,
    description: string,
    style: Partial<LaserPointerStyle> = {},
  ) {
    super(editor.notifier, description);
    this.style = {
      color: Color4.fromHex('#ef4444'),
      thickness: 6,
      ...style,
    };
  }

  public override canReceiveInputInReadOnlyEditor() {
    return true;
  }

  public getColor() {
    return this.style.color;
  }

  public setColor(color: Color4) {
    this.style = { ...this.style, color };
    this.noteUpdated();
  }

  public getThickness() {
    return this.style.thickness;
  }

  public setThickness(thickness: number) {
    this.style = { ...this.style, thickness };
    this.noteUpdated();
  }

  private noteUpdated() {
    this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
      kind: EditorEventType.ToolUpdated,
      tool: this,
    });
  }

  public override onPointerDown({ current, allPointers }: PointerEvt): boolean {
    if (allPointers.length !== 1) {
      return false;
    }

    this.currentPointerId = current.id;
    this.currentTrail = [{ pos: current.canvasPos, time: performance.now() }];
    this.trails.push(this.currentTrail);
    this.startAnimation();
    return true;
  }

  public override onPointerMove({ current }: PointerEvt) {
    if (current.id !== this.currentPointerId || !this.currentTrail) return;
    this.currentTrail.push({ pos: current.canvasPos, time: performance.now() });
  }

  public override onPointerUp({ current }: PointerEvt) {
    if (current.id !== this.currentPointerId) return;
    this.currentTrail = null;
    this.currentPointerId = null;
  }

  public override onGestureCancel() {
    this.currentTrail = null;
    this.currentPointerId = null;
  }

  private startAnimation() {
    if (this.animating) return;
    this.animating = true;

    const frame = () => {
      const visible = this.render();
      if (visible) {
        requestAnimationFrame(frame);
      } else {
        this.animating = false;
        this.editor.clearWetInk();
      }
    };
    requestAnimationFrame(frame);
  }

  // Renders the trails. Returns false when there's nothing left to show.
  private render(): boolean {
    const now = performance.now();

    // While the pointer is down, keep the newest point alive so the dot stays visible.
    if (this.currentTrail) {
      const last = this.currentTrail[this.currentTrail.length - 1];
      last.time = now;
    }

    // Trails are ordered oldest → newest: drop expired points from the start. (Trim in
    // place: `currentTrail` must keep referring to the trail being drawn.)
    for (const trail of this.trails) {
      let expired = 0;
      while (expired < trail.length && now - trail[expired].time >= trailLifetime) {
        expired++;
      }
      trail.splice(0, expired);
    }
    this.trails = this.trails.filter((trail) => trail.length > 0);

    this.editor.clearWetInk();
    if (this.trails.length === 0) {
      return false;
    }

    const renderer = this.editor.display.getWetInkRenderer();
    const pixel = this.editor.viewport.getSizeOfPixelOnCanvas();
    const { color, thickness } = this.style;

    renderer.startObject(this.editor.viewport.visibleRect);
    for (let trail of this.trails) {
      if (trail.length === 1) {
        // A single point: draw a dot
        trail = [trail[0], { pos: trail[0].pos.plus(Vec2.of(pixel / 10, 0)), time: trail[0].time }];
      }

      // Split the trail into groups of similar age. Each group is drawn as one
      // polyline, so that overlapping segments don't create darker spots.
      const groupCount = 8;
      const lifeOf = (point: TrailPoint) => Math.max(0, 1 - (now - point.time) / trailLifetime);
      const groupOf = (point: TrailPoint) => Math.min(groupCount - 1, Math.floor(lifeOf(point) * groupCount));

      let groupStart = 0;
      while (groupStart < trail.length - 1) {
        const group = groupOf(trail[groupStart + 1]);
        let groupEnd = groupStart + 1;
        while (groupEnd < trail.length - 1 && groupOf(trail[groupEnd + 1]) === group) {
          groupEnd++;
        }

        const life = Math.max(0.05, lifeOf(trail[groupEnd]));
        const width = thickness * pixel * (0.35 + 0.65 * life);
        const segment = {
          startPoint: trail[groupStart].pos,
          commands: trail.slice(groupStart + 1, groupEnd + 1).map((point) => ({
            kind: PathCommandType.LineTo as const,
            point: point.pos,
          })),
        };

        // Glow
        renderer.drawPath({
          ...segment,
          style: {
            fill: Color4.transparent,
            stroke: { color: color.withAlpha(0.22 * life), width: width * 2.6 },
          },
        });
        // Core
        renderer.drawPath({
          ...segment,
          style: {
            fill: Color4.transparent,
            stroke: { color: color.withAlpha(life), width },
          },
        });

        groupStart = groupEnd;
      }
    }
    renderer.endObject();

    return true;
  }

  public override onDestroy() {
    this.trails = [];
    super.onDestroy();
  }
}
