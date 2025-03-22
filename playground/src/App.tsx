import React, { useEffect, useState } from 'react';

import {
  Editor,
  makeDropdownToolbar
} from 'easydrawer';

import styles from './App.module.css';
import ControlDrawer from './ControlDraw';

let clear = false;

function App() {
  const [tool, setTool] = useState<'select' | 'text' | 'pencil' | 'highlighter' | 'eraser' | 'shapes' | null>(null);
  const [edit, setEdit] = useState(false);
  const refEditor = React.useRef<Editor | null>(null);
  const refWidget = React.useRef<any>(null);
  const [bg, setBg] = useState<'none' | 'grid' | 'dot'>('none');
  const refInput = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const init = async () => {
      const parentElement = document.querySelector('#easydrawer');

      if (!parentElement) return;

      refEditor.current = new Editor(parentElement as any);

      refWidget.current = makeDropdownToolbar(refEditor.current);
      refWidget.current.addDefaultToolWidgets();

      // document-properties-widget
    };

    init();

    setEdit(true);

  }, []);

  useEffect(() => {
    if (refEditor.current) {
      // refEditor.current.setReadOnly(!edit);

      // if (!edit) {
      //   //@ts-expect-error
      //   document.querySelector('.imageEditorContainer').style.pointerEvents = 'none';
      // } else {
      //   //@ts-expect-error
      //   document.querySelector('.imageEditorContainer').style.pointerEvents = 'auto';
      // }
    }
  }, [refEditor.current, edit]);

  const setColorPen = (color: string) => {
    const penTool = refEditor.current!.toolController.getPrimaryTools()[2] as any;
    const shapeWidget = refWidget.current.getWidgetById('pen-1');

    if (penTool && shapeWidget) {
      penTool.setColor(color);
      shapeWidget.serializeState();
    }
  };

  const setThicknessPen = (thickness: number) => {
    const penTool = refEditor.current!.toolController.getPrimaryTools()[2] as any;
    const shapeWidget = refWidget.current.getWidgetById('pen-1');

    if (penTool && shapeWidget) {
      penTool.setThickness(thickness);
      shapeWidget.serializeState();
    }
  };

  const setColorHighlight = (color: string) => {
    const penTool = refEditor.current!.toolController.getPrimaryTools()[3] as any;

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
    const penTool = refEditor.current!.toolController.getPrimaryTools()[5] as any;
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (penTool && shapeWidget) {
      penTool.setColor(color);
      shapeWidget.serializeState();
    }
  };

  const onThicknessChange = (v: any) => {
    const penTool = refEditor.current!.toolController.getPrimaryTools()[5] as any;
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (penTool && shapeWidget) {
      penTool.setThickness(v);
      shapeWidget.serializeState();
    }
  };

  const changeBorderColorShape = (color: string) => {
    const penTool = refEditor.current!.toolController.getPrimaryTools()[5] as any;
    const shapeWidget = refWidget.current.getWidgetById('shape');

    if (penTool && shapeWidget) {
      penTool.setBorderColor(color);
      shapeWidget.serializeState();
    }
  };

  const saveButtonSvg = () => {
    const svgElem = refEditor.current!.toSVG();

    console.log('The saved SVG:', svgElem.outerHTML);
    // download svg string
    const svgString = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawing.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveButtonImage = () => {
    const img = refEditor.current!.toDataURL('image/webp');
    const a = document.createElement('a');
    a.href = img;
    a.download = 'drawing.png';
    a.click();
  };

  const toggleGrid = () => {
    const documentW = refWidget.current.getWidgetById('document-properties-widget');

    if (bg !== 'grid') {
      documentW?.removeBackground();
      documentW?.setBackgroundGrid();
      setBg('grid');
    } else {
      documentW?.removeBackground();
      setBg('none');
    }
  };

  const toggleDot= () => {
    const documentW = refWidget.current.getWidgetById('document-properties-widget');

    if (bg !== 'dot') {
      documentW?.removeBackground();
      documentW?.setBackgroundDot();
      setBg('dot');
    } else {
      documentW?.removeBackground();
      setBg('none');
    }
  };

  const onUndo =() => {
    if (clear) {
      while (refEditor.current!.history.redoStackSize > 0) {
        refEditor.current!.history.redo();
      }
      clear = false;
      return;
    }

    refEditor.current!.history.undo();
  };

  const onRedo =() => {
    if (clear) {
      return;
    }

    refEditor.current!.history.redo();
  };

  const onClear =() => {
    if (clear) {
      return;
    }

    while (refEditor.current!.history.undoStackSize > 0) {
      onUndo();
    }
    clear = true;
  };

  const loadButtonSvg = () => {
    refInput.current!.click();
  };

  return (
    <>
      <div className={styles.lessonContent}>

        <ControlDrawer
          bg={bg}
          changeBorderColorShape={changeBorderColorShape}
          changeColorShape={changeColorShape}
          changeShape={changeShape}
          loadbuttonSvg={loadButtonSvg}
          onClear={onClear}
          onRedo={onRedo}
          onThicknessChange={onThicknessChange}
          onUndo={onUndo}
          refEditor={refEditor}
          savebuttonImage={saveButtonImage}
          savebuttonSvg={saveButtonSvg}
          setColorHighlight={setColorHighlight}
          setColorPen={setColorPen}
          setThicknessPen={setThicknessPen}
          setTool={setTool}
          toggleDot={toggleDot}
          toggleGrid={toggleGrid}
          tool={tool}
        />

        <div className={styles.easyDrawer}
          id='easydrawer'
        >
        </div>

        <input accept='image/svg+xml'
          ref={refInput}
          type='file'
          onChange={(e) => {
            const file = e.target.files![0];

            const reader = new FileReader();
            // eslint-disable-next-line unicorn/prefer-add-event-listener
            reader.onload = (e) => {
              const svg = e.target!.result as string;
              if (refEditor.current) {
                refEditor.current.history.clearAll();
                refEditor.current.loadFromSVG(svg);
              }
            };
            reader.readAsText(file);
          }}
          style={{
            display: 'none',
          }}
        />
      </div>
    </>
  );
}

export default App;
