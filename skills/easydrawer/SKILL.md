---
name: easydrawer
description: Build drawing, sketching, whiteboard, annotation or signature features with the `easydrawer` library (TypeScript, any framework). Use when code imports `easydrawer`, when the user asks to add a canvas to draw on, a pen/highlighter/eraser/shapes toolbar, Apple Pencil or stylus support, palm rejection, or saving drawings as SVG/PNG.
---

# EasyDrawer

`easydrawer` is a framework-agnostic drawing editor: natural pressure-sensitive ink, highlighter,
eraser, 12 shapes, text, sticky notes, connectors (arrows attached to shapes), selection with
lock/layering, images, grid/dot backgrounds, undo/redo, SVG/PNG export.
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
// Tools: 'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'laser' | 'eyedropper' | 'sticky' | 'connector'
// Keyboard: V P M E T S K I N C switch tools (when the canvas has focus)
editor.tools.use('eraser');              // activate; use(null) = pan/zoom only
editor.tools.active;                     // current ToolName | null
editor.tools.configure('pen', { color: 'red', thickness: 4, style: 'natural' });
editor.tools.configure('shape', { shape: 'star', color: 'gold', borderColor: '#000', thickness: 2 });
editor.tools.configure('eraser', { thickness: 20, mode: 'partial-stroke' });
editor.tools.configure('text', { fontSize: 24, fontFamily: 'serif', color: '#333' });
editor.tools.configure('select', { mode: 'lasso' });   // or 'rectangle'
editor.tools.configure('laser', { color: 'red' });      // fading trail, never saved
editor.tools.configure('sticky', { color: '#fde68a' }); // click to add a note, click a note to edit
editor.tools.configure('connector', { arrow: 'end', routing: 'elbow' }); // drag shape → shape; follows them; elbow = around other shapes
const off = editor.tools.onChange((name) => {/* sync toolbar UI */});

// Selection (what the 'select' tool has selected); all changes are undoable
editor.selection.items;                               // AbstractComponent[]
editor.selection.onChange(() => {                     // selection/edits/zoom/scroll changed
  const rect = editor.selection.getScreenRect();      // Rect2 in px relative to the container, or null
});
editor.selection.setColor('#dc2626');
editor.selection.bringToFront(); editor.selection.sendToBack();
editor.selection.duplicate(); editor.selection.delete();
editor.selection.lock(); editor.selection.unlockAll(); // locked = can't be selected/moved/erased
editor.selection.group(); editor.selection.ungroup();  // Ctrl/⌘+G, Ctrl/⌘+Shift+G
editor.selection.align('left');                        // 'center' | 'right' | 'top' | 'middle' | 'bottom'
editor.selection.distribute('horizontal');             // or 'vertical'
// Double-click a note/text with the select tool to edit it. Dragged selections snap to nearby objects.

// AI (needs settings.ai.request: a function calling YOUR server, never an API key in the browser)
await editor.ai.generateDiagram('Login flow: …');      // shapes + text + attached arrows, one undo step
await editor.ai.drawDiagram({ direction: 'down', nodes: [{ id, label, kind: 'process' }], edges: [{ from, to, label }] });
await editor.ai.editDiagram('add a step …');          // change the selected diagram, AI-made or hand-drawn (readDiagram())
await editor.ai.editSelection('…');                    // edits a selected diagram, else runs a command
await editor.ai.brainstorm();                          // ideas as notes around the selected note
await editor.ai.organizeNotes();                       // sticky notes → themed colored columns
await editor.ai.runCommand('color the notes about X in blue'); // → { message, actions }
editor.ai.describeScene(); await editor.ai.requestJSON(messages); // build custom AI features
// Server helper: openAICompatibleRequest({ url, model, apiKey }) for OpenAI/OpenRouter/Groq/Ollama…

// History & document
editor.undo(); editor.redo();
editor.canUndo(); editor.canRedo();
editor.clear();                                       // undoable, keeps background
editor.setBackground({ type: 'dot', color: '#fffbea' });
const offChange = editor.onChange(() => {/* custom saving */});
const stopAutosave = await editor.autosave({ key: 'my-drawing' }); // localStorage, restores on start

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
- ❌ Hand-written localStorage save/restore. ✅ `await editor.autosave({ key })`.
- ❌ A custom color-picking overlay. ✅ `editor.tools.use('eyedropper')` (applies to the previous tool).
- ❌ `Color4.fromHex(...)` just to set a color. ✅ pass the string.
- ❌ Reaching into `editor.tools.select.getSelection()` (internal `Selection`) for a selection toolbar. ✅ `editor.selection.*`.
- ❌ Drawing arrows with the shape tool and moving them by hand when shapes move. ✅ the `'connector'` tool.

## Pen styles

`style`: `'natural'` (default pen: width from stylus pressure, or from speed for mouse/finger),
`'pencil'`, `'calligraphy'` (flat nib),
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
