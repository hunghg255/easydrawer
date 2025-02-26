import KeyboardShortcutManager from '../../shortcuts/KeyboardShortcutManager';

// Selection
export const selectAllKeyboardShortcut = 'easydraw.tools.SelectionTool.selectAll';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  selectAllKeyboardShortcut,
  ['CtrlOrMeta+KeyA'],
  'Select all',
);
export const duplicateSelectionShortcut = 'easydraw.tools.SelectionTool.duplicateSelection';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  duplicateSelectionShortcut,
  ['CtrlOrMeta+KeyD'],
  'Duplicate selection',
);
export const sendToBackSelectionShortcut = 'easydraw.tools.SelectionTool.sendToBack';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  sendToBackSelectionShortcut,
  ['End'],
  'Send to back',
);

export const translateLeftSelectionShortcutId = 'easydraw.tools.SelectionTool.translateLeft';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  translateLeftSelectionShortcutId,
  ['KeyA', 'KeyH', 'ArrowLeft'],
  'Move selection left',
);
export const translateRightSelectionShortcutId = 'easydraw.tools.SelectionTool.translateRight';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  translateRightSelectionShortcutId,
  ['KeyD', 'KeyL', 'ArrowRight'],
  'Move selection right',
);

export const translateUpSelectionShortcutId = 'easydraw.tools.SelectionTool.translateUp';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  translateUpSelectionShortcutId,
  ['KeyQ', 'KeyK', 'ArrowUp'],
  'Move selection up',
);
export const translateDownSelectionShortcutId = 'easydraw.tools.SelectionTool.translateDown';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  translateDownSelectionShortcutId,
  ['KeyE', 'KeyJ', 'ArrowDown'],
  'Move selection down',
);

export const rotateCounterClockwiseSelectionShortcutId = 'easydraw.tools.SelectionTool.rotateCCW';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  rotateCounterClockwiseSelectionShortcutId,
  ['Shift+KeyR'],
  'Rotate selection counter clockwise',
);
export const rotateClockwiseSelectionShortcutId = 'easydraw.tools.SelectionTool.rotateCW';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  rotateClockwiseSelectionShortcutId,
  ['KeyR'],
  'Rotate selection clockwise',
);

export const shrinkXSelectionShortcutId = 'easydraw.tools.SelectionTool.shrink.x';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  shrinkXSelectionShortcutId,
  ['KeyI'],
  'Decrease width',
);
export const stretchXSelectionShortcutId = 'easydraw.tools.SelectionTool.stretch.x';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  stretchXSelectionShortcutId,
  ['Shift+KeyI'],
  'Increase width',
);

export const shrinkYSelectionShortcutId = 'easydraw.tools.SelectionTool.shrink.y';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  shrinkYSelectionShortcutId,
  ['KeyO'],
  'Decrease height',
);
export const stretchYSelectionShortcutId = 'easydraw.tools.SelectionTool.stretch.y';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  stretchYSelectionShortcutId,
  ['Shift+KeyO'],
  'Increase height',
);

export const shrinkXYSelectionShortcutId = 'easydraw.tools.SelectionTool.shrink.xy';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  shrinkXYSelectionShortcutId,
  ['Comma'],
  'Decrease selection size',
);
export const stretchXYSelectionShortcutId = 'easydraw.tools.SelectionTool.stretch.xy';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  stretchXYSelectionShortcutId,
  ['Period'],
  'Increase selection size',
);
