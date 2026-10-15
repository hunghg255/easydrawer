# Getting started

## Install

::: code-group
```bash [pnpm]
pnpm add easydrawer
```
```bash [npm]
npm i easydrawer
```
```bash [yarn]
yarn add easydrawer
```
:::

## Create an editor

The editor fills its parent element, so give the parent a size.

```html
<div id="drawing" style="width: 100%; height: 500px"></div>
```

```ts
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';

const editor = new Editor(document.getElementById('drawing')!, {
  tools: {
    initial: 'pen',
    pen: { color: '#1f2937', thickness: 3 },
  },
  background: { type: 'grid' },
});
```

<ClientOnly>
  <DrawingDemo :settings="{ tools: { pen: { color: '#1f2937', thickness: 3 } }, background: { type: 'grid' } }" />
</ClientOnly>

EasyDrawer has no built-in visible toolbar: you build your own UI and call the editor API from it.
The [playground](/playground) is a complete example.

## Without a bundler

```html
<link rel="stylesheet" href="https://unpkg.com/easydrawer/dist/styles.css" />
<script src="https://unpkg.com/easydrawer/dist/easydrawer.js"></script>
<script>
  const editor = new EasyDrawer.Editor(document.getElementById('drawing'));
</script>
```

## A minimal toolbar

```ts
const buttons = {
  pen: document.querySelector('#pen'),
  eraser: document.querySelector('#eraser'),
};

for (const [name, button] of Object.entries(buttons)) {
  button.addEventListener('click', () => editor.tools.use(name));
}

// Keep the buttons in sync, also when the tool changes from a keyboard shortcut
editor.tools.onChange((active) => {
  for (const [name, button] of Object.entries(buttons)) {
    button.classList.toggle('active', name === active);
  }
});

document.querySelector('#undo').addEventListener('click', () => editor.undo());
```

## Next steps

- [Tools](./tools) — pen, highlighter, shapes, text, eraser, selection
- [Natural ink](./natural-ink) — tune how strokes look
- [Tablets & stylus](./tablets) — Apple Pencil and palm rejection
- [Saving & loading](./saving)
- [AI features](./ai) — diagrams, mind maps, charts and pictures from text; Mermaid import/export
- [Frames & presenting](./frames) — slides, presentations and PDF export
