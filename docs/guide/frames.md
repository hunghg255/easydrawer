# Frames & presenting

A **frame** is a named area of the board: a rectangle with a title above it. Use frames to

- present a board one part at a time, like slides;
- export parts of a board as images or as a PDF with one page per frame;
- organize a large board into sections.

Frames are saved with the drawing (in the SVG), and can be undone like everything else.

## Add frames

```ts
// Around most of the visible area
await editor.frames.add({ title: 'Intro' });

// Around a rectangle, in canvas coordinates
import { Rect2 } from 'easydrawer';
await editor.frames.add({ rect: new Rect2(0, 0, 1600, 900), title: 'Plan' });

// Around the selected items (with 32px of space around them)
await editor.frames.addAroundSelection({ title: 'Architecture', padding: 32 });
```

A frame is a border and a title, grouped. Select it by clicking its border or its title (and drag it to move it);
clicking inside a frame selects what is in it. To rename a frame, double-click its title.

## List and go to frames

```ts
const frames = editor.frames.list();
// → [{ id, title, rect, parts }], in the order they were added

await editor.frames.goTo(frames[1]);          // or goTo(1): fit the frame to the screen
await editor.frames.goTo(0, { padding: 24 }); // with space around it

editor.frames.contentsOf(frames[0]);          // the components inside the frame
```

`goTo` only moves the view: it is not part of the undo history.

## Present

A minimal presentation mode: full screen, with the arrow keys to go from frame to frame.

```ts
let current = 0;

async function present() {
  await editor.getRootElement().requestFullscreen?.();
  await editor.frames.goTo(current);
}

window.addEventListener('keydown', (event) => {
  if (!document.fullscreenElement) return;
  const count = editor.frames.list().length;
  if (event.key === 'ArrowRight' || event.key === ' ') current = Math.min(current + 1, count - 1);
  else if (event.key === 'ArrowLeft') current = Math.max(current - 1, 0);
  else return;
  event.preventDefault();
  void editor.frames.goTo(current);
});

// Keep the frame fitted when the screen size changes (e.g. entering full screen)
window.addEventListener('resize', () => {
  if (document.fullscreenElement) void editor.frames.goTo(current);
});
```

The [playground](/playground) does this (⋯ → **Present**): a click, the arrows or space go to the next frame,
<kbd>Esc</kbd> stops. It also hides the toolbars and blocks drawing while presenting.

## Export

```ts
// One frame as a PNG (or 'image/jpeg', 'image/webp')
const png = editor.frames.toDataURL(0, { pixelRatio: 2, background: '#ffffff' });

// Every frame as a page of a PDF, with the browser's print dialog
const pages = editor.frames.list().map((_, i) => editor.frames.toDataURL(i));
const win = window.open('', '_blank')!;
win.document.write(`<style>@page { margin: 0 } body { margin: 0 }
  img { width: 100vw; height: 100vh; object-fit: contain; break-after: page }</style>
  ${pages.map((src) => `<img src="${src}">`).join('')}`);
win.document.close();
win.addEventListener('load', () => win.print());
```

`pixelRatio` is the number of image pixels per screen pixel at the current zoom (default: `2`, sharp on
high-density screens). Images are at most 8000 pixels wide or high.
