/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useEffect } from 'react'


import { Editor, 	AbstractToolbar,
	EditorEventType,
	EventDispatcher,
	makeDropdownToolbar,
  //@ts-expect-error
	makeEdgeToolbar, } from 'easy-draw';

function App() {
useEffect(() => {

  const init = async () => {
    // const editor = new Editor(document.body, {
    //   wheelEventsEnabled: false,
    // });
    // editor.addToolbar();
    // editor.loadFromSVG('<svg><text>Wheel events disabled.</text></svg>');
    // console.log(editor);

    const parentElement = document.body;
    const editor = new Editor(parentElement, {
      // keyboardShortcutOverrides: loadKeybindingOverrides(),
      // iconProvider: new MaterialIconProvider(),

      // Specify a custom app name for the about dialog,
      // but not a custom version.
      // appInfo: {
      //   name: 'easy-draw demo',
      //   description: "An app demonstrating the easy-draw library's functionality.",
      // },

      // text: {
      //   fonts: ['serif', 'sans-serif', 'monospace'],
      // },
      minZoom: 1,
      maxZoom: 1,
    });

    // const { hasChanges } = watchForChanges(editor, appNotifier);

    // Although new Editor(parentElement) created an Editor, it doesn't have a toolbar
    // yet. `.addToolbar()` creates a toolbar and adds it to the document, using the
    // default toolbar layout.
    // let toolbar: any;
    // if (getIsEdgeToolbar()) {
    //   toolbar = makeEdgeToolbar(editor);
    //   toolbar.addDefaultToolWidgets();
    // } else {
      const dropdownToolbar = makeDropdownToolbar(editor);
      dropdownToolbar.addDefaultToolWidgets();


      // dropdownToolbar.addOverflowWidget();
//       toolbar = dropdownToolbar;
//     // }
// console.log({
//   toolbar
// });

	// Loads from SVG data


	// Adding tags to a toolbar button allows different styles to be applied.
	// Also see addActionButton.

// Add a custom button
// dropdownToolbar.addActionButton({
//   label: 'Custom Button',
//   icon: createCustomIcon(),
// }, () => {
//   console.log('Click');

//   // Do something here
// });
    // const closeEditor = () => {
    //   editor.remove();
    //   // void reShowLaunchOptions(localization, appNotifier);
    // };

    // Add buttons in this order (exit, undo/redo, save) so that the
    // tab order matches the display order (which is set with CSS).
    // toolbar.addExitButton(() => {
    //   if (hasChanges() && confirm(localization.saveUnsavedChanges)) {
    //     // saveCallback(closeEditor);
    //   } else {
    //     closeEditor();
    //   }
    // });

    // toolbar.addUndoRedoButtons();

    // const saveButton = dropdownToolbar.addSaveButton(() => {
    //   // saveCallback();
    //   console.log('save');

    // });

    // if (isDebugWidgetEnabled()) {
    //   toolbar.addWidget(new DebugToolbarWidget(editor));
    // }

    // Save toolbar state whenever tool state changes (which could be caused by a
    // change in the one of the toolbar widgets).
    // editor.notifier.on(EditorEventType.ToolUpdated, () => {
    //   saveToolbarState(toolbar);
    // });

    // Load toolbar widget state from localStorage.
    // restoreToolbarState(toolbar);

    // Show a "are you sure you want to leave this page" dialog
    // if there could be unsaved changes.
    // setUpUnsavedChangesWarning(localization, hasChanges);

    // Set focus to the main region of the editor.
    // This allows keyboard shortcuts to work.
    editor.focus();

    // Loading the SVG:
    // First, ensure that users can't save an incomplete image by disabling save
    // and editing (disabling editing allows the exit button to still be clickable, so
    // long as there is nothing to save).
    // editor.setReadOnly(true);
    // saveButton.setDisabled(true);

    // await editor.loadFromSVG(await getInitialSVGData());

    // After loading, re-enable editing.
    // editor.setReadOnly(false);
    // saveButton.setDisabled(false);

  }

  init()

}, [])
  return (
    <>

    </>
  )
}

export default App
