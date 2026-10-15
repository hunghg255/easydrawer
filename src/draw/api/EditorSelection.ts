import { type IVec2, Mat33, Rect2, Vec2 } from '~/math';

import { type ColorInput, toColor4 } from './options';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import AbstractComponent from '../components/AbstractComponent';
import Connector from '../components/Connector';
import { isRestylableComponent } from '../components/RestylableComponent';
import StickyNote from '../components/StickyNote';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import type SelectionTool from '../tools/SelectionTool/SelectionTool';
import { EditorEventType } from '../types';

/** A direction on the screen, for {@link EditorSelection.addConnected} and {@link EditorSelection.selectConnected}. */
export type FlowDirection = 'right' | 'down' | 'left' | 'up';

const flowDirections: Record<FlowDirection, IVec2> = {
  right: Vec2.of(1, 0),
  down: Vec2.of(0, 1),
  left: Vec2.of(-1, 0),
  up: Vec2.of(0, -1),
};
const oppositeSides: Record<FlowDirection, FlowDirection> = { right: 'left', down: 'up', left: 'right', up: 'down' };
const sideNames: Record<FlowDirection, 'right' | 'bottom' | 'left' | 'top'> = {
  right: 'right',
  down: 'bottom',
  left: 'left',
  up: 'top',
};

/**
 * Reads and changes what is selected with the `'select'` tool. Available as `editor.selection`.
 *
 * All changes can be undone.
 *
 * @example
 * ```ts
 * editor.selection.onChange(() => {
 *   const rect = editor.selection.getScreenRect(); // to place a floating toolbar
 * });
 * editor.selection.setColor('red');
 * editor.selection.bringToFront();
 * editor.selection.lock();
 * ```
 */
export default class EditorSelection {
  public constructor(private editor: Editor) {}

  private get tool(): SelectionTool {
    return this.editor.toolController.getToolByName('select') as SelectionTool;
  }

  /** The selected components, from bottom to top. */
  public get items(): AbstractComponent[] {
    return this.tool.getSelectedObjects();
  }

  public get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Selects `components` (switching to the select tool). Locked components are skipped. */
  public set(components: AbstractComponent[]) {
    this.tool.setEnabled(true);
    this.tool.setSelection(components);
  }

  /**
   * Edits the text of the selected item: a sticky note or text, the label of an arrow, or the
   * text of a shape (added centered in it if it has none). Like a double click with the select
   * tool.
   *
   * @returns whether there was something to edit.
   */
  public editText(): boolean {
    const items = this.items;
    if (new Set(items.map((item) => item.getGroupId() ?? item.getId())).size !== 1) return false;
    // Notes and texts first (e.g. the text of a shape and its outline are selected together).
    const priority = (item: AbstractComponent) => (item instanceof StickyNote ? 0 : item instanceof TextComponent ? 1 : 2);
    for (const item of [...items].sort((a, b) => priority(a) - priority(b))) {
      if (this.tool.editTextOf(item)) return true;
    }
    return false;
  }

  // The main shape of the selection, if it is one shape or note (with its text…): the
  // biggest shape or note.
  private selectedShape(): AbstractComponent | null {
    const items = this.items;
    if (new Set(items.map((item) => item.getGroupId() ?? item.getId())).size !== 1) return null;
    const shapes = items.filter(
      (item) => item instanceof StickyNote || (item instanceof Stroke && item.getMetadata().frame === undefined),
    );
    const area = (item: AbstractComponent) => item.getBBox().area;
    return shapes.sort((a, b) => area(b) - area(a))[0] ?? null;
  }

