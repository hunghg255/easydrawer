import KeyboardShortcutManager from '../shortcuts/KeyboardShortcutManager';

// This file contains user-overridable tool-realted keybindings.

// Undo/redo
export const undoKeyboardShortcutId = 'easydraw.tools.undo';
export const redoKeyboardShortcutId = 'easydraw.tools.redo';

KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  undoKeyboardShortcutId,
  ['CtrlOrMeta+KeyZ'],
  'Undo',
);
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  redoKeyboardShortcutId,
  ['CtrlOrMeta+Shift+KeyZ', 'CtrlOrMeta+KeyY'],
  'Redo',
);

// Pen/eraser/selection keybindings
export const increaseSizeKeyboardShortcutId = 'easydraw.tools.increaseSize';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  increaseSizeKeyboardShortcutId,
  ['Equal', 'Shift+Equal'],
  'Increase pen/eraser size',
);
export const decreaseSizeKeyboardShortcutId = 'easydraw.tools.decreaseSize';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  decreaseSizeKeyboardShortcutId,
  ['Minus', 'Shift+Minus'],
  'Decrease pen/eraser size',
);
export const snapToGridKeyboardShortcutId = 'easydraw.tools.snapToGrid';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  snapToGridKeyboardShortcutId,
  ['Control', 'Meta'],
  'Snap to grid (press and hold)',
);
export const lineLockKeyboardShortcutId = 'easydraw.tools.lockToLine';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  lineLockKeyboardShortcutId,
  ['Shift'],
  'Snap to XY axes (press and hold)',
);

// Find tool
export const toggleFindVisibleShortcutId = 'easydraw.tools.FindTool.toggleVisible';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  toggleFindVisibleShortcutId,
  ['CtrlOrMeta+KeyF'],
  'Shows/hides the find tool',
);

// Pan/zoom
export const moveLeftKeyboardShortcutId = 'easydraw.tools.PanZoom.moveLeft';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  moveLeftKeyboardShortcutId,
  ['ArrowLeft', 'KeyH', 'KeyA'],
  'Pan left',
);
export const moveRightKeyboardShortcutId = 'easydraw.tools.PanZoom.moveRight';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  moveRightKeyboardShortcutId,
  ['ArrowRight', 'KeyL', 'KeyD'],
  'Pan right',
);
export const moveUpKeyboardShortcutId = 'easydraw.tools.PanZoom.moveUp';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  moveUpKeyboardShortcutId,
  ['ArrowUp', 'KeyK', 'KeyQ'],
  'Pan up',
);
export const moveDownKeyboardShortcutId = 'easydraw.tools.PanZoom.moveDown';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  moveDownKeyboardShortcutId,
  ['ArrowDown', 'KeyJ', 'KeyE'],
  'Pan down',
);
export const rotateClockwiseKeyboardShortcutId = 'easydraw.tools.PanZoom.rotateViewClockwise';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  rotateClockwiseKeyboardShortcutId,
  ['Shift+KeyR'],
  'Rotate viewport clockwise',
);
export const rotateCounterClockwiseKeyboardShortcutId =
	'easydraw.tools.PanZoom.rotateViewCounterClockwise';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  rotateCounterClockwiseKeyboardShortcutId,
  ['KeyR'],
  'Rotate viewport counter-clockwise',
);
export const zoomInKeyboardShortcutId = 'easydraw.tools.PanZoom.zoomIn';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  zoomInKeyboardShortcutId,
  ['KeyW'],
  'Zoom in',
);
export const zoomOutKeyboardShortcutId = 'easydraw.tools.PanZoom.zoomOut';
KeyboardShortcutManager.registerDefaultKeyboardShortcut(
  zoomOutKeyboardShortcutId,
  ['KeyS'],
  'Zoom out',
);

// Selection tool

export * from './SelectionTool/keybindings';
