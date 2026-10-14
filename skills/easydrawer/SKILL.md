---
name: easydrawer
description: Build drawing, sketching, whiteboard, annotation or signature features with the `easydrawer` library (TypeScript, any framework). Use when code imports `easydrawer`, when the user asks to add a canvas to draw on, a pen/highlighter/eraser/shapes toolbar, Apple Pencil or stylus support, palm rejection, or saving drawings as SVG/PNG.
---

# EasyDrawer

`easydrawer` is a framework-agnostic drawing editor: natural pressure-sensitive ink, highlighter,
eraser, 12 shapes, text, selection, images, grid/dot backgrounds, undo/redo, SVG/PNG export.
It has **no visible built-in toolbar**: you build your own UI and drive the editor through its API.

## Setup

```bash
npm i easydrawer
```

```ts
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';           // required

const editor = new Editor(container, {    // container must have a height
  tools: {
    initial: 'pen',
    pen: { color: '#1f2937', thickness: 3 },
    highlighter: { color: 'rgba(250, 204, 21, 0.45)', thickness: 24 },
  },
  input: { stylusOnly: 'auto' },          // palm rejection
  background: { type: 'grid' },            // 'none' | 'solid' | 'grid' | 'dot'
});
```

Rules:
- The editor fills its parent: give the parent an explicit height.
- It needs the DOM. With SSR (Next.js, Nuxt, SvelteKit) create it on the client only.
- Call `editor.remove()` on unmount. In Vue store it in `shallowRef`, never `ref`/`reactive`.
- Create exactly one editor per container (beware React StrictMode double effects: always clean up).

## Core API (prefer this over low-level APIs)

```ts
// Tools: 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'laser'
editor.tools.use('eraser');              // activate; use(null) = pan/zoom only
editor.tools.active;                     // current ToolName | null
editor.tools.configure('pen', { color: 'red', thickness: 4, style: 'natural' });
editor.tools.configure('shape', { shape: 'star', color: 'gold', borderColor: '#000', thickness: 2 });
editor.tools.configure('eraser', { thickness: 20, mode: 'partial-stroke' });
editor.tools.configure('text', { fontSize: 24, fontFamily: 'serif', color: '#333' });
editor.tools.configure('select', { mode: 'lasso' });   // or 'rectangle'
editor.tools.configure('laser', { color: 'red' });      // fading trail, never saved
const off = editor.tools.onChange((name) => {/* sync toolbar UI */});

// History & document
editor.undo(); editor.redo();
editor.canUndo(); editor.canRedo();
editor.clear();                                       // undoable, keeps background
editor.setBackground({ type: 'dot', color: '#fffbea' });
const offChange = editor.onChange(() => {/* autosave */});

// Zoom
editor.zoomIn(); editor.zoomOut(); editor.setZoom(1); editor.zoomToFit();
const offZoom = editor.onZoomChange((zoom) => {/* update a "125%" label */});

// Import / export
const svg = editor.toSVGString();
const png = editor.toDataURL('image/png');
await editor.loadFromSVG(svg);
await editor.uploadImages([...fileInput.files]);
```

Colors accept any CSS color string or a `Color4`. `configure` only changes the options given.

## Avoid (legacy patterns)

- ❌ `editor.toolController.getPrimaryTools()[2]` — index-based, fragile. ✅ `editor.tools.pen` / `editor.tools.configure('pen', …)`.
- ❌ Creating a hidden toolbar (`makeDropdownToolbar`) just to call widget methods for backgrounds. ✅ `editor.setBackground(...)`.
- ❌ `editor.history.clearAllDraft()` to clear. ✅ `editor.clear()`.
- ❌ `Color4.fromHex(...)` just to set a color. ✅ pass the string.

## Pen styles

`style`: `'natural'` (default pen: width from stylus pressure, or from speed for mouse/finger),
`'marker'` (default highlighter, constant width), `'flat-tip'`, `'round-tip'`, `'polyline'`,
or a custom factory. The pen snaps a stroke to a line/circle/rectangle when held still for ½ s at
the end (`autocorrect`, on by default for the pen):

```ts
import { naturalPenBuilderFactory } from 'easydrawer';
editor.tools.configure('pen', {
  style: naturalPenBuilderFactory({ thinning: 0.8, smoothing: 0.6, taperStart: 2, taperEnd: 4 }),
});
```

## Tablets / Apple Pencil

- `input.stylusOnly`: `'auto'` (default; after a stylus is used, fingers only pan/zoom), `true`, `false`.
  Runtime: `editor.toolController.setStylusOnly(value)`.
- For full-screen apps add `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`
  and `html, body { overflow: hidden; overscroll-behavior: none }`.
- Toolbar buttons ≥ 44×44 px under `@media (pointer: coarse)`, with `touch-action: manipulation`.

## More

- Full option tables and less common APIs: [references/api.md](references/api.md)
- Ready-made React / Vue / vanilla components and recipes (autosave, signature pad, toolbar): [references/recipes.md](references/recipes.md)
