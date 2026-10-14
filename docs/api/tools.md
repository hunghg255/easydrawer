# editor.tools

Named access to the built-in tools.

```ts
type ToolName = 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'laser' | 'eyedropper';
```

## Methods

### `use(name: ToolName | null)`

Make `name` the active tool. `null` disables all drawing tools (pan & zoom only).

```ts
editor.tools.use('highlighter');
```

### `active: ToolName | null`

The active tool.

### `configure(name, options)`

Change some options of a tool. Options that aren't passed keep their value.

```ts
editor.tools.configure('pen', { color: '#e11d48', thickness: 4, style: 'natural' });
```

Options by tool:

```ts
interface PenToolOptions {          // 'pen' and 'highlighter'
  color?: string | Color4;
  thickness?: number;
  style?: 'natural' | 'pencil' | 'calligraphy' | 'marker' | 'flat-tip' | 'round-tip' | 'polyline' | ComponentBuilderFactory;
  pressureSensitive?: boolean;
  stabilization?: boolean;
  autocorrect?: boolean;
}

interface ShapeToolOptions {
  shape?: 'square' | 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'diamond'
        | 'arrow' | 'line' | 'heart' | 'star' | 'cloud' | 'parallelogram'
        | ComponentBuilderFactory;
  color?: string | Color4;          // fill
  borderColor?: string | Color4;
  thickness?: number;               // border width
}

interface EraserToolOptions {
  thickness?: number;
  mode?: 'full-stroke' | 'partial-stroke';
}

interface TextToolOptions {
  color?: string | Color4;
  fontSize?: number;
  fontFamily?: string;
}

interface SelectToolOptions {
  mode?: 'rectangle' | 'lasso';
}

interface LaserToolOptions {
  color?: string | Color4;
  thickness?: number;             // screen pixels
}

interface StickyToolOptions {
  color?: string | Color4;        // color of new notes
}

interface ConnectorToolOptions {
  color?: string | Color4;
  thickness?: number;             // pixels at the zoom used when drawing
  arrow?: 'end' | 'both' | 'none';
}
```

### `onChange(callback): () => void`

Call `callback(activeToolName)` whenever the active tool changes. Returns a function that removes the listener.

### `get(name)`

The tool object for `name`, or `null` if it was removed with `toolController`.

## Tool objects

| Property | Type |
| --- | --- |
| `pen`, `highlighter` | `PenTool` |
| `eraser` | `EraserTool` |
| `shape` | `ShapeTool` |
| `text` | `TextTool` |
| `select` | `SelectionTool` |
| `laser` | `LaserPointer` |
| `eyedropper` | `PipetteTool` |
| `sticky` | `StickyNoteTool` — `edit(note)` opens the text editor on a note |
| `connector` | `ConnectorTool` |

```ts
editor.tools.pen.getColor().toHexString();
editor.tools.select.getSelectedObjects();
```

## Presets

The tables of built-in pen styles and shapes are exported, e.g. to build a picker:

```ts
import { penStyles, shapeTypes } from 'easydrawer';

Object.keys(shapeTypes); // ['square', 'rectangle', 'circle', …]
```
