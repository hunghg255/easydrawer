/* eslint-disable unicorn/explicit-length-check */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import BaseWidget from './BaseWidget';
import type Editor from '../../Editor';
import { type KeyPressEvent } from '../../inputEvents';
import type BaseTool from '../../tools/BaseTool';
import { toolbarCSSPrefix } from '../constants';
import { type ToolbarLocalization } from '../localization';

function isToolWidgetFocused () {
  //@ts-expect-error
  const currentFocus = [...document.querySelectorAll('*:focus')];
  return (
    currentFocus.length &&
		currentFocus.some((elem) => elem.classList.contains(`${toolbarCSSPrefix}button`))
  );
}

export default abstract class BaseToolWidget extends BaseWidget {
  public constructor(
    editor: Editor,
    protected targetTool: BaseTool,
    id: string,
    localizationTable?: ToolbarLocalization,
  ) {
    super(editor, id, localizationTable);

    this.targetTool.enabledValue().onUpdateAndNow((enabled) => {
      if (enabled) {
        this.setSelected(true);

        // Transfer focus to the current button, only if another toolbar button is
        // focused.
        // This prevents pressing "space" from triggering a different action when
        // the current is selected.
        if (isToolWidgetFocused()) {
          this.focus();
        }
      } else {
        this.setSelected(false);
        this.setDropdownVisible(false);
      }
    });
  }

  protected override shouldAutoDisableInReadOnlyEditor() {
    return !this.targetTool.canReceiveInputInReadOnlyEditor();
  }

  protected handleClick() {
    // if (this.hasDropdown) {
    //   if (!this.targetTool.isEnabled()) {
    //     this.targetTool.setEnabled(true);
    //     this.activateDropdown();
    //   } else {
    //     this.setDropdownVisible(!this.isDropdownVisible());
    //   }
    // } else {
    //   this.targetTool.setEnabled(!this.targetTool.isEnabled());
    // }

    this.targetTool.setEnabled(!this.targetTool.isEnabled());
  }

  protected override onKeyPress(event: KeyPressEvent): boolean {
    if (this.isSelected() && event.code === 'Space' && this.hasDropdown) {
      this.handleClick();
      return true;
    }

    return false;
  }

  public override addTo(parent: HTMLElement) {
    const result = super.addTo(parent);
    this.setSelected(this.targetTool.isEnabled());

    return result;
  }
}
