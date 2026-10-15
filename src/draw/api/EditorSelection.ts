import { type IVec2, Mat33, Rect2, Vec2 } from '~/math';

import { type ColorInput, toColor4 } from './options';
import AbstractComponent from '../components/AbstractComponent';
import { isRestylableComponent } from '../components/RestylableComponent';
import StickyNote from '../components/StickyNote';
import TextComponent from '../components/TextComponent';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import type SelectionTool from '../tools/SelectionTool/SelectionTool';
import { EditorEventType } from '../types';

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
