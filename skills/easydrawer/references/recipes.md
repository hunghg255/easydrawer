# EasyDrawer recipes

## React component

```tsx
import { useEffect, useRef, useState } from 'react';
import { Editor, type ToolName } from 'easydrawer';
import 'easydrawer/styles.css';

const TOOLS: ToolName[] = ['pen', 'highlighter', 'eraser', 'shape', 'text', 'select'];

export function Whiteboard() {
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [active, setActive] = useState<ToolName | null>('pen');
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const instance = new Editor(container.current!, { tools: { initial: 'pen' } });
    const offTool = instance.tools.onChange(setActive);
    const offChange = instance.onChange(() => setCanUndo(instance.canUndo()));
    setEditor(instance);
    return () => { offTool(); offChange(); instance.remove(); };
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div>
        {TOOLS.map((name) => (
          <button key={name} aria-pressed={active === name} onClick={() => editor?.tools.use(name)}>
            {name}
          </button>
        ))}
        <button disabled={!canUndo} onClick={() => editor?.undo()}>Undo</button>
        <button onClick={() => editor?.redo()}>Redo</button>
        <button onClick={() => editor?.clear()}>Clear</button>
      </div>
      <div ref={container} style={{ flex: 1 }} />
    </div>
  );
}
```

Next.js: `const Whiteboard = dynamic(() => import('./Whiteboard').then(m => m.Whiteboard), { ssr: false });`

## Vue component

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Editor, type ToolName } from 'easydrawer';
import 'easydrawer/styles.css';

const container = ref<HTMLDivElement>();
const editor = shallowRef<Editor>();
const active = ref<ToolName | null>('pen');
let offTool = () => {};

onMounted(() => {
  editor.value = new Editor(container.value!);
  offTool = editor.value.tools.onChange((name) => (active.value = name));
});
onBeforeUnmount(() => { offTool(); editor.value?.remove(); });
</script>

<template>
  <button v-for="t in ['pen', 'eraser']" :key="t" :class="{ active: active === t }"
          @click="editor?.tools.use(t as ToolName)">{{ t }}</button>
  <div ref="container" style="height: 500px" />
</template>
```

Nuxt: wrap in `<ClientOnly>`.

## Vanilla

```html
<link rel="stylesheet" href="https://unpkg.com/easydrawer/dist/styles.css" />
<div id="board" style="height: 500px"></div>
<script src="https://unpkg.com/easydrawer/dist/easydrawer.js"></script>
<script>
  const editor = new EasyDrawer.Editor(document.getElementById('board'));
</script>
```

## Autosave to localStorage

```ts
const stopAutosave = await editor.autosave({ key: 'drawing' });
```

Custom storage (e.g. a server):

```ts
let timer: ReturnType<typeof setTimeout>;
editor.onChange(() => {
  clearTimeout(timer);
  timer = setTimeout(() => api.save(editor.toSVGString()), 1000);
});
```

## Signature pad

```ts
const editor = new Editor(el, {
  tools: { initial: 'pen', pen: { color: '#0b1d51', thickness: 2.5 } },
  disableZoom: true,
  input: { stylusOnly: false },          // fingers must be able to sign
  background: { type: 'solid', color: 'white' },
});

clearButton.onclick = () => editor.clear();
saveButton.onclick = () => upload(editor.toDataURL('image/png'));
const isEmpty = () => editor.image.getAllComponents().length === 0;
```

## Download helpers

```ts
function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}
const svgUrl = URL.createObjectURL(new Blob([editor.toSVGString()], { type: 'image/svg+xml' }));
download(svgUrl, 'drawing.svg');
URL.revokeObjectURL(svgUrl);
download(editor.toDataURL('image/png'), 'drawing.png');
```

## Color picker for the active pen

```ts
colorInput.addEventListener('input', () => {
  const tool = editor.tools.active;
  if (tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'text') {
    editor.tools.configure(tool, { color: colorInput.value });
  }
});
```

## Floating toolbar next to the selection

```ts
const bar = document.querySelector<HTMLElement>('#selection-bar')!; // position: absolute, inside the editor's parent
editor.selection.onChange(() => {
  const rect = editor.selection.getScreenRect();
  bar.hidden = !rect;
  if (!rect) return;
  bar.style.left = `${rect.center.x - bar.offsetWidth / 2}px`;
  bar.style.top = `${rect.bottomRight.y + 12}px`;
});
bar.querySelector('.front')!.addEventListener('click', () => editor.selection.bringToFront());
bar.querySelector('.lock')!.addEventListener('click', () => editor.selection.lock());
bar.querySelector('.delete')!.addEventListener('click', () => editor.selection.delete());
```

## Add a sticky note from code

```ts
import { EditorImage, StickyNote } from 'easydrawer';

const center = editor.viewport.visibleRect.center;
await editor.dispatch(EditorImage.addComponent(StickyNote.centeredAt(center, { text: 'Hello!' })));
```

## Read-only viewer

```ts
const viewer = new Editor(el, { tools: { initial: null } });
await viewer.loadFromSVG(svg);
viewer.setReadOnly(true);
```
