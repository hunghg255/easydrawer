import { type IVec2 } from '~/math';

import makeClipboardErrorHandlers from './makeClipboardErrorHandlers';
import type Editor from '../../../Editor';
import ClipboardHandler from '../../../util/ClipboardHandler';
import createMenuOverlay from '../../util/createMenuOverlay';
import type Selection from '../Selection';

async function showSelectionContextMenu (selectionBox: Selection | null,
  editor: Editor,
  canvasAnchor: IVec2,
  preferSelectionMenu: boolean,
  clearSelection: () => void) {
  const localization = editor.localization;
  const showSelectionMenu = selectionBox?.getSelectedItemCount() && preferSelectionMenu;

  const noSelectionMenu = [
    {
      text: localization.selectionMenu__paste,
      icon: () => editor.icons.makePasteIcon(),
      key: () => {
        const clipboardHandler = new ClipboardHandler(editor, makeClipboardErrorHandlers(editor));
        void clipboardHandler.paste();
      },
    },
  ];

  const onActivated = await createMenuOverlay(
    editor,
    canvasAnchor,
    showSelectionMenu
      ? [
        {
          text: localization.selectionMenu__duplicate,
          icon: () => editor.icons.makeDuplicateSelectionIcon(),
          key: async () => {
            await editor.dispatch(await selectionBox!.duplicateSelectedObjects());
          },
        },
        {
          text: localization.selectionMenu__delete,
          icon: () => editor.icons.makeDeleteSelectionIcon(),
          key: async () => {
            await editor.dispatch(selectionBox!.deleteSelectedObjects());
            clearSelection();
          },
        },
        {
          text: localization.selectionMenu__copyToClipboard,
          icon: () => editor.icons.makeCopyIcon(),
          key: () => {
            const clipboardHandler = new ClipboardHandler(
              editor,
              makeClipboardErrorHandlers(editor),
            );
            void clipboardHandler.copy();
          },
        },
        ...noSelectionMenu,
      ]
      : noSelectionMenu,
  );
  onActivated?.();
}

export default showSelectionContextMenu;
