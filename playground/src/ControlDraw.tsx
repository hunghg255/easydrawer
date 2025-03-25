import { useState } from 'react';

import { ColorPicker } from 'antd';
import classNames from 'classnames';
import {
  Color4
} from 'easydrawer';

import styles from './control.module.css';
import { AkarIconsDotGridFill, GardenUploadStroke12, MingcuteDiamondSquareLine, HugeiconsCursorRectangleSelection01, HugeiconsPng01, HugeiconsSvg01, IcSharpArrowRightAlt, IcSharpGrid4x4, MaterialSymbolsCircleOutline, MaterialSymbolsDelete, MaterialSymbolsEdit, MaterialSymbolsHexagonOutline, MaterialSymbolsRectangleOutline, MdiFormatLetterCase, MdiSquareOutline, OuiEraser, PhHighlighter, SolarUndoLeftRoundBold, SolarUndoRightRoundBold, TablerTriangle, MageImageUpload, FluentColorBackground24Filled, PhLineSegmentFill, IcSharpFavorite, MaterialSymbolsKidStar, MaterialSymbolsCloud, AkarIconsParallelogram } from './icon';

const enum ShapeType {
  square = 0,
  rectangle = 1,
  circle = 2,
  triangle = 3,
  hexagonal = 4,
  diamond = 5,
  arrow = 6,
  line = 7,
  heart = 8,
  star = 9,
  cloud = 10,
  parallelogram = 11
}

