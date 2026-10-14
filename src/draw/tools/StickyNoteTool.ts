import { Color4, type IVec2, Mat33, Rect2, Vec2 } from '~/math';

import BaseTool from './BaseTool';
import StickyNote from '../components/StickyNote';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import { type PointerEvt } from '../inputEvents';
import { PointerDevice } from '../Pointer';
import { EditorEventType } from '../types';
import ReactiveValue from '../util/ReactiveValue';

const editorClassName = 'easydrawer-sticky-note-editor';

/**
 * Adds sticky notes: click/tap an empty spot to add a note and type its text.
 * Click/tap an existing note to edit it. Notes can be moved and resized with the selection tool.
 */
export default class StickyNoteTool extends BaseTool {
  private color: Color4 = Color4.fromHex('#fde68a');
  private overlay: HTMLElement;
  private overlayTransform = ReactiveValue.fromInitialValue(Mat33.identity);
  private input: HTMLTextAreaElement | null = null;
  private editingNote: StickyNote | null = null;

  public constructor(
    private editor: Editor,
    description: string,
  ) {
    super(editor.notifier, description);

    this.overlay = document.createElement('div');
    this.overlay.classList.add(editorClassName);
    this.editor.anchorElementToCanvas(this.overlay, this.overlayTransform);
  }

  public getColor() {
    return this.color;
  }

  /** Sets the color of new notes. */
  public setColor(color: Color4) {
    this.color = color;
    this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
      kind: EditorEventType.ToolUpdated,
      tool: this,
    });
  }

  private noteAt(point: IVec2): StickyNote | null {
    const radius = this.editor.viewport.getSizeOfPixelOnCanvas() * 2;
    const region = Rect2.fromCorners(point.minus(Vec2.of(radius, radius)), point.plus(Vec2.of(radius, radius)));
    const notes = this.editor.image
      .getComponentsIntersecting(region)
      .filter((c): c is StickyNote => c instanceof StickyNote && c.isEditable());
    return notes[notes.length - 1] ?? null;
  }

  public override onPointerDown({ current, allPointers }: PointerEvt): boolean {
    if (allPointers.length !== 1 || current.device === PointerDevice.Eraser) {
      return false;
    }

    this.finishEditing();

    const existing = this.noteAt(current.canvasPos);
    if (existing) {
      this.edit(existing);
      return true;
    }

    // Keep the note the same size on screen at any zoom.
    const scale = this.editor.viewport.getSizeOfPixelOnCanvas();
    const note = StickyNote.centeredAt(current.canvasPos, {
      color: this.color,
      size: Vec2.of(200, 200).times(scale),
      fontSize: 20 * scale,
    });
    void this.editor.dispatch(EditorImage.addComponent(note));
    this.edit(note);
    return true;
  }

  /** Shows a text box to edit the text of `note`. */
  public edit(note: StickyNote) {
    this.finishEditing();
    this.editingNote = note;

    const size = note.getSize();
    const input = document.createElement('textarea');
    input.value = note.getText();
    input.placeholder = this.editor.localization.enterTextToInsert;
    Object.assign(input.style, {
      width: `${size.x}px`,
      height: `${size.y}px`,
      padding: `${16}px`,
      fontSize: `${note.getFontSize()}px`,
      lineHeight: '1.3',
      color: note.getTextColor().toHexString(),
      backgroundColor: note.getColor().toHexString(),
    });

    const resize = () => {
      input.style.height = `${size.y}px`;
      input.style.height = `${Math.max(size.y, input.scrollHeight)}px`;
    };
    input.addEventListener('input', resize);
    input.addEventListener('blur', () => this.finishEditing());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        this.finishEditing();
        this.editor.focus();
      }
    });

    this.input = input;
    this.overlayTransform.set(note.getTransform());
    this.overlay.replaceChildren(input);
    setTimeout(() => {
      resize();
      input.focus();
    }, 0);
  }

  /** Saves the text being edited, if any. */
  public finishEditing() {
    const input = this.input;
    const note = this.editingNote;
    this.input = null;
    this.editingNote = null;
    if (!input || !note) return;

    const text = input.value.trimEnd();
    input.remove();
    if (text !== note.getText()) {
      void this.editor.dispatch(note.setText(text));
    }
  }

  public override setEnabled(enabled: boolean) {
    super.setEnabled(enabled);
    if (!this.isEnabled()) {
      this.finishEditing();
    }
  }
}
