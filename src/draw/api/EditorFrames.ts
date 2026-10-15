import { Color4, Mat33, Path, Rect2, Vec2 } from '~/math';

import uniteCommands from '../commands/uniteCommands';
import type AbstractComponent from '../components/AbstractComponent';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import CanvasRenderer from '../rendering/renderers/CanvasRenderer';
import Viewport from '../Viewport';

/** A frame: a named area of the drawing, e.g. a slide of a presentation. */
export interface Frame {
  /** The ID of the frame's border. */
  id: string;
  title: string;
  /** The area of the frame, in canvas coordinates. */
  rect: Rect2;
  /** The frame's border and title. */
  parts: AbstractComponent[];
}

/**
 * Frames: named areas of the drawing, used as slides with {@link goTo} (to present a board one
 * part at a time) and exported as images with {@link toDataURL}. Available as `editor.frames`.
 *
 * A frame is a rectangle with a title above it (grouped, and saved with the drawing).
 *
 * @example
 * ```ts
 * await editor.frames.add({ title: 'Intro' }); // the visible area
 * await editor.frames.addAroundSelection();
 * const frames = editor.frames.list();
 * await editor.frames.goTo(frames[0]);
 * ```
 */
export default class EditorFrames {
  public constructor(private editor: Editor) {}

  private get scale() {
    return this.editor.viewport.getSizeOfPixelOnCanvas();
  }

  /** All frames, in the order they were added. */
  public list(): Frame[] {
    const all = this.editor.image.getAllComponents();
    const borders = all.filter((c) => c instanceof Stroke && c.getMetadata().frame !== undefined);
    const frames = borders.map((border) => {
      const groupId = border.getGroupId();
      const parts = groupId === null ? [border] : all.filter((c) => c.getGroupId() === groupId);
      const title = parts.find((c): c is TextComponent => c instanceof TextComponent)?.getText() ?? border.getMetadata().frame;
      // The border is drawn on the edge of the frame: half its width is outside.
      return { id: border.getId(), title, rect: border.getBBox(), parts, order: Number(border.getMetadata().frameOrder) || 0 };
    });
    frames.sort((a, b) => a.order - b.order || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    return frames.map(({ order: _order, ...frame }) => frame);
  }

  /**
   * Adds a frame around `rect` (by default, most of the visible area), in one undoable step.
   *
   * @returns the new frame.
   */
  public async add(options: { rect?: Rect2; title?: string } = {}): Promise<Frame> {
    const editor = this.editor;
    const scale = this.scale;
    const visible = editor.viewport.visibleRect;
    const rect = options.rect ?? visible.grownBy(-Math.min(visible.w, visible.h) * 0.08);
    const existing = this.list();
    // Frames are listed in the order they were added.
    const order = Date.now();
    const title = (options.title ?? `Frame ${existing.length + 1}`).slice(0, 80) || `Frame ${existing.length + 1}`;

    // Below everything else.
    const bottom = Math.min(0, ...editor.image.getAllComponents().map((c) => c.getZIndex()));
    const border = new Stroke(
      [
        pathToRenderable(
          Path.fromString(`M${rect.x},${rect.y} L${rect.x + rect.w},${rect.y} L${rect.x + rect.w},${rect.y + rect.h} L${rect.x},${rect.y + rect.h} Z`),
          { fill: Color4.transparent, stroke: { color: Color4.fromHex('#94a3b8'), width: 1.5 * scale } },
        ),
      ],
      bottom - 1,
    );
    const groupId = `group-${border.getId()}`;
    border.setGroupDirectly(groupId);
    border.setMetadata({ frame: title, frameOrder: String(order) });

    const label = TextComponent.fromLines(
      [title],
      Mat33.translation(Vec2.of(rect.x, rect.y - 8 * scale)),
      { size: 15 * scale, fontFamily: 'sans-serif', fontWeight: 'bold', renderingStyle: { fill: Color4.fromHex('#64748b') } },
    );
    label.setGroupDirectly(groupId);

    await editor.dispatch(uniteCommands([EditorImage.addComponent(border), EditorImage.addComponent(label)]));
    return { id: border.getId(), title, rect: border.getBBox(), parts: [border, label] };
  }

  /** Adds a frame around the selected items (with some space around them). */
  public async addAroundSelection(options: { title?: string; padding?: number } = {}): Promise<Frame> {
    const items = this.editor.selection.items;
    if (items.length === 0) {
      throw new Error('Nothing is selected.');
    }
    const box = Rect2.union(...items.map((c) => c.getBBox()));
    const frame = await this.add({ rect: box.grownBy((options.padding ?? 32) * this.scale), title: options.title });
    this.editor.selection.clear();
    return frame;
  }

  /** Everything inside `frame` (except its border and title). */
  public contentsOf(frame: Frame): AbstractComponent[] {
    const parts = new Set(frame.parts);
    return this.editor.image
      .getComponentsIntersecting(frame.rect)
      .filter((c) => !parts.has(c) && frame.rect.containsRect(c.getBBox()));
  }

  private find(frame: Frame | number) {
    const frames = this.list();
    const found = typeof frame === 'number' ? frames[frame] : frames.find((f) => f.id === frame.id);
    if (!found) {
      throw new Error('No such frame.');
    }
    return found;
  }

  /**
   * Moves and zooms the view so that `frame` (or the frame at this index of {@link list})
   * fills the screen. Not part of the undo history.
   */
  public async goTo(frame: Frame | number, options: { padding?: number } = {}) {
    const editor = this.editor;
    const rect = this.find(frame).rect;
    const viewport = editor.viewport;
    const screen = viewport.getScreenRectSize();
    const padding = options.padding ?? 0;
    const zoom = Math.min((screen.x - padding * 2) / rect.w, (screen.y - padding * 2) / rect.h);
    const target = Mat33.translation(screen.times(0.5))
      .rightMul(Mat33.scaling2D(zoom))
      .rightMul(Mat33.translation(rect.center.times(-1)));
    const delta = viewport.canvasToScreenTransform.inverse().rightMul(target);
    await editor.dispatchNoAnnounce(Viewport.transformBy(delta), false);
  }

  /**
   * An image of what is inside `frame`, as a data URL (PNG by default).
   *
   * @param options.pixelRatio image pixels per canvas unit at the current zoom (default: 2).
   * @param options.background the background color (default: white).
   */
  public toDataURL(
    frame: Frame | number,
    options: { format?: 'image/png' | 'image/jpeg' | 'image/webp'; pixelRatio?: number; background?: string } = {},
  ): string {
    const rect = this.find(frame).rect;
    const viewport = new Viewport(() => {});
    // Canvas units → image pixels, at the current zoom.
    const zoom = 1 / this.scale;
    viewport.updateScreenSize(rect.size.times(zoom));
    viewport.resetTransform(Mat33.scaling2D(zoom).rightMul(Mat33.translation(rect.topLeft.times(-1))));

    const pixelRatio = options.pixelRatio ?? 2;
    const size = rect.size.times(zoom * pixelRatio);
    const maxSize = 8000;
    const canvasSize = size.maximumEntryMagnitude() > maxSize ? size.times(maxSize / size.maximumEntryMagnitude()) : size;
    const { element: canvas, renderer } = CanvasRenderer.fromViewport(viewport, {
      canvasSize: Vec2.of(Math.max(1, Math.round(canvasSize.x)), Math.max(1, Math.round(canvasSize.y))),
    });

    const context = canvas.getContext('2d')!;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = options.background ?? '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    this.editor.image.renderAll(renderer);
    return canvas.toDataURL(options.format ?? 'image/png');
  }
}
