# Tools

The editor has ten built-in tools, addressed by name:

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
| `'sticky'` | Sticky notes: click to add a note and type, click a note to edit it |
| `'connector'` | Arrows/lines between shapes: drag from one shape to another; the arrow follows them when they move |

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
| `sketch` | hand-drawn style: `true`, or `{ roughness, fillStyle }` (see [below](#hand-drawn-style)) |

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

### Hand-drawn style

Like [Excalidraw](https://excalidraw.com): shapes and arrows with wobbly double lines, and fills made of diagonal
lines (drawn with [Rough.js](https://roughjs.com)).

```ts
editor.tools.configure('shape', { sketch: true });                              // or { roughness: 2, fillStyle: 'cross-hatch' }
editor.tools.configure('connector', { sketch: true });
editor.ai.setSketch(true);                                                       // AI diagrams, mind maps, Mermaid
editor.tools.configure('text', { fontFamily: '"Patrick Hand", sans-serif' });    // a handwriting font (load it first)
editor.ai.fontFamily = '"Patrick Hand", sans-serif';
```

| Option | Values |
| --- | --- |
| `roughness` | `0` (straight) to `3` (very sloppy). Default `1.3` |
| `bowing` | how much lines bend. Default `1.5` |
| `fillStyle` | `'hachure'` (default), `'cross-hatch'`, `'solid'`, `'zigzag'`, `'dots'` |

The hand-drawn lines are saved with the drawing (SVG). `sketchPath(path, style, options)` turns any path into
its hand-drawn version. In the [playground](/playground): ⋯ → **Hand-drawn**.

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
| `fontSize` | `number` (default `20`) |
| `fontFamily` | CSS font family |

### Select

| Option | Type |
| --- | --- |
| `mode` | `'rectangle'` (default) or `'lasso'` (draw a loop around what to select) |

```ts
editor.tools.configure('select', { mode: 'lasso' });
```

**Double-click** (or double-tap) to edit text:

| On | Does |
| --- | --- |
| A sticky note or a text | Edits its text |
| An arrow (connector) | Adds or edits its label |
| A shape (rectangle, ellipse, hand-drawn box…) | Edits its text, or types a new one centered in it and grouped with it |
| A frame's title | Renames the frame |

From code, `editor.selection.editText()` does the same for the selected item (the playground's **T** button in
the floating toolbar). <kbd>Enter</kbd> with a shape selected does it too.

Text typed in a shape is centered in it, wraps to its width, and is sized to fit it (at most the text tool's size).
<kbd>Enter</kbd> saves the text, <kbd>Shift</kbd>+<kbd>Enter</kbd> starts a new line, <kbd>Esc</kbd> cancels.

#### Flowcharts from the keyboard

With a shape selected:

| Keys | Does |
| --- | --- |
| <kbd>Ctrl/⌘</kbd> + arrow | Adds a copy of the shape in that direction, linked by an arrow, and selects it. Again: the next one is placed beside it |
| <kbd>Enter</kbd> | Types the text of the shape; <kbd>Enter</kbd> again saves it and selects the shape again |
| <kbd>Alt</kbd> + arrow | Selects the linked shape in that direction |

So <kbd>Enter</kbd> "Start" <kbd>Enter</kbd> <kbd>Ctrl</kbd>+<kbd>→</kbd> <kbd>Enter</kbd> "Check" <kbd>Enter</kbd>
<kbd>Ctrl</kbd>+<kbd>↓</kbd>… draws a flowchart without the mouse. From code:
`editor.selection.addConnected('right')` and `editor.selection.selectConnected('left')`.

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

### Sticky note

| Option | Type |
| --- | --- |
| `color` | color of new notes (default yellow) |

Click an empty spot to add a note and type its text (`Esc` or `Ctrl/⌘+Enter` to finish). Click an existing note
to edit it — or double-click it with the select tool (this also works for text). Notes grow to fit their text, and can be moved, resized, recolored and connected like shapes.
To edit a note from your own UI: `editor.tools.sticky.edit(note)`.

### Connector

| Option | Type |
| --- | --- |
| `color` | line color |
| `thickness` | line width in pixels (default `2`) |
| `arrow` | `'end'` (default), `'both'` or `'none'` |
| `routing` | `'straight'` (default) or `'elbow'`: right-angle lines with rounded corners that go **around** other shapes |

Drag from one shape (or note, text, image…) to another. Each end dropped on something stays attached to it: move
the shape and the arrow follows, also after undo/redo and after saving and loading the SVG. Ends dropped on empty
space stay where they are. While you drag a shape, its arrows follow it live.

With `routing: 'elbow'`, the line picks the best side of each shape and finds its way around the shapes in
between — also when a shape is moved into its way later. The side can be fixed per end with
`new Connector({ point, targetId, side: 'bottom' }, …)`.

```ts
editor.tools.configure('connector', { color: '#7c3aed', arrow: 'both', routing: 'elbow' });
editor.tools.use('connector');
```

Double-click an arrow with the select tool to type its label (<kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels).
From code:

```ts
await editor.dispatch(connector.setLabel('yes')); // undoable; '' removes the label
connector.getLabel();
editor.tools.connector.editLabel(connector);    // shows the text box
```

### Hand-drawn or AI-made: the same diagram

Diagrams made by the [AI features](./ai), from [Mermaid](./ai#mermaid-no-ai-needed), or by hand are made of the
same things: shapes, texts grouped with them, and connectors. So you can mix them: draw a box, double-click it to
type its text, connect it to an AI-made box with the connector tool and label the arrow. The AI can then edit the
whole diagram (`editor.ai.editDiagram`), and `editor.ai.toMermaid()` exports it.

<ClientOnly>
  <DrawingDemo
    hint="Draw two shapes, then switch to the connector (C) and drag from one to the other"
    :settings="{ tools: { initial: 'shape', shape: { shape: 'rectangle', color: '#bfdbfe', borderColor: '#1d4ed8', thickness: 2 } } }"
  />
</ClientOnly>

## Working with the selection

What is selected with the select tool can be changed from code with
[`editor.selection`](../api/editor#selection) — handy for a floating toolbar next to the selection, like the
[playground](/playground)'s:

```ts
editor.selection.onChange(() => {
  const rect = editor.selection.getScreenRect(); // null when nothing is selected
  myToolbar.hidden = !rect;
  if (rect) myToolbar.style.transform = `translate(${rect.center.x}px, ${rect.bottomRight.y + 12}px)`;
});

editor.selection.setColor('#dc2626');
editor.selection.bringToFront(); // or sendToBack()
editor.selection.duplicate();
editor.selection.delete();
```

### Groups, alignment and snapping

```ts
editor.selection.group();    // Ctrl/⌘+G — grouped items are selected and moved together
editor.selection.ungroup();  // Ctrl/⌘+Shift+G

editor.selection.align('left');            // 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
editor.selection.distribute('horizontal'); // equal gaps ('horizontal' | 'vertical'), 3+ items
```

Groups move as one when aligning and distributing, and are saved in the SVG. A copy of a group is a new group.

When dragging a selection, it snaps to the edges and centers of nearby objects, with pink guide lines.

### Locking

Locked objects can't be selected, moved or erased — useful for a background image or a template:

```ts
editor.selection.lock();      // lock what is selected
editor.selection.lockedCount; // how many objects are locked
editor.selection.unlockAll();
```

The lock is saved in the SVG (`data-easydrawer-locked`), and locking/unlocking can be undone.

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
| `N` | Sticky note | | | |
| `C` | Connector | | `Ctrl/⌘+G` | Group (`+Shift`: ungroup) |
| | | | `Enter` | Edit the text of the selection |
| | | | `Ctrl/⌘` + arrow | Add a linked shape (flowcharts) |
| | | | `Alt` + arrow | Select the linked shape |
| | | | Arrows (with a selection) | Move the selection (hold to keep moving) |
| | | | `Ctrl/⌘+D` | Duplicate the selection |
| | | | `Delete` / `Backspace` | Delete the selection |

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

`editor.tools.pen`, `.highlighter`, `.eraser`, `.shape`, `.text`, `.select`, `.sticky` and `.connector` return the underlying tool objects
for anything the options don't cover:

```ts
editor.tools.pen.getThickness();
editor.tools.select.getSelectedObjects();
```
