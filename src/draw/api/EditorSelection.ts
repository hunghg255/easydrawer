import { Mat33, type Rect2, Vec2 } from '~/math';

import { type ColorInput, toColor4 } from './options';
import type AbstractComponent from '../components/AbstractComponent';
import { isRestylableComponent } from '../components/RestylableComponent';
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
    await this.dispatchAll([
      ...copies.map((copy) => EditorImage.addComponent(copy)),
      ...copies.map((copy) => copy.transformBy(shift)),
    ]);
    this.set(copies);
  }

  /** Deletes the selected items. */
  public async delete() {
    const items = this.items;
    if (items.length === 0) return;

    this.clear();
    await this.editor.dispatch(new Erase(items));
  }
}
