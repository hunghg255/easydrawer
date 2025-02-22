import BaseTool from './BaseTool';
import { redoKeyboardShortcutId, undoKeyboardShortcutId } from './keybindings';
import type Editor from '../Editor';
import { type KeyPressEvent } from '../inputEvents';

// Handles ctrl+Z, ctrl+Shift+Z keyboard shortcuts.
export default class UndoRedoShortcut extends BaseTool {
  public constructor(private editor: Editor) {
    super(editor.notifier, editor.localization.undoRedoTool);
  }

  // @internal
  public override onKeyPress(event: KeyPressEvent): boolean {
    if (this.editor.shortcuts.matchesShortcut(undoKeyboardShortcutId, event)) {
      void this.editor.history.undo();
      return true;
    } else if (this.editor.shortcuts.matchesShortcut(redoKeyboardShortcutId, event)) {
      void this.editor.history.redo();
      return true;
    }

    return false;
  }
}
