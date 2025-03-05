import React, { useEffect, useState } from 'react';
import './App.css';

import {
  makeDropdownToolbar,
  Editor,
  Color4
} from 'easydrawer';

const enum ShapeType {
  square= 0,
  rectangle= 1,
  circle=2,
  triangle=3,
  hexagonal=4,
  diamond=5,
  arrow=6,
}

function PencilOption ({ setColorPen, setThicknessPen }: any) {
  return (
    <div className='options'>
      <div>
        <p>
          Color
        </p>

        <button
          onClick={() => setColorPen(Color4.black)}
        >
          Black
        </button>

        <button onClick={() => setColorPen(Color4.red)}>
          Red
        </button>

        <button onClick={() => setColorPen(Color4.white)}>
          White
        </button>

        <button onClick={() => setColorPen(Color4.green)}>
          Green
        </button>
      </div>

      <div>
        <p>
          Lighweight
        </p>

        <button onClick={() => setThicknessPen(1.5)}>
          Thin (1.5px)
        </button>

        <button onClick={() => setThicknessPen(3)}>
          Medium (3px)
        </button>

        <button onClick={() => setThicknessPen(5)}>
          Thick (5px)
        </button>
      </div>
    </div>
  );
}

function HighlightOption ({ setColorHighlight }: any) {
  return (
    <div className='options'>
      <div>
        <p>
          Color
        </p>

        <button onClick={() => setColorHighlight(Color4.blackHighlight)}>
          Black
        </button>

        <button onClick={() => setColorHighlight(Color4.blueHighlight)}>
          Blue
        </button>

        <button onClick={() => setColorHighlight(Color4.redHighlight)}>
          Red
        </button>
      </div>
    </div>
  );
}

function ShapeOption ({ changeShape, changeColorShape, changeBorderColorShape }: any) {
  return (
    <div className='options'>
      <div>
        <p>
          Type
        </p>

        <button onClick={() => changeShape(ShapeType.square)}>
          Vuông
        </button>

        <button onClick={() => changeShape(ShapeType.rectangle)}>
          Chữ nhật
        </button>

        <button   onClick={() => changeShape(ShapeType.circle)}>
          Tròn
        </button>

        <button onClick={() => changeShape(ShapeType.triangle)}>
          Tam giác
        </button>

        <button  onClick={() => changeShape(ShapeType.hexagonal)}>
          Lúc Giác
        </button>

        <button onClick={() => changeShape(ShapeType.diamond)}>
          Hình Thoi
        </button>

        <button onClick={() => changeShape(ShapeType.arrow)}>
          Mũi Tên
        </button>
      </div>

      <div>
        Filled Color
        <button>
          X
        </button>

        <button onClick={() => changeColorShape(Color4.black)}>
          Black
        </button>

        <button onClick={() => changeColorShape(Color4.red)}>
          red
        </button>

        <button onClick={() => changeColorShape(Color4.blue)}>
          blue
        </button>

        <button onClick={() => changeColorShape(Color4.orange)}>
          orange
        </button>

        <button onClick={() => changeColorShape(Color4.green)}>
          green
        </button>

        <button onClick={() => changeColorShape(Color4.gray)}>
          gray
        </button>

        <button onClick={() => changeColorShape(Color4.white)}>
          white
        </button>

        <button onClick={() => changeColorShape(Color4.pink)}>
          pink
        </button>

        <button onClick={() => changeColorShape(Color4.blueLight)}>
          blue light
        </button>

        <button onClick={() => changeColorShape(Color4.yellow)}>
          yellow
        </button>

        <button onClick={() => changeColorShape(Color4.greenLight)}>
          green light
        </button>
      </div>

      <div>
        Border Color

        <button>
          X
        </button>

        <button onClick={() => changeBorderColorShape(Color4.black)}>
          Black
        </button>

        <button onClick={() => changeBorderColorShape(Color4.red)}>
          red
        </button>

        <button onClick={() => changeBorderColorShape(Color4.blue)}>
          blue
        </button>

        <button onClick={() => changeBorderColorShape(Color4.orange)}>
          orange
        </button>

        <button onClick={() => changeBorderColorShape(Color4.green)}>
          green
        </button>

        <button onClick={() => changeBorderColorShape(Color4.gray)}>
          gray
        </button>

        <button onClick={() => changeBorderColorShape(Color4.white)}>
          white
        </button>

        <button onClick={() => changeBorderColorShape(Color4.pink)}>
          pink
        </button>

        <button onClick={() => changeBorderColorShape(Color4.blueLight)}>
          blue light
        </button>

        <button onClick={() => changeBorderColorShape(Color4.yellow)}>
          yellow
        </button>

        <button onClick={() => changeBorderColorShape(Color4.greenLight)}>
          green light
        </button>
      </div>

      <div>
        Border Thickness

        <input type='range' />
      </div>

      <div>
        Preview

        <button>
          Insert
        </button>
      </div>
    </div>
  );
}

