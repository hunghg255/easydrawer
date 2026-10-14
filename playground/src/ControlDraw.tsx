import { type ReactNode, useEffect, useState } from 'react';

import { ColorPicker } from 'antd';
import classNames from 'classnames';
import {
  type BackgroundTypeName,
  type Editor,
  type PenStyleName,
  type ShapeTypeName,
  type ToolName,
} from 'easydrawer';

import styles from './control.module.css';
import {
  AkarIconsDotGridFill,
  AkarIconsParallelogram,
  FluentColorBackground24Filled,
  GardenUploadStroke12,
  HugeiconsCursorRectangleSelection01,
  HugeiconsPng01,
  HugeiconsSvg01,
  IcSharpArrowRightAlt,
  IcSharpFavorite,
  IcSharpGrid4x4,
  MageImageUpload,
  MaterialSymbolsCircleOutline,
  MaterialSymbolsCloud,
  MaterialSymbolsDelete,
  MaterialSymbolsEdit,
  MaterialSymbolsHexagonOutline,
  MaterialSymbolsKidStar,
  MaterialSymbolsRectangleOutline,
  MdiFormatLetterCase,
  MdiSquareOutline,
  MingcuteDiamondSquareLine,
  OuiEraser,
  PhHighlighter,
  PhLineSegmentFill,
  SolarUndoLeftRoundBold,
  SolarUndoRightRoundBold,
  TablerTriangle,
} from './icon';

const shapes: Array<{ type: ShapeTypeName; icon: ReactNode }> = [
  { type: 'square', icon: <MdiSquareOutline /> },
  { type: 'rectangle', icon: <MaterialSymbolsRectangleOutline /> },
  { type: 'circle', icon: <MaterialSymbolsCircleOutline /> },
  { type: 'triangle', icon: <TablerTriangle /> },
  { type: 'hexagon', icon: <MaterialSymbolsHexagonOutline /> },
  { type: 'diamond', icon: <MingcuteDiamondSquareLine /> },
  { type: 'arrow', icon: <IcSharpArrowRightAlt /> },
  { type: 'line', icon: <PhLineSegmentFill /> },
  { type: 'heart', icon: <IcSharpFavorite /> },
  { type: 'star', icon: <MaterialSymbolsKidStar /> },
  { type: 'cloud', icon: <MaterialSymbolsCloud /> },
  { type: 'parallelogram', icon: <AkarIconsParallelogram /> },
];

const penStyleLabels: Array<{ style: PenStyleName; label: string }> = [
  { style: 'natural', label: 'Ink' },
  { style: 'flat-tip', label: 'Flat' },
  { style: 'round-tip', label: 'Round' },
  { style: 'marker', label: 'Marker' },
];

