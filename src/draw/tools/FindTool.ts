// Displays a find dialog that allows the user to search for and focus text.
//
// @packageDocumentation

import { type Rect2 } from '~/math';

import BaseTool from './BaseTool';
import { toggleFindVisibleShortcutId } from './keybindings';
import ImageComponent from '../components/ImageComponent';
import TextComponent from '../components/TextComponent';
import type Editor from '../Editor';
import { type KeyPressEvent } from '../inputEvents';

const cssPrefix = 'find-tool';

export default class FindTool extends BaseTool {
  private overlay: HTMLElement;
  private searchInput: HTMLInputElement;
  private currentMatchIdx = 0;

  public constructor(private editor: Editor) {
    super(editor.notifier, editor.localization.findLabel);

    this.overlay = document.createElement('div');
    this.fillOverlay();
    editor.createHTMLOverlay(this.overlay);

    this.overlay.style.display = 'none';
    this.overlay.classList.add(`${cssPrefix}-overlay`);
  }

  public override canReceiveInputInReadOnlyEditor() {
    return true;
  }

  private getMatches(searchFor: string): Rect2[] {
    const lowerSearchFor = searchFor.toLocaleLowerCase();

    const matchingComponents = this.editor.image.getAllComponents().filter((component) => {
      let text = '';
      if (component instanceof TextComponent) {
        text = component.getText();
      } else if (component instanceof ImageComponent) {
        text = component.getAltText() ?? '';
      } else {
        return false;
      }

      const hasLowercaseMatch = text.toLocaleLowerCase().includes(lowerSearchFor);
      const hasSameCaseMatch = text.includes(searchFor);

      return hasLowercaseMatch || hasSameCaseMatch;
    });

    return matchingComponents.map((match) => match.getBBox());
  }

  private focusCurrentMatch() {
    const matches = this.getMatches(this.searchInput.value);
    let matchIdx = this.currentMatchIdx % matches.length;

    if (matchIdx < 0) {
      matchIdx = matches.length + matchIdx;
    }

    if (matchIdx < matches.length) {
      const undoable = false;
      void this.editor.dispatch(
        this.editor.viewport.zoomTo(matches[matchIdx], true, true),
        undoable,
      );
      this.editor.announceForAccessibility(
        this.editor.localization.focusedFoundText(matchIdx + 1, matches.length),
      );
    }
  }

  private toNextMatch() {
    this.currentMatchIdx++;
    this.focusCurrentMatch();
  }

  private toPrevMatch() {
    this.currentMatchIdx--;
    this.focusCurrentMatch();
  }

  private fillOverlay() {
    const label = document.createElement('label');
    this.searchInput = document.createElement('input');
    const nextBtn = document.createElement('button');
    const closeBtn = document.createElement('button');

    // Math.random() ensures that the ID is unique (to allow us to refer to it
    // with an htmlFor).
    this.searchInput.setAttribute('id', `${cssPrefix}-searchInput-${Math.random()}`);
    label.htmlFor = this.searchInput.getAttribute('id')!;

    label.innerText = this.editor.localization.findLabel;
    nextBtn.innerText = this.editor.localization.toNextMatch;
    closeBtn.innerText = this.editor.localization.closeDialog;

    this.searchInput.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        if (ev.shiftKey) {
          this.toPrevMatch();
        } else {
          this.toNextMatch();
        }
      } else if (ev.key === 'Escape') {
        this.setVisible(false);
      } else if (this.editor.shortcuts.matchesShortcut(toggleFindVisibleShortcutId, ev)) {
        ev.preventDefault();
        this.toggleVisible();
      }
    });

    nextBtn.addEventListener('click', () => {
      this.toNextMatch();
    });

    closeBtn.addEventListener('click', () => {
      this.setVisible(false);
    });

    this.overlay.replaceChildren(label, this.searchInput, nextBtn, closeBtn);
  }

  private isVisible() {
    return this.overlay.style.display !== 'none';
  }

  private setVisible(visible: boolean) {
    if (visible !== this.isVisible()) {
      this.overlay.style.display = visible ? 'block' : 'none';

      if (visible) {
        this.searchInput.focus();
        this.editor.announceForAccessibility(this.editor.localization.findDialogShown);
      } else {
        this.editor.focus();
        this.editor.announceForAccessibility(this.editor.localization.findDialogHidden);
      }
    }
  }

  private toggleVisible() {
    this.setVisible(!this.isVisible());
  }

  public override onKeyPress(event: KeyPressEvent): boolean {
    if (this.editor.shortcuts.matchesShortcut(toggleFindVisibleShortcutId, event)) {
      this.toggleVisible();

      return true;
    }

    return false;
  }

  public override setEnabled(enabled: boolean) {
    super.setEnabled(enabled);

    if (this.isEnabled()) {
      this.setVisible(false);
    }
  }
}
