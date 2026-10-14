import BaseTool from './BaseTool';
import { namedToolShortcutIds } from './keybindings';
import { type ToolName } from '../api/options';
import type Editor from '../Editor';
import { type KeyPressEvent } from '../inputEvents';

/**
 * Switches tools with single-key shortcuts: V select, P pen, M highlighter, E eraser,
 * T text, S shapes, K laser, I eyedropper. Keys can be changed with
 * {@link EditorSettings.keyboardShortcutOverrides} (IDs in `namedToolShortcutIds`).
 */
export default class NamedToolShortcuts extends BaseTool {
  public constructor(private editor: Editor) {
    super(editor.notifier, editor.localization.changeTool);
  }

  public override canReceiveInputInReadOnlyEditor() {
    return true;
  }

  public override onKeyPress(event: KeyPressEvent): boolean {
    const shortcuts = this.editor.shortcuts;

    for (const [name, shortcutId] of Object.entries(namedToolShortcutIds)) {
      if (!shortcuts.matchesShortcut(shortcutId, event)) continue;

      const tool = this.editor.toolController.getToolByName(name as ToolName);
      if (!tool) return false;

      // In a read-only editor, only tools that work there can be selected.
      if (this.editor.isReadOnly() && !tool.canReceiveInputInReadOnlyEditor()) return false;

      tool.setEnabled(true);
      return true;
    }

    return false;
  }
}
