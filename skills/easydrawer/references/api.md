# EasyDrawer API reference

## `new Editor(parent: HTMLElement, settings?: Partial<EditorSettings>)`

| Setting | Type | Default |
| --- | --- | --- |
| `tools.initial` | `ToolName \| null` | `'pen'` |
| `tools.pen` / `tools.highlighter` | `PenToolOptions` | black 2px natural / translucent 24px marker |
| `tools.shape` | `ShapeToolOptions` | |
| `tools.eraser` | `EraserToolOptions` | |
| `tools.text` | `TextToolOptions` | |
| `input.stylusOnly` | `boolean \| 'auto'` | `'auto'` |
| `background` | `{ type?: 'none' \| 'solid' \| 'grid' \| 'dot'; color?: string \| Color4 }` | none |
| `minZoom` / `maxZoom` | `number` | `2e-10` / `1e12` |
| `disableZoom` | `boolean` | `false` |
| `wheelEventsEnabled` | `boolean \| 'only-if-focused'` | `true` |
| `localization` | `Partial<EditorLocalization>` | browser language |
| `keyboardShortcutOverrides` | `Record<string, KeyBinding[]>` | |
| `text.fonts` | `string[]` | |
| `clipboardApi` | `{ read(), write(data) }` | browser clipboard |

## Tool options

```ts
interface PenToolOptions {            // 'pen', 'highlighter'
  color?: string | Color4;
  thickness?: number;                 // px at 100% zoom, medium pressure
  style?: 'natural' | 'marker' | 'flat-tip' | 'round-tip' | 'polyline' | ComponentBuilderFactory;
  pressureSensitive?: boolean;        // default true
  stabilization?: boolean;            // extra inertia smoothing, default false
  autocorrect?: boolean;              // hold still at end → line/rectangle, default false
}
interface ShapeToolOptions {
  shape?: 'square' | 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'diamond'
        | 'arrow' | 'line' | 'heart' | 'star' | 'cloud' | 'parallelogram' | ComponentBuilderFactory;
  color?: string | Color4;            // fill ('transparent' = outline only)
  borderColor?: string | Color4;
  thickness?: number;                 // border width
}
interface EraserToolOptions { thickness?: number; mode?: 'full-stroke' | 'partial-stroke' }
interface TextToolOptions { color?: string | Color4; fontSize?: number; fontFamily?: string }
interface SelectToolOptions { mode?: 'rectangle' | 'lasso' }
interface LaserToolOptions { color?: string | Color4; thickness?: number }   // 'laser'
```

## `editor.tools`

| Member | Description |
| --- | --- |
| `use(name \| null)` | Activate a tool |
| `active` | Active `ToolName \| null` |
| `configure(name, options)` | Partial update of a tool's options |
| `onChange(cb)` | Active tool changes; returns unsubscribe |
| `get(name)` | Tool object or `null` |
| `pen`, `highlighter` (`PenTool`), `eraser` (`EraserTool`), `shape` (`ShapeTool`), `text` (`TextTool`), `select` (`SelectionTool`), `laser` (`LaserPointer`) | Tool objects |

Useful tool-object methods: `pen.getColor()`, `pen.getThickness()`, `pen.getStrokeFactory()`,
`select.getSelectedObjects()`, `select.setSelection(components)`, `select.clearSelection()`.

## `Editor` methods

| Method | Description |
| --- | --- |
| `undo()`, `redo()`, `canUndo()`, `canRedo()` | History |
| `clear()` | Erase all non-background content (undoable) |
| `setBackground({ type?, color? })` | Change background (undoable) |
| `estimateBackgroundColor()` | `Color4` |
| `onChange(cb)` | After every change incl. undo/redo; returns unsubscribe |
| `toSVGString(opts?)`, `toSVG(opts?)` | Export SVG |
| `toDataURL(format?)` | Export raster image |
| `loadFromSVG(svg)` | Import SVG (async) |
| `uploadImages(files: File[])` | Insert images (async) |
| `setReadOnly(bool)` | View-only mode (pan/zoom and the laser pointer still work) |
| `getZoom()`, `setZoom(z, center?)`, `zoomIn()`, `zoomOut()`, `zoomToFit()` | Zoom |
| `onZoomChange(cb)` | Zoom changes; returns unsubscribe |
| `focus()` | Focus for keyboard shortcuts |
| `remove()` | Destroy |
| `history.clearAllStack()` | Forget undo history (e.g. after loading a file) |
| `viewport` | Pan/zoom; `viewport.canvasToScreen(p)`, `screenToCanvas(p)` |
| `image` | Document tree; `image.getAllComponents()` |
| `toolController.setStylusOnly(v)`, `isStylusOnly()` | Palm rejection |
| `notifier.on(EditorEventType.X, cb)` | Low-level events |

## Exports

`Editor`, `Color4`, `Vec2`, `Mat33`, `Rect2`, `Path`, `Stroke`, `penStyles`, `shapeTypes`,
`naturalPenBuilderFactory`, `makeNaturalPenBuilder`, `makeHighlighterBuilder`, `EditorEventType`,
types `ToolName`, `PenStyleName`, `ShapeTypeName`, `BackgroundTypeName`, `ColorInput`,
`PenToolOptions`, `ShapeToolOptions`, `EraserToolOptions`, `TextToolOptions`, `EditorSettings`.

CDN/global build: `https://unpkg.com/easydrawer/dist/easydrawer.js` exposes `window.EasyDrawer`.
