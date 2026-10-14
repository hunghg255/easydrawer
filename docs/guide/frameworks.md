# Frameworks

EasyDrawer is framework-agnostic: create the editor when the element is mounted and remove it when it is unmounted.
It needs the DOM, so with server-side rendering (Next.js, Nuxt…) create it on the client only.

## React

```tsx
import { useEffect, useRef, useState } from 'react';
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';

export function Drawing() {
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    const instance = new Editor(container.current!, {
      tools: { pen: { color: '#1f2937', thickness: 3 } },
    });
    setEditor(instance);
    return () => instance.remove();
  }, []);

  return (
    <>
      <button onClick={() => editor?.tools.use('pen')}>Pen</button>
      <button onClick={() => editor?.tools.use('eraser')}>Eraser</button>
      <button onClick={() => editor?.undo()}>Undo</button>
      <div ref={container} style={{ height: 500 }} />
    </>
  );
}
```

With Next.js, load the component with `dynamic(() => import('./Drawing'), { ssr: false })`.

## Vue

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';

const container = ref<HTMLDivElement>();
const editor = shallowRef<Editor>();

onMounted(() => {
  editor.value = new Editor(container.value!);
});
onBeforeUnmount(() => editor.value?.remove());
</script>

<template>
  <button @click="editor?.tools.use('pen')">Pen</button>
  <button @click="editor?.tools.use('eraser')">Eraser</button>
  <div ref="container" style="height: 500px" />
</template>
```

Use `shallowRef`, not `ref`: the editor is a large object that shouldn't be made reactive.
With Nuxt, wrap the component in `<ClientOnly>`.
