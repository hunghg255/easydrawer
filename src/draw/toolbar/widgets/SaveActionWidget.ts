import ActionButtonWidget from './ActionButtonWidget';
import { ToolbarWidgetTag } from './BaseWidget';
import { saveKeyboardShortcut } from './keybindings';
import type Editor from '../../Editor';
import { type KeyPressEvent } from '../../inputEvents';
import { type ToolbarLocalization } from '../localization';
import { type ActionButtonIcon } from '../types';

class SaveActionWidget extends ActionButtonWidget {
  public constructor(
    editor: Editor,
    localization: ToolbarLocalization,
    saveCallback: () => void,
    labelOverride: Partial<ActionButtonIcon> = {},
  ) {
    super(
      editor,
      'save-button',
      // Creates an icon
      () => {
        return labelOverride.icon ?? editor.icons.makeSaveIcon();
      },
      labelOverride.label ?? localization.save,
      saveCallback,
    );
    this.setTags([ToolbarWidgetTag.Save]);
  }

  protected override shouldAutoDisableInReadOnlyEditor() {
    return false;
  }

  protected override onKeyPress(event: KeyPressEvent): boolean {
    if (this.editor.shortcuts.matchesShortcut(saveKeyboardShortcut, event)) {
      this.clickAction();
      return true;
    }

    // Run any default actions registered by the parent class.
    return super.onKeyPress(event);
  }

  public override mustBeInToplevelMenu(): boolean {
    return true;
  }
}

export default SaveActionWidget;