  /**
   * Flowcharts from the keyboard (<kbd>Ctrl/⌘</kbd> + arrow keys with the select tool): adds a
   * copy of the selected shape (or note) next to it in `direction`, linked to it by an arrow,
   * and selects it. Repeat to add more: they're placed next to each other. Undoable.
   *
   * @returns the new shape, or `null` if the selection isn't one shape.
   */
  public async addConnected(direction: FlowDirection = 'right'): Promise<AbstractComponent | null> {
    const shape = this.selectedShape();
    if (!shape) return null;

    const editor = this.editor;
    const image = editor.image;
    const pixel = editor.viewport.getSizeOfPixelOnCanvas();
    const box = shape.getBBox();
    const gap = 60 * pixel;
    const dir = Vec2.ofXY(flowDirections[direction]);
    const horizontal = dir.x !== 0;
    const base = dir.times((horizontal ? box.w : box.h) + gap);
    const across = horizontal ? Vec2.of(0, box.h + gap / 2) : Vec2.of(box.w + gap / 2, 0);

    // Next to the shape, or next to the shapes already there (alternating sides).
    const groupId = shape.getGroupId();
    const isFree = (rect: Rect2) =>
      !image
        .getComponentsIntersecting(rect.grownBy(gap / 4))
        .some((c) => c.isSelectable() && !(c instanceof Connector) && c !== shape && !(groupId !== null && c.getGroupId() === groupId));
    let offset = base;
    for (let i = 0; i <= 12; i++) {
      const step = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1);
      const candidate = base.plus(across.times(step));
      if (isFree(box.translatedBy(candidate))) {
        offset = candidate;
        break;
      }
    }

    let copy: AbstractComponent;
    if (shape instanceof StickyNote) {
      copy = StickyNote.centeredAt(box.center.plus(offset), {
        color: shape.getColor(),
        size: shape.getSize(),
        fontSize: shape.getFontSize(),
      });
    } else {
      // clone() gives a new ID (transformedPreview keeps the ID of what it copies).
      copy = shape.clone().transformedPreview(Mat33.translation(offset));
      // Not in the group of the shape and its text.
      copy.setGroupDirectly(null);
      const { diagramNode: _node, mindmap: _mindmap, ...metadata } = shape.getMetadata();
      copy.setMetadata(Object.keys(metadata).length > 0 ? metadata : null);
    }

    // An arrow like the other arrows of the shape.
    const existing = image
      .getAllComponents()
      .find((c): c is Connector => c instanceof Connector && c.isAttachedTo(shape.getId()));
    const style = existing?.getConnectorStyle();
    const arrow = new Connector(
      { point: box.center, targetId: shape.getId(), side: sideNames[direction] },
      { point: copy.getBBox().center, targetId: copy.getId(), side: sideNames[oppositeSides[direction]] },
      {
        color: style?.color ?? toColor4('#374151'),
        thickness: style?.thickness ?? 2 * pixel,
        arrow: style?.arrow ?? 'end',
        routing: style?.routing ?? 'elbow',
        sketch: style?.sketch ?? shape.getMetadata().sketch === '1',
      },
    );

