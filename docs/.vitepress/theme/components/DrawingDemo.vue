<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { Editor, EditorSettings } from 'easydrawer';

const props = withDefaults(defineProps<{
  /** Editor settings, as passed to `new Editor(element, settings)`. */
  settings?: Partial<EditorSettings>;
  height?: number;
  hint?: string;
}>(), {
  settings: () => ({}),
  height: 360,
  hint: 'Draw here with a mouse, finger or stylus',
});

const container = ref<HTMLDivElement>();
let editor: Editor | null = null;

onMounted(async () => {
  // easydrawer needs the DOM: load it only in the browser.
  const { Editor } = await import('easydrawer');
  editor = new Editor(container.value!, props.settings);
});

onBeforeUnmount(() => editor?.remove());
</script>

<template>
  <div class="drawing-demo" :style="{ height: `${height}px` }">
    <div ref="container" style="height: 100%" />
    <span class="demo-hint">{{ hint }}</span>
  </div>
</template>
