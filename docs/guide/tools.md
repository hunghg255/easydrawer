# Tools

The editor has six built-in tools, addressed by name:

| Name | What it does |
| --- | --- |
| `'pen'` | Freehand ink (natural ink by default) |
| `'highlighter'` | Semi-transparent marker |
| `'eraser'` | Erases whole strokes or parts of strokes |
| `'shape'` | Draws shapes (rectangle, circle, star, arrow…) |
| `'text'` | Adds and edits text |
| `'select'` | Selects (rectangle or lasso), moves, resizes, rotates, duplicates and deletes |
| `'laser'` | Laser pointer for presenting: a glowing trail that fades away and is never saved |
| `'eyedropper'` | Picks a color from the drawing and gives it to the previous tool, then switches back |

Panning and zooming (two fingers, mouse wheel, right-click drag, keyboard) are always available.

## Switching tools

```ts
editor.tools.use('eraser');
editor.tools.use(null);   // no drawing tool: only pan & zoom
editor.tools.active;      // 'eraser' | … | null

const stop = editor.tools.onChange((name) => updateMyToolbar(name));
```

## Configuring tools

`configure` changes only the options you pass. Colors can be any CSS color string or a `Color4`.

```ts
editor.tools.configure('pen', { color: 'crimson', thickness: 4 });
editor.tools.configure('highlighter', { color: 'rgba(250, 204, 21, 0.45)', thickness: 24 });
editor.tools.configure('eraser', { thickness: 20, mode: 'partial-stroke' });
editor.tools.configure('text', { fontSize: 24, fontFamily: 'Georgia, serif', color: '#334155' });
```

Initial options can also be given to the constructor:

```ts
new Editor(element, {
  tools: {
    initial: 'pen',
    pen: { color: '#1f2937', thickness: 3 },
    eraser: { mode: 'partial-stroke' },
  },
});
```

### Pen & highlighter

| Option | Type | Default |
| --- | --- | --- |
| `color` | `string \| Color4` | black / translucent black |
| `thickness` | `number` (px at 100% zoom) | `2` / `24` |
| `style` | `'natural' \| 'pencil' \| 'calligraphy' \| 'marker' \| 'flat-tip' \| 'round-tip' \| 'polyline'` or a [custom factory](./natural-ink#custom-brushes) | `'natural'` / `'marker'` |
| `pressureSensitive` | `boolean` | `true` |
| `stabilization` | `boolean` — extra inertia-based smoothing | `false` |
| `autocorrect` | `boolean` — hold the pen still for ½ s at the end of a stroke to turn it into a straight line, circle/ellipse or rectangle | `true` (pen) / `false` (highlighter) |

### Shape

| Option | Type |
| --- | --- |
| `shape` | `'square' \| 'rectangle' \| 'circle' \| 'triangle' \| 'hexagon' \| 'diamond' \| 'arrow' \| 'line' \| 'heart' \| 'star' \| 'cloud' \| 'parallelogram'` |
| `color` | fill color (`'transparent'` for outlines only) |
| `borderColor` | border color |
| `thickness` | border width, `0` for none |

```ts
editor.tools.configure('shape', { shape: 'star', color: 'gold', borderColor: '#92400e', thickness: 2 });
editor.tools.use('shape');
```

<ClientOnly>
  <DrawingDemo
    hint="Drag to draw stars"
    :settings="{ tools: { initial: 'shape', shape: { shape: 'star', color: 'gold', borderColor: '#92400e', thickness: 2 } } }"
  />
</ClientOnly>

### Eraser

| Option | Type |
| --- | --- |
| `thickness` | eraser size |
| `mode` | `'full-stroke'` (default) or `'partial-stroke'` |

A stylus with an eraser end (Surface Pen, Wacom) erases automatically.

### Text

| Option | Type |
| --- | --- |
| `color` | text color |
| `fontSize` | `number` |
| `fontFamily` | CSS font family |

### Select

| Option | Type |
| --- | --- |
| `mode` | `'rectangle'` (default) or `'lasso'` (draw a loop around what to select) |

```ts
editor.tools.configure('select', { mode: 'lasso' });
```

### Laser pointer

| Option | Type |
| --- | --- |
| `color` | trail color (default red) |
| `thickness` | trail width in screen pixels (default `6`) |

The laser pointer also works when the editor is read-only (`editor.setReadOnly(true)`), which makes it
handy for presenting a drawing.

<ClientOnly>
  <DrawingDemo hint="Laser pointer: draw, and watch the trail fade" :settings="{ tools: { initial: 'laser' } }" />
</ClientOnly>

## Keyboard shortcuts

When the drawing area has focus:

| Key | Tool | | Key | Action |
| --- | --- | --- | --- | --- |
| `V` | Select | | `1`–`9` | Tools in order |
| `P` | Pen | | `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` | Undo / redo |
| `M` | Highlighter | | `Ctrl/⌘+A` | Select all |
| `E` | Eraser | | `−` / `=` | Thinner / thicker |
| `T` | Text | | Arrows | Pan |
| `S` | Shapes | | `Ctrl/⌘` + wheel | Zoom |
| `K` | Laser pointer | | | |
| `I` | Eyedropper | | | |

Change them with `keyboardShortcutOverrides` (IDs: `easydraw.tools.use.pen`, `easydraw.tools.use.eraser`, …):

```ts
import { Editor, KeyBinding } from 'easydrawer';

new Editor(element, {
  keyboardShortcutOverrides: {
    'easydraw.tools.use.pen': [KeyBinding.fromString('KeyB')],
  },
});
```

## Advanced: tool objects

`editor.tools.pen`, `.highlighter`, `.eraser`, `.shape`, `.text` and `.select` return the underlying tool objects
for anything the options don't cover:

```ts
editor.tools.pen.getThickness();
editor.tools.select.getSelectedObjects();
```