    await this.dispatchAll([EditorImage.addComponent(copy), EditorImage.addComponent(arrow)]);
    this.set([copy]);
    return copy;
  }

  /**
   * Selects the shape linked by an arrow to the selected one that is the most in `direction`
   * (<kbd>Alt</kbd> + arrow keys with the select tool).
   *
   * @returns the newly selected shape, or `null` if there is none.
   */
  public selectConnected(direction: FlowDirection): AbstractComponent | null {
    const shape = this.selectedShape();
    if (!shape) return null;
    const image = this.editor.image;
    const center = shape.getBBox().center;
    const dir = Vec2.ofXY(flowDirections[direction]);

    let best: AbstractComponent | null = null;
    let bestScore = -Infinity;
    for (const connector of image.getAllComponents()) {
      if (!(connector instanceof Connector) || !connector.isAttachedTo(shape.getId())) continue;
      for (const end of [connector.getStart(), connector.getEnd()]) {
        const other = end.targetId && end.targetId !== shape.getId() ? image.lookupElement(end.targetId) : null;
        if (!other) continue;
        const delta = other.getBBox().center.minus(center);
        const along = delta.dot(dir);
        if (along <= 0) continue;
        // In the direction, and not too far to the side.
        const score = along / (delta.magnitude() || 1) - delta.magnitude() * 1e-6;
        if (score > bestScore) {
          best = other;
          bestScore = score;
        }
      }
    }
    if (best) {
      const groupId = best.getGroupId();
      this.set(groupId === null ? [best] : image.getAllComponents().filter((c) => c.getGroupId() === groupId));
    }
    return best;
  }

  /** Selects everything that isn't locked. */
  public selectAll() {
    this.set(this.editor.image.getAllComponents());
  }

  public clear() {
    this.tool.clearSelection();
  }

  /**
   * The selection's bounding box in CSS pixels, relative to the editor's container,
   * or `null` if nothing is selected.
   */
  public getScreenRect(): Rect2 | null {
    if (this.isEmpty) return null;
    return this.tool.getSelection()?.getScreenRegion() ?? null;
  }

  /**
   * Calls `listener` when the selection, or its position on the screen, may have changed
   * (selection changes, edits, undo/redo, zoom and scroll). Returns a function that removes
   * the listener.
   */
  public onChange(listener: (items: AbstractComponent[]) => void): () => void {
    const notifier = this.editor.notifier;
    const callback = () => listener(this.items);
    const listeners = [
      EditorEventType.SelectionUpdated,
      EditorEventType.CommandDone,
      EditorEventType.CommandUndone,
      EditorEventType.ViewportChanged,
    ].map((event) => notifier.on(event, callback));

    return () => {
      for (const l of listeners) l.remove();
    };
  }

  private async dispatchAll(commands: Command[]) {
    if (commands.length === 0) return;
    await this.editor.dispatch(commands.length === 1 ? commands[0] : uniteCommands(commands));
  }

  /** Changes the color of the selected items (stroke color, text color, note color…). */
  public async setColor(color: ColorInput) {
    const newColor = toColor4(color);
    const commands = this.items
      .filter(isRestylableComponent)
      .map((component) => component.updateStyle({ color: newColor }));
    await this.dispatchAll(commands);
  }

  /** Moves the selected items above everything else. */
  public async bringToFront() {
    const items = this.items;
    if (items.length === 0) return;

    const top = Math.max(...this.editor.image.getAllComponents().map((c) => c.getZIndex()));
    await this.dispatchAll(items.map((item, i) => item.setZIndex(top + 1 + i)));
  }

  /** Moves the selected items below everything else (but above the background). */
  public async sendToBack() {
    const items = this.items;
    if (items.length === 0) return;

    const bottom = Math.min(...this.editor.image.getAllComponents().map((c) => c.getZIndex()));
    await this.dispatchAll(items.map((item, i) => item.setZIndex(bottom - items.length + i)));
  }

  /**
   * Locks the selected items: they can't be selected, moved or erased until
   * {@link unlockAll} is called. Clears the selection.
   */
  public async lock() {
    const items = this.items;
    this.clear();
    await this.dispatchAll(items.map((item) => item.setLocked(true)));
  }

  /** Unlocks every locked item. Returns the number of unlocked items. */
  public async unlockAll(): Promise<number> {
    const locked = this.editor.image.getAllComponents().filter((c) => c.isLocked());
    await this.dispatchAll(locked.map((item) => item.setLocked(false)));
    return locked.length;
  }

  /** The number of locked items in the drawing. */
  public get lockedCount(): number {
    return this.editor.image.getAllComponents().filter((c) => c.isLocked()).length;
  }

  /** Duplicates the selected items, slightly offset, and selects the copies. */
  public async duplicate(offset = 24) {
    const items = this.items;
    if (items.length === 0) return;

    const shift = Mat33.translation(Vec2.of(offset, offset).times(this.editor.viewport.getSizeOfPixelOnCanvas()));
    const copies = items.map((item) => item.clone());
    AbstractComponent.regroupCopies(items, copies);
    await this.dispatchAll([
      ...copies.map((copy) => EditorImage.addComponent(copy)),
      ...copies.map((copy) => copy.transformBy(shift)),
    ]);
    this.set(copies);
  }

  /**
   * Groups the selected items: from then on, they are selected (and so moved, recolored…)
   * together. Undoable.
   */
  public async group() {
    const items = this.items;
    if (items.length < 2) return;

    const groupId = `group-${items[0].getId()}`;
    await this.dispatchAll(items.map((item) => item.setGroup(groupId)));
    this.set(items);
  }

  /** Ungroups the selected items. Undoable. */
  public async ungroup() {
    const grouped = this.items.filter((item) => item.getGroupId() !== null);
    await this.dispatchAll(grouped.map((item) => item.setGroup(null)));
  }

  /** Whether the selection contains grouped items. */
  public get hasGroups(): boolean {
    return this.items.some((item) => item.getGroupId() !== null);
  }

  // The selection split into units that move together: groups, and ungrouped items.
  private units() {
    const units = new Map<string, AbstractComponent[]>();
    for (const item of this.items) {
      const key = item.getGroupId() ?? `item-${item.getId()}`;
      units.set(key, [...(units.get(key) ?? []), item]);
    }
    return [...units.values()].map((items) => ({
      items,
      bbox: Rect2.union(...items.map((item) => item.getExactBBox())),
    }));
  }

  // Moves each unit by its offset, keeping z-order.
  private async moveUnits(moves: Array<{ items: AbstractComponent[]; offset: IVec2 }>) {
    const commands = moves
      .filter(({ offset }) => offset.magnitude() > 1e-8)
      .flatMap(({ items, offset }) =>
        items.map((item) => item.setZIndexAndTransformBy(Mat33.translation(offset), item.getZIndex())),
      );
    const items = this.items;
    await this.dispatchAll(commands);
    // Update the selection box.
    this.set(items);
  }

  /**
   * Aligns the selected items (groups move as one) to the edge or center of the selection.
   */
  public async align(edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    const units = this.units();
    if (units.length < 2) return;

    const all = Rect2.union(...units.map((u) => u.bbox));
    await this.moveUnits(
      units.map(({ items, bbox }) => {
        let offset: IVec2;
        switch (edge) {
          case 'left': offset = Vec2.of(all.x - bbox.x, 0); break;
          case 'center': offset = Vec2.of(all.center.x - bbox.center.x, 0); break;
          case 'right': offset = Vec2.of(all.x + all.w - (bbox.x + bbox.w), 0); break;
          case 'top': offset = Vec2.of(0, all.y - bbox.y); break;
          case 'middle': offset = Vec2.of(0, all.center.y - bbox.center.y); break;
          case 'bottom': offset = Vec2.of(0, all.y + all.h - (bbox.y + bbox.h)); break;
        }
        return { items, offset };
      }),
    );
  }

  /**
   * Spreads the selected items (groups move as one) so the gaps between them are equal.
   * The first and last items don't move. Needs at least 3 items.
   */
  public async distribute(direction: 'horizontal' | 'vertical') {
    const units = this.units();
    if (units.length < 3) return;

    const horizontal = direction === 'horizontal';
    const start = (r: Rect2) => (horizontal ? r.x : r.y);
    const size = (r: Rect2) => (horizontal ? r.w : r.h);
    units.sort((a, b) => start(a.bbox) + size(a.bbox) / 2 - (start(b.bbox) + size(b.bbox) / 2));

    const first = units[0].bbox;
    const last = units[units.length - 1].bbox;
    const totalSize = units.reduce((sum, u) => sum + size(u.bbox), 0);
    const gap = (start(last) + size(last) - start(first) - totalSize) / (units.length - 1);

    let position = start(first);
    const moves = units.map(({ items, bbox }) => {
      const delta = position - start(bbox);
      position += size(bbox) + gap;
      return { items, offset: horizontal ? Vec2.of(delta, 0) : Vec2.of(0, delta) };
    });
    await this.moveUnits(moves);
  }

  /** Deletes the selected items. */
  public async delete() {
    const items = this.items;
    if (items.length === 0) return;

    this.clear();
    await this.editor.dispatch(new Erase(items));
  }
}
