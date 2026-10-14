# Tools

The editor has six built-in tools, addressed by name:

| Name | What it does |
| --- | --- |
| `'pen'` | Freehand ink (natural ink by default) |
| `'highlighter'` | Semi-transparent marker |
| `'eraser'` | Erases whole strokes or parts of strokes |
| `'shape'` | Draws shapes (rectangle, circle, star, arrow…) |
| `'text'` | Adds and edits text |
| `'select'` | Selects, moves, resizes, rotates, duplicates and deletes |

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
| `style` | `'natural' \| 'marker' \| 'flat-tip' \| 'round-tip' \| 'polyline'` or a [custom factory](./natural-ink#custom-brushes) | `'natural'` / `'marker'` |
| `pressureSensitive` | `boolean` | `true` |
| `stabilization` | `boolean` — extra inertia-based smoothing | `false` |
| `autocorrect` | `boolean` — hold the pen still at the end of a stroke to turn it into a line/rectangle | `false` |

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

## Advanced: tool objects

`editor.tools.pen`, `.highlighter`, `.eraser`, `.shape`, `.text` and `.select` return the underlying tool objects
for anything the options don't cover:

```ts
editor.tools.pen.getThickness();
editor.tools.select.getSelectedObjects();
```
