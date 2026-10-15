# EasyDrawer

A drawing/whiteboard library for the web: natural-looking ink, shapes, text, images, sticky notes, arrows that
stay attached, frames for presenting, and SVG/PNG export. AI features draw diagrams, mind maps, charts and pictures
from text, and turn SQL or code into diagrams; Mermaid diagrams can be imported and exported without AI.
Works with mouse, touch and styluses (Apple Pencil, Wacom, Surface Pen), with palm rejection on tablets.

- [Documentation & playground](https://easydrawer.vercel.app/) — source in [`docs/`](./docs) (`pnpm dev`); the playground is at [`/playground`](https://easydrawer.vercel.app/playground)
- [AI skill](./skills/easydrawer) — teaches AI coding assistants (Claude Code…) to use EasyDrawer: `cp -r node_modules/easydrawer/skills/easydrawer .claude/skills/`
- [Deep wiki](https://deepwiki.com/hunghg255/easydrawer)

## Install

```bash
npm i easydrawer
```

## Quick start

```ts
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';

const editor = new Editor(document.getElementById('drawing')!, {
  tools: {
    initial: 'pen',
    pen: { color: '#1f2937', thickness: 3 },
    highlighter: { color: 'rgba(250, 204, 21, 0.45)', thickness: 24 },
    shape: { shape: 'rectangle', color: 'transparent', borderColor: 'black', thickness: 2 },
  },
  input: { stylusOnly: 'auto' }, // palm rejection (see below)
  background: { type: 'grid', color: '#fffbea' },
});
```

### Tools

Tools are addressed by name: `'select' | 'text' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'laser' | 'eyedropper' | 'sticky' | 'connector'`.
Keyboard: `V` select, `P` pen, `M` highlighter, `E` eraser, `T` text, `S` shapes, `K` laser, `I` eyedropper, `N` sticky note, `C` connector.

```ts
editor.tools.use('highlighter'); // switch tool
editor.tools.use(null);          // no drawing tool (pan/zoom only)
editor.tools.active;             // → 'highlighter'

// Change options — only the given ones change. Colors accept any CSS color string.
editor.tools.configure('pen', { color: 'red', thickness: 4, style: 'natural' });
editor.tools.configure('eraser', { thickness: 20, mode: 'partial-stroke' });
editor.tools.configure('shape', { shape: 'star', color: 'gold' });
editor.tools.configure('text', { fontSize: 24, fontFamily: 'serif' });
editor.tools.configure('select', { mode: 'lasso' });

// React to tool changes (e.g. to highlight your own toolbar buttons)
const unsubscribe = editor.tools.onChange((name) => console.log('active:', name));

// Direct access to the tool objects, for advanced use
editor.tools.pen.getColor();
```

| Tool | Options |
| --- | --- |
| `pen`, `highlighter` | `color`, `thickness`, `style` (`'natural'` · `'pencil'` · `'calligraphy'` · `'marker'` · `'flat-tip'` · `'round-tip'` · `'polyline'` or a custom factory), `pressureSensitive`, `stabilization`, `autocorrect` |
| `shape` | `shape` (`square` · `rectangle` · `circle` · `triangle` · `hexagon` · `diamond` · `arrow` · `line` · `heart` · `star` · `cloud` · `parallelogram`), `color` (fill), `borderColor`, `thickness` (border width) |
| `eraser` | `thickness`, `mode` (`'full-stroke'` · `'partial-stroke'`) |
| `text` | `color`, `fontSize`, `fontFamily` |
| `select` | `mode` (`'rectangle'` · `'lasso'`) |
| `laser` | `color`, `thickness` — a fading trail for presenting, never saved |
| `sticky` | `color` — click to add a note and type, click a note to edit it |
| `connector` | `color`, `thickness`, `arrow` (`'end'` · `'both'` · `'none'`), `routing` (`'straight'` · `'elbow'`: right angles around other shapes) — drag from one shape to another; the arrow follows them when they move |

### Selection

```ts
editor.selection.items;                  // what the select tool has selected
editor.selection.onChange(() => {        // e.g. to place a floating toolbar
  const rect = editor.selection.getScreenRect();
});
editor.selection.setColor('#dc2626');
editor.selection.bringToFront();         // sendToBack()
editor.selection.duplicate();            // delete()
editor.selection.group();                // Ctrl/⌘+G; ungroup() is Ctrl/⌘+Shift+G
editor.selection.align('left');          // center, right, top, middle, bottom
editor.selection.distribute('horizontal');
editor.selection.lock();                 // locked objects can't be selected, moved or erased
editor.selection.unlockAll();

// Flowcharts from the keyboard: Ctrl/⌘+arrows add a linked shape, Enter types its text
await editor.selection.addConnected('right');

// Hand-drawn style (like Excalidraw)
editor.tools.configure('shape', { sketch: true });
editor.tools.configure('connector', { sketch: true });
editor.ai.setSketch(true);

// Frames: named areas to present as slides or export
await editor.frames.add({ title: 'Intro' });   // around the visible area; addAroundSelection()
await editor.frames.goTo(0);                   // fit a frame to the screen
editor.frames.toDataURL(0);                    // PNG of a frame
```

### Document

```ts
editor.undo();
editor.redo();
editor.canUndo(); editor.canRedo();
editor.clear(); // undoable

editor.setBackground({ type: 'dot' }); // 'none' | 'solid' | 'grid' | 'dot'
editor.setBackground({ color: '#f1f5f9' });

const svg = editor.toSVGString();
const png = editor.toDataURL('image/png');
await editor.loadFromSVG(svg);
await editor.uploadImages([...fileInput.files]);

const stop = editor.onChange(() => save(editor.toSVGString()));
const stopAutosave = await editor.autosave({ key: 'my-drawing' }); // localStorage

editor.zoomIn(); editor.zoomOut(); editor.setZoom(1); editor.zoomToFit();
editor.onZoomChange((zoom) => console.log(`${Math.round(zoom * 100)}%`));
```

## AI features

Give the editor a function that calls a language model (through your own server, which keeps the API key),
then generate diagrams from text or code, charts and pictures, and organize sticky notes. See the [AI guide](https://easydrawer.vercel.app/guide/ai).

```ts
const editor = new Editor(element, {
  ai: { request: ({ messages }) => fetch('/api/ai', { method: 'POST', body: JSON.stringify({ messages }) }).then((r) => r.json()).then((d) => d.content) },
});

await editor.ai.generateDiagram('Checkout: cart → payment → paid? yes: ship, no: retry');
await editor.ai.editDiagram('Add a confirmation email after the payment'); // the selected diagram, even hand-drawn
await editor.ai.editSelection('remove the error step'); // diagram edit, or a command for anything else
await editor.ai.generateMindMap('Launching a mobile app'); // then select a topic: expandMindMap()
await editor.ai.drawMermaid('flowchart TD\n  A --> B{OK?}'); // and editor.ai.toMermaid() — no AI needed
await editor.ai.diagramFromCode('CREATE TABLE users (…); CREATE TABLE orders (…);'); // ER diagram
await editor.ai.generateChart('Revenue per quarter, 2023 vs 2024'); // bar / line / pie chart
await editor.ai.generateIllustration('A lighthouse at sunset'); // picture made of editable shapes
await editor.ai.brainstorm();    // ideas around the selected sticky note
await editor.ai.organizeNotes(); // sort sticky notes into themed columns
await editor.ai.runCommand('Color the notes about marketing in blue'); // anything, in plain language
```

## Natural ink

The default pen (`style: 'natural'`) is designed to feel like real ink:

- **Every stylus sample is used.** Browsers merge high-frequency stylus input (240 Hz on iPad) into fewer
  `pointermove` events; EasyDrawer reads them back with `getCoalescedEvents()` and keeps sub-pixel precision.
- **Pressure.** Real stylus pressure controls the width. For mouse and fingers, pressure is simulated from
  speed: fast strokes are thinner, slow strokes thicker.
- **Smooth without lag.** Jitter is removed with a symmetric smoothing pass that keeps sharp corners sharp,
  and the tip of the stroke always follows the pointer.
- **One filled outline per stroke** with round caps and joins, so semi-transparent colors (highlighters) stay even.

Fine-tune it with `naturalPenBuilderFactory`:

```ts
import { naturalPenBuilderFactory } from 'easydrawer';

const brush = naturalPenBuilderFactory({
  thinning: 0.8,          // how much pressure changes the width (0–1)
  simulatedThinning: 0.4, // same, for mouse/finger (simulated pressure)
  smoothing: 0.5,         // 0 = raw input, 1 = very smooth
  taperStart: 2,          // tapered ends, as a multiple of the stroke width
  taperEnd: 4,
});
editor.tools.configure('pen', { style: brush });
```

## Tablets (iPad / Android)

- **Palm rejection**: `input.stylusOnly`
  - `'auto'` (default): as soon as a stylus is used, fingers stop drawing and only pan/zoom.
  - `true`: fingers never draw. `false`: fingers always draw.
  - Can be changed at runtime: `editor.toolController.setStylusOnly(true)`.
- Pinch to zoom and two-finger pan. Safari page zoom, text selection, long-press menus and scroll bounce are
  disabled on the canvas.
- For full-screen apps, also add to your page:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  ```
  and make your toolbar buttons at least 44×44 px on touch screens (`@media (pointer: coarse)`), as the
  [playground](./docs/.vitepress/theme/components/Playground.vue) does.

## Project structure

```
src/
├── index.ts                   # package entry
├── math/                      # vectors, matrices, paths, Bézier curves, colors
├── styles/styles.css          # all editor CSS (copied to dist/styles.css)
└── draw/
    ├── Editor.ts              # main class: settings, DOM, input events, high-level helpers
    ├── api/                   # simple public API: EditorTools (editor.tools) + option types
    ├── tools/                 # input → actions: Pen, Eraser, ShapeTool, TextTool, SelectionTool, PanZoom…
    │   └── ToolController.ts  # creates the built-in tools, routes input, palm rejection
    ├── components/            # things in the drawing: Stroke, TextComponent, ImageComponent, Background…
    │   └── builders/          # pointer input → components (NaturalPenBuilder, shapes…), presets.ts
    ├── rendering/             # Canvas/SVG renderers and render caching
    ├── image/                 # EditorImage (document tree) and SVG export
    ├── commands/              # undoable commands (Erase, Duplicate…)
    ├── toolbar/               # optional built-in toolbars/widgets
    ├── SVGLoader/             # SVG import
    └── localizations/         # translations
docs/                          # VitePress site: guide, API, playground and AI skills pages (deployed to Vercel)
skills/easydrawer/             # Agent Skill for AI coding assistants (shipped in the npm package)
```

## Development

```bash
pnpm install
pnpm dev       # docs site + playground (uses the library source directly)
pnpm test      # unit tests (vitest)
pnpm typecheck
pnpm lint
pnpm build
```