function App() {
  const [tool, setTool] = useState<'select' | 'text' | 'pencil' | 'highlighter' | 'eraser' | 'shapes'>(null);
  const [edit, setEdit] = useState(false);
  const refEditor = React.useRef<Editor | null>(null);
  const refWidget = React.useRef<any>(null);

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
        //   name: 'easydrawer demo',
        //   description: "An app demonstrating the easydrawer library's functionality.",
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
      refWidget.current = makeDropdownToolbar(refEditor.current);
      refWidget.current.addDefaultToolWidgets();
      // console.log({
      //   dropdownToolbar
      // });

      // Access the tools directly through the editor's toolController
      // const penTool = refEditor.current.toolController.getPrimaryTools();

      // console.log({
      //   penTool
      // });

      // console.log(penTool[2]);

      // refEditor.current.toolController.setToolEnabled(penTool[2]);

      // console.log(penTool);
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

      const saveButton = refWidget.current.addSaveButton(() => {
        // saveCallback();
        console.log('save');
        const svgElem = refEditor.current.toSVG();
        console.log('The saved SVG:', svgElem.outerHTML);

      });

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
      const d = `
<svg viewBox="0 0 500 500" width="500" height="500" version="1.1" baseProfile="full" xmlns="http://www.w3.org/2000/svg"><style id="easydrawer-style-sheet">path{stroke-linecap:round;stroke-linejoin:round;}text{white-space:pre;}</style><path d="M793,55q-29,7 -42,12q-36.6,14.1 -62,31q-15,10 -35,46q-14.7,26.4 145,42q4.6,.4 -22,7q-20.9,4.5 -38,8q-13.5,2.7 -20,6q-1.5,.8 6-6q1.7-1.5 36-14q9.3-2.9 17-5q5.5-8.6 8-18q7.6-28.5 54-61q14.3-10 44-10q8.2,0 21,32q4,10 4,46q0,17.2 -41,50q-16.2,13 -48,18q-81.3,12.8 -102-1q-6.7-4.5 -1-33q1-5 16-15q3-2 31-2q5.5,.5 10,1" fill="none" stroke="#000000" stroke-width=".8"></path><path d="M757,102q-22,0 -33,3q-37.3,10.2 -77,13q-18.7,2.9 -34,6q-29.3,5.9 -31,7" fill="none" stroke="#d7273d" stroke-width=".8"></path><path d="M490,83q77-1 130-1q6,0 14-4" fill="none" stroke="#ffffff" stroke-width=".8"></path><path d="M478,121q116,0 126-1q8.8-.9 13-3" fill="none" stroke="#00875a" stroke-width=".8"></path><path d="M462,188q83.9-1.8 95-4q19.2-2 35-3q1.2-.1 6-1" fill="none" stroke="#00875a" stroke-width="1.5"></path><path d="M493,220q89.1,0 162,0" fill="none" stroke="#00875a" stroke-width="2.5"></path><path d="M451,140l0-20q-71,0 -157,0l0,20q86,0 157,0" fill="#2576b94d"></path><path d="M48,63l41,0l0,41l-41,0l0-41" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M139,161l0-20l-95,0l0,20l95,0" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M155,212q0-23 -20-35q-20-11 -40,0q-20,12 -20,35q0,23 20,35q20,11 40,0q20-12 20-35" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M205,216l57,41l-64,29l7-70" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M384,281l-11,19l-23,0l-11-19l11-20l23,0l11,20" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M431,297l24-30l24,30l-24,30l-24-30" fill="#f99f07" stroke="#000000" stroke-width="1"></path><path d="M561,435l151,40l-151-41l0-1l-1,1l0,1l1,0" fill="#f99f07"></path><path d="M355,433l-140,36l140-35l1,0l0-1l-1-1l0,1" fill="#f99f07"></path></svg>
`;
      await refEditor.current.loadFromSVG(d);

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
        document.querySelector('.imageEditorContainer').style.pointerEvents = 'none';
      } else {
        document.querySelector('.imageEditorContainer').style.pointerEvents = 'auto';
      }
    }
  }, [refEditor.current, edit]);

  const setColorPen = (color: string) => {
    const penTool = refEditor.current.toolController.getPrimaryTools()[2];
    const shapeWidget = refWidget.current.getWidgetById('pen-1');

    console.log(refWidget.current);
    console.log(shapeWidget);

    if (penTool && shapeWidget) {
      penTool.setColor(color);
      shapeWidget.serializeState();
    }
  };

  const setThicknessPen = (thickness: number) => {
    const penTool = refEditor.current.toolController.getPrimaryTools()[2];
    const shapeWidget = refWidget.current.getWidgetById('pen-1');

    if (penTool && shapeWidget) {
      penTool.setThickness(thickness);
      shapeWidget.serializeState();
    }
  };

  const setColorHighlight = (color: string) => {
    const penTool = refEditor.current.toolController.getPrimaryTools()[3];

    const shapeWidget = refWidget.current.getWidgetById('pen-2');

    if (penTool && shapeWidget) {
      penTool.setColor(color);
      shapeWidget.serializeState();
    }
  };

  const changeShape = (type: any) => {
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (shapeWidget) {
      shapeWidget.setShapeType(type);
    }
  };

  const changeColorShape = (color: string) => {
    const penTool = refEditor.current.toolController.getPrimaryTools()[5];
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (penTool && shapeWidget) {
      penTool.setColor(color);
      shapeWidget.serializeState();
    }
  };

  const changeBorderColorShape = (color: string) => {
    const penTool = refEditor.current.toolController.getPrimaryTools()[5];
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (penTool && shapeWidget) {
      penTool.setBorderColor(color);
      shapeWidget.serializeState();
    }
  };

  return (
    <>
      <div className='wrapper'>
        <button
          onClick={() => setEdit(!edit)}
        >
          {!edit ? 'Edit ✅' : 'Disable ❌'}
        </button>

        <button
          onClick={() => {
            const penTool = refEditor.current.toolController.getPrimaryTools();

            if (tool === 'select') {
              setTool(null);
              penTool[0].setEnabled(false);

              return;
            }
            setTool('select');
            penTool[0].setEnabled(true);
          }}
        >
          Select Tool
          {' '}
          {tool === 'select' && '✅'}
        </button>

        <button onClick={() => {
          const penTool = refEditor.current.toolController.getPrimaryTools();

          refEditor.current.toolController.setToolEnabled(penTool[1]);
          if (tool === 'text') {
            penTool[1].setEnabled(false);

            setTool(null);
            return;
          }
          setTool('text');
          penTool[1].setEnabled(true);
        }}
        >
          Text
          {' '}
          {tool === 'text' && '✅'}
        </button>

        <button onClick={() => {
          const penTool = refEditor.current.toolController.getPrimaryTools();

          if (tool === 'pencil') {
            setTool(null);
            penTool[2].setEnabled(false);
            return;
          }
          setTool('pencil');
          penTool[2].setEnabled(true);
        }}
        >
          Pencil Tool
          {' '}
          {tool === 'pencil' && '✅'}
        </button>

        {tool === 'pencil' && <PencilOption
          setColorPen={setColorPen}
          setThicknessPen={setThicknessPen}
        />}

        <button onClick={() => {
          const penTool = refEditor.current.toolController.getPrimaryTools();

          if (tool === 'highlighter') {
            setTool(null);
            penTool[3].setEnabled(false);
            return;
          }
          setTool('highlighter');
          penTool[3].setEnabled(true);
        }}
        >
          Highlighter
          {' '}
          {tool === 'highlighter' && '✅'}
        </button>

        {tool === 'highlighter' && <HighlightOption setColorHighlight={setColorHighlight}/>}

        <button onClick={() => {
          const penTool = refEditor.current.toolController.getPrimaryTools();

          if (tool === 'eraser') {
            setTool(null);
            penTool[4].setEnabled(false);
            return;
          }
          setTool('eraser');
          penTool[4].setEnabled(true);
        }}
        >
          Eraser
          {' '}
          {tool === 'eraser' && '✅'}
        </button>

        <button onClick={() => {
          const penTool = refEditor.current.toolController.getPrimaryTools();

          refEditor.current.toolController.setToolEnabled(penTool[5]);

          if (tool === 'shapes') {
            setTool(null);
            penTool[5].setEnabled(false);
            return;
          }
          setTool('shapes');
          penTool[5].setEnabled(true);
        }}
        >
          Shapes
          {' '}
          {tool === 'shapes' && '✅'}
        </button>

        {tool === 'shapes' && <ShapeOption
          changeBorderColorShape={changeBorderColorShape}
          changeColorShape={changeColorShape}
          changeShape={changeShape}
                              />}
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
