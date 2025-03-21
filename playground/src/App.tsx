import React, { useEffect, useState } from 'react';

import { Button, ColorPicker, Row, Slider } from 'antd';
import {
  makeDropdownToolbar,
  Editor,
  Color4,
} from 'easydrawer';
import { Circle,Triangle, Diamond, RectangleHorizontal, Square, LucideArrowLeft } from 'lucide-react';

import styles from './App.module.css';

export function TablerHexagonalPrism() {
  return (
    <svg height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="m20.792 6.996l-3.775 2.643A2 2 0 0 1 15.87 10H8.13c-.41 0-.81-.126-1.146-.362L3.21 6.997M8 10v11m8-11v11"></path>
        <path d="m3.853 18.274l3.367 2.363A2 2 0 0 0 8.367 21h7.265c.41 0 .811-.126 1.147-.363l3.367-2.363c.536-.375.854-.99.854-1.643V7.369c0-.655-.318-1.268-.853-1.643L16.78 3.363A2 2 0 0 0 15.633 3H8.367c-.41 0-.811.126-1.147.363L3.853 5.726A2 2 0 0 0 3 7.37v9.261c0 .655.318 1.269.853 1.644z"></path>
      </g>
    </svg>
  );
}

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
  const [thickness, setThickness] = useState(1.5);

  return (
    <div className={styles.options}>
      <div>
        <p>
          Color
        </p>

        <ColorPicker
          onChange={(color) => setColorPen(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div>
        <p>
          Lighweight
        </p>

        <Button onClick={() => {
          setThicknessPen(1.5);
          setThickness(1.5);
        }}
        style={{
          border: thickness === 1.5 ? '3px solid black' : '1px solid #aaa',
        }}
        >
          1.5
        </Button>

        <Button onClick={() => {
          setThicknessPen(3);
          setThickness(3);
        }}
        style={{
          margin: '0 10px',
          border: thickness ===3 ? '3px solid black' : '1px solid #aaa',
        }}
        >
          3
        </Button>

        <Button onClick={() => {
          setThicknessPen(5);
          setThickness(5);
        }}
        style={{
          border: thickness === 5 ? '3px solid black' : '1px solid #aaa',
        }}
        >
          5
        </Button>
      </div>
    </div>
  );
}

function HighlightOption ({ setColorHighlight }: any) {
  return (
    <div className={styles.options}>
      <div>
        <p>
          Color
        </p>

        <ColorPicker
          onChange={(color) => setColorHighlight(Color4.fromHex(color.toHex()))}
        />
      </div>
    </div>
  );
}

function ShapeOption ({ changeShape, changeColorShape, changeBorderColorShape,
  onThicknessChange

}: any) {
  const [type, setType] = useState(ShapeType.square);

  return (
    <div className={styles.options}>
      <div>
        <p>
          Type
        </p>

        <Button onClick={() => {
          changeShape(ShapeType.square);
          setType(ShapeType.square);
        }}
        style={{
          border: type === ShapeType.square ? '3px solid black' : '1px solid #aaa',
          margin: '0 5px',
        }}
        >
          <Square />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.rectangle);
            setType(ShapeType.rectangle);
          }}
          style={{
            border: type === ShapeType.rectangle ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <RectangleHorizontal />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.circle);
            setType(ShapeType.circle);
          }}
          style={{
            border: type === ShapeType.circle ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <Circle />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.triangle);
            setType(ShapeType.triangle);
          }}
          style={{
            border: type === ShapeType.triangle ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <Triangle />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.hexagonal);
            setType(ShapeType.hexagonal);
          }}
          style={{
            border: type === ShapeType.hexagonal ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <TablerHexagonalPrism />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.diamond);
            setType(ShapeType.diamond);
          }}
          style={{
            border: type === ShapeType.diamond ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <Diamond />
        </Button>

        <Button
          onClick={() => {
            changeShape(ShapeType.arrow);
            setType(ShapeType.arrow);
          }}
          style={{
            border: type === ShapeType.arrow ? '3px solid black' : '1px solid #aaa',
            margin: '0 5px',
          }}
        >
          <LucideArrowLeft />
        </Button>
      </div>

      <div>
        <p>
          Filled Color
        </p>

        <ColorPicker
          onChange={(color) => changeColorShape(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div>
        <p>
          Border Color
        </p>

        <ColorPicker
          onChange={(color) => changeBorderColorShape(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div>
        <p>
          Border Thickness
        </p>

        <Slider
          onChange={(value) => onThicknessChange(value)}
        />
      </div>
    </div>
  );
}

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
        {
          !edit ? <div
            className={styles.btnEdit}
            onClick={() => setEdit(true)}
          >
            <Button
              onClick={() => setEdit(false)}
              type='dashed'
            >
              Edit
            </Button>
          </div> :
            <div
              className={styles.wrapper}
            >
              <Row justify={'end'}>
                <Button
                  onClick={() => setEdit(false)}
                  type='dashed'
                >
                  ❌
                </Button>
              </Row>

              <Button
                type='primary'

                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  if (tool === 'select') {
                    setTool(null);
                    penTool[0].setEnabled(false);

                    return;
                  }
                  setTool('select');
                  penTool[0].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Select Tool
                {' '}
                {tool === 'select' && '✅'}
              </Button>

              <Button
                type='primary'

                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  refEditor.current!.toolController.setToolEnabled(penTool[1]);
                  if (tool === 'text') {
                    penTool[1].setEnabled(false);

                    setTool(null);
                    return;
                  }
                  setTool('text');
                  penTool[1].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Text
                {' '}
                {tool === 'text' && '✅'}
              </Button>

              <Button
                type='primary'

                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  if (tool === 'pencil') {
                    setTool(null);
                    penTool[2].setEnabled(false);
                    return;
                  }
                  setTool('pencil');
                  penTool[2].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Pencil Tool
                {' '}
                {tool === 'pencil' && '✅'}
              </Button>

              {tool === 'pencil' && <PencilOption
                setColorPen={setColorPen}
                setThicknessPen={setThicknessPen}
                                    />}

              <Button
                type='primary'

                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  if (tool === 'highlighter') {
                    setTool(null);
                    penTool[3].setEnabled(false);
                    return;
                  }
                  setTool('highlighter');
                  penTool[3].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Highlighter
                {' '}
                {tool === 'highlighter' && '✅'}
              </Button>

              {tool === 'highlighter' && <HighlightOption setColorHighlight={setColorHighlight}/>}

              <Button
                type='primary'

                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  if (tool === 'eraser') {
                    setTool(null);
                    penTool[4].setEnabled(false);
                    return;
                  }
                  setTool('eraser');
                  penTool[4].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Eraser
                {' '}
                {tool === 'eraser' && '✅'}
              </Button>

              <Button
                type='primary'
                onClick={() => {
                  const penTool = refEditor.current!.toolController.getPrimaryTools() as any;

                  refEditor.current!.toolController.setToolEnabled(penTool[5]);

                  if (tool === 'shapes') {
                    setTool(null);
                    penTool[5].setEnabled(false);
                    return;
                  }
                  setTool('shapes');
                  penTool[5].setEnabled(true);
                }}
                style={{
                  width: '100%',
                }}
              >
                Shapes
                {' '}
                {tool === 'shapes' && '✅'}
              </Button>

              {tool === 'shapes' && <ShapeOption
                changeBorderColorShape={changeBorderColorShape}
                changeColorShape={changeColorShape}
                changeShape={changeShape}
                onThicknessChange={onThicknessChange}
              />}

              <hr />

              <Button
                onClick={onUndo}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Undo
              </Button>

              <Button
                onClick={onRedo}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Redo
              </Button>

              <Button
                onClick={onClear}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Clear
              </Button>

              <br />
              <hr />

              <Button
                onClick={loadButtonSvg}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Load SVG
              </Button>

              <Button
                onClick={saveButtonSvg}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Save SVG
              </Button>

              <Button
                onClick={saveButtonImage}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Save PNG
              </Button>

              <Button
                onClick={toggleGrid}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Toogle Grid
                {' '}
                {bg === 'grid' ? '❌' : '✅'}
              </Button>

              <Button
                onClick={toggleDot}
                type='primary'
                style={{
                  width: '100%',
                }}
              >
                Toogle Dot
                {' '}
                {bg === 'dot' ? '❌' : '✅'}
              </Button>

            </div>
        }

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