const inkColors = ['#1f2937', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed'];
const highlightColors = [
  'rgba(250, 204, 21, 0.45)',
  'rgba(74, 222, 128, 0.4)',
  'rgba(96, 165, 250, 0.4)',
  'rgba(244, 114, 182, 0.4)',
];

function ToolButton({ active, disabled, title, onClick, children }: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={title}
      aria-pressed={active}
      className={classNames(styles.tool, { [styles.active]: active })}
      disabled={disabled}
      title={title}
      type='button'
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Swatches({ colors, value, onChange }: {
  colors: string[];
  value?: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className={styles.swatches}>
      {colors.map((color) => (
        <button
          aria-label={color}
          className={classNames(styles.swatch, { [styles.swatchActive]: value === color })}
          key={color}
          style={{ background: color }}
          type='button'
          onClick={() => onChange(color)}
        />
      ))}
      <ColorPicker onChangeComplete={(color) => onChange(color.toRgbString())} />
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <input
        max={max}
        min={min}
        step={step}
        type='range'
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </label>
  );
}

function PenOptions({ editor, tool }: { editor: Editor; tool: 'pen' | 'highlighter' }) {
  const pen = editor.tools[tool];
  const [color, setColor] = useState<string>();
  const [thickness, setThickness] = useState(pen.getThickness());
  const [style, setStyle] = useState<PenStyleName>(tool === 'pen' ? 'natural' : 'marker');

  return (
    <div className={styles.options}>
      <Swatches
        colors={tool === 'pen' ? inkColors : highlightColors}
        value={color}
        onChange={(newColor) => {
          setColor(newColor);
          editor.tools.configure(tool, { color: newColor });
        }}
      />

      <div className={styles.line} />

      <Slider
        label='Size'
        max={tool === 'pen' ? 16 : 48}
        min={1}
        step={0.5}
        value={thickness}
        onChange={(value) => {
          setThickness(value);
          editor.tools.configure(tool, { thickness: value });
        }}
      />

      <div className={styles.line} />

      <div className={styles.segmented}>
        {penStyleLabels.map(({ style: penStyle, label }) => (
          <button
            className={classNames({ [styles.active]: style === penStyle })}
            key={penStyle}
            type='button'
            onClick={() => {
              setStyle(penStyle);
              editor.tools.configure(tool, { style: penStyle });
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeOptions({ editor }: { editor: Editor }) {
  const [shape, setShape] = useState<ShapeTypeName>('square');
  const [borderWidth, setBorderWidth] = useState(editor.tools.shape.getThickness());

  return (
    <div className={styles.options}>
      <div className={styles.shapeGrid}>
        {shapes.map(({ type, icon }) => (
          <ToolButton
            active={shape === type}
            key={type}
            title={type}
            onClick={() => {
              setShape(type);
              editor.tools.configure('shape', { shape: type });
            }}
          >
            {icon}
          </ToolButton>
        ))}
      </div>

      <div className={styles.line} />

      <span className={styles.label}>Fill</span>
      <Swatches
        colors={['transparent', ...inkColors]}
        onChange={(color) => editor.tools.configure('shape', { color })}
      />

      <span className={styles.label}>Border</span>
      <Swatches
        colors={inkColors}
        onChange={(borderColor) => editor.tools.configure('shape', { borderColor })}
      />

      <Slider
        label='Border'
        max={20}
        min={0}
        step={1}
        value={borderWidth}
        onChange={(value) => {
          setBorderWidth(value);
          editor.tools.configure('shape', { thickness: value });
        }}
      />
    </div>
  );
}

function ControlDrawer({ editor, onOpenSvg, onSaveSvg, onSavePng, onUploadImage }: {
  editor: Editor;
  onOpenSvg: () => void;
  onSaveSvg: () => void;
  onSavePng: () => void;
  onUploadImage: () => void;
}) {
  const [tool, setTool] = useState<ToolName | null>(editor.tools.active);
  const [background, setBackground] = useState<BackgroundTypeName>('none');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const removeToolListener = editor.tools.onChange(setTool);
    const removeChangeListener = editor.onChange(() => {
      setCanUndo(editor.canUndo());
      setCanRedo(editor.canRedo());
    });

    return () => {
      removeToolListener();
      removeChangeListener();
    };
  }, [editor]);

  const toggleTool = (name: ToolName) => {
    editor.tools.use(tool === name ? null : name);
  };

  const toggleBackground = (type: BackgroundTypeName) => {
    const newType = background === type ? 'none' : type;
    editor.setBackground({ type: newType });
    setBackground(newType);
  };

  const tools: Array<{ name: ToolName; title: string; icon: ReactNode }> = [
    { name: 'select', title: 'Select', icon: <HugeiconsCursorRectangleSelection01 /> },
    { name: 'text', title: 'Text', icon: <MdiFormatLetterCase /> },
    { name: 'pen', title: 'Pen', icon: <MaterialSymbolsEdit /> },
    { name: 'highlighter', title: 'Highlighter', icon: <PhHighlighter /> },
    { name: 'eraser', title: 'Eraser', icon: <OuiEraser /> },
    { name: 'shape', title: 'Shapes', icon: <MdiSquareOutline /> },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.pen}>
        {tools.map(({ name, title, icon }) => (
          <ToolButton active={tool === name} key={name} title={title} onClick={() => toggleTool(name)}>
            {icon}
          </ToolButton>
        ))}

        <div className={styles.line} />

        <ToolButton title='Insert image' onClick={onUploadImage}>
          <MageImageUpload />
        </ToolButton>

        <div className={styles.line} />

        <ToolButton disabled={!canUndo} title='Undo' onClick={() => editor.undo()}>
          <SolarUndoLeftRoundBold />
        </ToolButton>
        <ToolButton disabled={!canRedo} title='Redo' onClick={() => editor.redo()}>
          <SolarUndoRightRoundBold />
        </ToolButton>
        <ToolButton title='Clear' onClick={() => editor.clear()}>
          <MaterialSymbolsDelete />
        </ToolButton>

        <div className={styles.line} />

        <ToolButton title='Open SVG' onClick={onOpenSvg}>
          <GardenUploadStroke12 />
        </ToolButton>
        <ToolButton title='Save SVG' onClick={onSaveSvg}>
          <HugeiconsSvg01 />
        </ToolButton>
        <ToolButton title='Save PNG' onClick={onSavePng}>
          <HugeiconsPng01 />
        </ToolButton>

        <div className={styles.line} />

        <ToolButton active={background === 'solid'} title='Solid background' onClick={() => toggleBackground('solid')}>
          <FluentColorBackground24Filled />
        </ToolButton>
        <ToolButton active={background === 'grid'} title='Grid' onClick={() => toggleBackground('grid')}>
          <IcSharpGrid4x4 />
        </ToolButton>
        <ToolButton active={background === 'dot'} title='Dots' onClick={() => toggleBackground('dot')}>
          <AkarIconsDotGridFill />
        </ToolButton>
      </div>

      {(tool === 'pen' || tool === 'highlighter') && (
        <PenOptions editor={editor} key={tool} tool={tool} />
      )}
      {tool === 'shape' && <ShapeOptions editor={editor} />}
      {background !== 'none' && (
        <div className={styles.options}>
          <span className={styles.label}>Background</span>
          <Swatches
            colors={['#ffffff', '#fffbea', '#f1f5f9', '#ecfdf5', '#1f2937']}
            onChange={(color) => editor.setBackground({ color })}
          />
        </div>
      )}
    </div>
  );
}

export default ControlDrawer;
