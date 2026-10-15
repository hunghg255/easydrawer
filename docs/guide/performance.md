# Performance

EasyDrawer is built to stay smooth on big boards (hundreds of shapes, connectors and freehand strokes) and on
tablets. Most of this is automatic; this page explains what happens, and what to keep in mind in your own code.

## What the editor does for you

- **Moving, resizing and rotating a selection**: while you drag, the selection is drawn as one picture (a bitmap
  snapshot) that moves with the pointer, instead of drawing every item again on each move. Connectors linked to
  the selection follow it live (at most every 50 ms); connectors whose two ends are both selected just move with
  it. The real change is made once, when you release.
- **Connectors**: elbow routes (around other shapes) are cached and only computed again when something around them
  changed. After a drop, routes that still touch their shapes are updated when the browser is idle.
- **Hand-drawn shapes** ([sketch style](./tools#hand-drawn-style)): moving one just moves its lines; it is drawn
  again (with the same randomness) only when it's resized or rotated, so that the lines don't stretch.
- **Big changes** (moving, aligning or undoing hundreds of items) are applied at once; a progress message and
  intermediate redraws only appear when a change takes more than about 100 ms.
- **Keyboard moves** (arrow keys on a selection) are previewed while the key is held, and applied once, when
  it's released.
- **Rendering**: parts of the drawing that didn't change are kept in a cache, and only what is visible is drawn.
- **Autosave** (`editor.autosave()`) waits until changes stop for `delay` ms (1000 by default) and the browser
  is idle, so that saving a big drawing never interrupts drawing.
- **AI**: with a [streamed answer](./ai#streaming), diagrams are drawn step by step while the answer arrives
  instead of all at the end.

## In your code

**Keep `onChange` and selection listeners light.** They can run on every change. Do cheap work right away and
defer expensive work (exporting, counting things in the whole drawing, reading a diagram) until the browser is
idle:

```ts
let scheduled = false;
editor.onChange(() => {
  if (scheduled) return;
  scheduled = true;
  requestIdleCallback(() => {
    scheduled = false;
    updateMinimap(editor.toSVGString()); // e.g. something slow
  }, { timeout: 500 });
});
```

**Don't export on every change.** `toSVGString()` and `toDataURL()` go through the whole drawing. Use
`editor.autosave()`, or save on an idle callback as above.

**Batch your own changes.** Dispatch one command for many items instead of one per item: it's one redraw and one
undo step.

```ts
import { uniteCommands, EditorImage } from 'easydrawer';

await editor.dispatch(uniteCommands(components.map((c) => EditorImage.addComponent(c))));
```

**Prefer straight connectors for very dense diagrams.** Elbow routes go around other shapes, which costs more to
compute when many connectors cross a crowded area.

**Large images**: scale photos down before adding them (e.g. to the size they are shown at). Big bitmaps take
memory and time to draw at every zoom level.

## Measuring

To find what is slow in your app, record a performance profile in your browser's developer tools while doing the
slow action. On a fast computer, enable CPU throttling (4× or 6× slowdown) to see what tablets and phones feel.
