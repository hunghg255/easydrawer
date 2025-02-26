import KeyboardShortcutManager from '../../shortcuts/KeyboardShortcutManager';

// Selection
export const resizeImageToSelectionKeyboardShortcut =
	'easydraw.toolbar.SelectionTool.resizeImageToSelection';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  resizeImageToSelectionKeyboardShortcut,
  ['ctrlOrMeta+r'],
  'Resize image to selection',
);

// Pen tool
export const selectStrokeTypeKeyboardShortcutIds: string[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
  (id) => `easydraw.toolbar.PenTool.select-pen-${id}`,
);

for (const [i, id] of selectStrokeTypeKeyboardShortcutIds.entries()) {
  KeyboardShortcutManager.registerDefaultKeyboardShortcut(
    id,
    [`CtrlOrMeta+Digit${i + 1}`],
    'Select pen style ' + (i + 1),
  );
}

// Save
export const saveKeyboardShortcut = 'easydraw.toolbar.SaveActionWidget.save';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  saveKeyboardShortcut,
  ['ctrlOrMeta+KeyS'],
  'Save',
);

// Exit
export const exitKeyboardShortcut = 'easydraw.toolbar.ExitActionWidget.exit';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(exitKeyboardShortcut, ['Alt+KeyQ'], 'Exit');