function PencilOption({ setColorPen, setThicknessPen }: any) {
  const [thickness, setThickness] = useState(2);

  return (
    <div className={styles.options}>
      <div>
        <ColorPicker
          onChange={(color) => setColorPen(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div className={styles.line}></div>

      <div>
        <input max={10}
          min={1}
          step={0.1}
          type="range"
          value={thickness}
          onChange={(e) => {
            setThicknessPen(Number.parseFloat(e.target.value));
            setThickness(Number.parseFloat(e.target.value));
          }}
        />
      </div>
    </div>
  );
}

function HighlightOption({ setColorHighlight }: any) {
  return (
    <div className={styles.options}>
      <ColorPicker
        onChange={(color) => setColorHighlight(Color4.fromHex(color.toHex()))}
      />
    </div>
  );
}

function BgOption({ setColorBackground }: any) {
  return (
    <div className={styles.options}>
      <ColorPicker
        onChange={(color) => setColorBackground(Color4.fromHex(color.toHex()))}
      />
    </div>
  );
}

function ShapeOption({ changeColorShape, changeBorderColorShape,
  onThicknessChange
}: any) {

  return (
    <div className={styles.options}>
      <div>
        <ColorPicker
          onChange={(color) => changeColorShape(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div className={styles.line}></div>

      <div>
        <ColorPicker
          onChange={(color) => changeBorderColorShape(Color4.fromHex(color.toHex()))}
        />
      </div>

      <div className={styles.line}></div>

      <div>
        <input defaultValue={0}
          max={20}
          min={0}
          step={1}
          type="range"
          // value={thickness}
          onChange={(e) => {
            onThicknessChange(Number.parseFloat(e.target.value));
          }}
        />
      </div>
    </div>
  );
}

function ControlDrawer(props: any) {
  const {
    setColorPen,
    refEditor,
    setThicknessPen,
    setColorHighlight,
    changeBorderColorShape,
    onUndo,
    changeColorShape,
    changeShape,
    onThicknessChange,
    onRedo,
    onClear,
    loadbuttonSvg,
    savebuttonSvg,
    savebuttonImage,
    toggleGrid,
    toggleDot,
    bg,
    toggleBackground,
    setColorBackground,
    onUploadImage
  } = props;
  const [tool, setTool] = useState<'select' | 'text' | 'pencil' | 'highlighter' | 'eraser' | 'shapes' | null>(null);

  const [type, setType] = useState(ShapeType.square);

  return (
    <>
      <div
        className={styles.wrapper}
      >
        <div className={styles.pen}>
          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'select',
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              if (tool === 'select') {
                setTool(null);
                penTool[0].setEnabled(false);

                return;
              }
              setTool('select');
              penTool[0].setEnabled(true);
            }}
          >
            <HugeiconsCursorRectangleSelection01 />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'text',
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[1]);
              if (tool === 'text') {
                penTool[1].setEnabled(false);

                setTool(null);
                return;
              }
              setTool('text');
              penTool[1].setEnabled(true);
            }}
          >
            <MdiFormatLetterCase />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'pencil',
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              if (tool === 'pencil') {
                setTool(null);
                penTool[2].setEnabled(false);
                return;
              }
              setTool('pencil');
              penTool[2].setEnabled(true);
            }}
          >
            <MaterialSymbolsEdit />
          </button>

          <button

            className={classNames(styles.tool, {
              [styles.active]: tool === 'highlighter',
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              if (tool === 'highlighter') {
                setTool(null);
                penTool[3].setEnabled(false);
                return;
              }
              setTool('highlighter');
              penTool[3].setEnabled(true);
            }}
          >
            <PhHighlighter />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'eraser',
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              if (tool === 'eraser') {
                setTool(null);
                penTool[4].setEnabled(false);
                return;
              }
              setTool('eraser');
              penTool[4].setEnabled(true);
            }}
          >
            <OuiEraser />
          </button>

          <div className={styles.line}></div>

          <button className={classNames(styles.tool, {
            [styles.active]: tool === 'shapes' && type === ShapeType.square,
          })}
          onClick={() => {
            const penTool = refEditor.current!.toolController.getPrimaryTools();

            refEditor.current!.toolController.setToolEnabled(penTool[5]);
            setTool('shapes');
            penTool[5].setEnabled(true);

            changeShape(ShapeType.square);
            setType(ShapeType.square);
          }}
          >
            <MdiSquareOutline />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.rectangle,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.rectangle);
              setType(ShapeType.rectangle);
            }}
          >
            <MaterialSymbolsRectangleOutline />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.circle,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.circle);
              setType(ShapeType.circle);
            }}
          >
            <MaterialSymbolsCircleOutline />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.triangle,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.triangle);
              setType(ShapeType.triangle);
            }}
          >
            <TablerTriangle />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.hexagonal,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.hexagonal);
              setType(ShapeType.hexagonal);
            }}
          >
            <MaterialSymbolsHexagonOutline />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.diamond,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.diamond);
              setType(ShapeType.diamond);
            }}
          >
            <MingcuteDiamondSquareLine />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.arrow,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.arrow);
              setType(ShapeType.arrow);
            }}
          >
            <IcSharpArrowRightAlt />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.line,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.line);
              setType(ShapeType.line);
            }}
          >
            <PhLineSegmentFill />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.line,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.heart);
              setType(ShapeType.heart);
            }}
          >
            <IcSharpFavorite />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.line,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.star);
              setType(ShapeType.star);
            }}
          >
            <MaterialSymbolsKidStar />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.line,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.cloud);
              setType(ShapeType.cloud);
            }}
          >
            <MaterialSymbolsCloud />
          </button>

          <button
            className={classNames(styles.tool, {
              [styles.active]: tool === 'shapes' && type === ShapeType.line,
            })}
            onClick={() => {
              const penTool = refEditor.current!.toolController.getPrimaryTools();

              refEditor.current!.toolController.setToolEnabled(penTool[5]);
              setTool('shapes');
              penTool[5].setEnabled(true);

              changeShape(ShapeType.parallelogram);
              setType(ShapeType.parallelogram);
            }}
          >
            <AkarIconsParallelogram />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool)}
            onClick={onUploadImage}
          >
            <MageImageUpload />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool)}
            onClick={onUndo}
          >
            <SolarUndoLeftRoundBold />
          </button>

          <button
            className={classNames(styles.tool)}

            onClick={onRedo}

          >
            <SolarUndoRightRoundBold />
          </button>

          <button
            className={classNames(styles.tool)}

            onClick={onClear}

          >
            <MaterialSymbolsDelete />
          </button>

          <div className={styles.line}></div>

          <button
            className={classNames(styles.tool)}

            onClick={loadbuttonSvg}

          >
            <GardenUploadStroke12 />
          </button>

          <button
            className={classNames(styles.tool)}

            onClick={savebuttonSvg}

          >
            <HugeiconsSvg01 />
          </button>

          <button
            className={classNames(styles.tool)}

            onClick={savebuttonImage}

          >
            <HugeiconsPng01 />
          </button>

          <div className={styles.line}></div>

          <button
            onClick={toggleBackground}
            className={classNames(styles.tool, {
              [styles.active]: bg === 'bg',
            })}
          >
            <FluentColorBackground24Filled />
          </button>

          <button
            onClick={toggleGrid}
            className={classNames(styles.tool, {
              [styles.active]: bg === 'grid',
            })}
          >
            <IcSharpGrid4x4 />
          </button>

          <button
            onClick={toggleDot}
            className={classNames(styles.tool, {
              [styles.active]: bg === 'dot',
            })}
          >
            <AkarIconsDotGridFill />
          </button>
        </div>

        <div className={styles.optionsWrap}>
          {tool === 'pencil' && <PencilOption
            setColorPen={setColorPen}
            setThicknessPen={setThicknessPen}
          />}

          {tool === 'highlighter' && <HighlightOption setColorHighlight={setColorHighlight} />}

          {tool === 'shapes' && <ShapeOption
            changeBorderColorShape={changeBorderColorShape}
            changeColorShape={changeColorShape}
            changeShape={changeShape}
            onThicknessChange={onThicknessChange}
          />}

          {bg === 'bg' && <BgOption
            setColorBackground={setColorBackground}
          />}
        </div>
      </div>

    </>
  );
}

export default ControlDrawer;
