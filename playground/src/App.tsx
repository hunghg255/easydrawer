import React, { useEffect, useState } from 'react';
import './App.css';

import {
  makeDropdownToolbar,
  Editor,
} from 'easy-draw';

function PencilOption () {
  return (
    <div className='options'>
      <div>
        <p>
          Color
        </p>

        <button>
          Black
        </button>

        <button>
          Red
        </button>

        <button>
          White
        </button>

        <button>
          Green
        </button>
      </div>

      <div>
        <p>
          Lighweight
        </p>

        <button>
          Thin
        </button>

        <button>
          Medium
        </button>

        <button>
          Thick
        </button>
      </div>
    </div>
  );
}

function App() {
  const [tool, setTool] = useState<'select' | 'text' | 'pencil' | 'highlighter' | 'eraser' | 'shapes'>(null);
  const [edit, setEdit] = useState(false);
  const refEditor = React.useRef<Editor | null>(null);

  useEffect(() => {
    const init = async () => {
      // const editor = new Editor(document.body, {
      //   wheelEventsEnabled: false,
      // });
      // editor.addToolbar();
      // editor.loadFromSVG('<svg><text>Wheel events disabled.</text></svg>');
      // console.log(editor);

      const parentElement = document.body;
      refEditor.current = new Editor(parentElement, {
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
      const dropdownToolbar = makeDropdownToolbar(refEditor.current);
      dropdownToolbar.addDefaultToolWidgets();
      console.log({
        dropdownToolbar
      });

      // Access the tools directly through the editor's toolController
      const penTool = refEditor.current.toolController.getPrimaryTools();
      console.log(penTool);
      // // Example: Create a simple custom draw button
      // const drawButton = document.querySelector('#btn');
      // console.log({
      //   penTool
      // });

      // drawButton.addEventListener('click', () => {
      //   // Enable the pen tool
      //   if (penTool) {
      //     // Optionally set pen properties
      //     penTool.setColor(new Color4(1, 0, 0, 1)); // Red color
      //     penTool.setThickness(10); // 5px thickness
      //   }
      // });

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
      // editor.setReadOnly(true);

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

    };

    init();

  }, []);

  useEffect(() => {
    if (refEditor.current) {
      refEditor.current.setReadOnly(!edit);

      if (!edit) {
        console.log('disable');

        document.querySelector('.imageEditorContainer').style.pointerEvents = 'none';
      } else {
        document.querySelector('.imageEditorContainer').style.pointerEvents = 'auto';
      }
    }
  }, [refEditor.current, edit]);

  return (
    <>
      <div className='wrapper'>
        <button
          onClick={() => setEdit(!edit)}
        >
          {!edit ? 'Edit ✅' : 'Disable ❌'}
        </button>

        <button
          onClick={() => setTool('select')}
        >
          Select Tool
          {' '}
          {tool === 'select' && '✅'}
        </button>

        <button onClick={() => setTool('text')}>
          Text
          {' '}
          {tool === 'text' && '✅'}
        </button>

        <button onClick={() => setTool('pencil')}>
          Pencil Tool
          {' '}
          {tool === 'pencil' && '✅'}
        </button>

        {tool === 'pencil' && <PencilOption />}

        <button onClick={() => setTool('highlighter')}>
          Highlighter
          {' '}
          {tool === 'highlighter' && '✅'}
        </button>

        <button onClick={() => setTool('eraser')}>
          Eraser
          {' '}
          {tool === 'eraser' && '✅'}
        </button>

        <button onClick={() => setTool('shapes')}>
          Shapes
          {' '}
          {tool === 'shapes' && '✅'}
        </button>
      </div>

      <img alt="placeholder"
        src="https://plus.unsplash.com/premium_photo-1681412205238-8171ccaca82b?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </>
  );
}

export default App;
