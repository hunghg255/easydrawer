<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import type {
  BackgroundTypeName,
  Editor,
  PenStyleName,
  ShapeTypeName,
  ToolName,
} from 'easydrawer';

// Icon paths from Lucide (ISC license), 24×24 viewBox, stroked.
const icons: Record<string, string> = {
  select: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z M13 13l6 6',
  text: 'M4 7V4h16v3 M9 20h6 M12 4v16',
  pen: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  highlighter: 'm9 11-6 6v3h9l3-3 M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  eraser: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21 M22 21H7 M5 11l9 9',
  shape: 'M3 3h18v18H3z',
  undo: 'M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  redo: 'M21 7v6h-6 M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7',
  clear: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  image: 'M3 3h18v18H3z M9 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M21 15l-5-5L5 21',
  open: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  save: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  dot: 'M6 6h.01 M12 6h.01 M18 6h.01 M6 12h.01 M12 12h.01 M18 12h.01 M6 18h.01 M12 18h.01 M18 18h.01',
  solid: 'M3 3h18v18H3z M3 21 21 3',
};

const tools: Array<{ name: ToolName; title: string }> = [
  { name: 'select', title: 'Select' },
  { name: 'text', title: 'Text' },
  { name: 'pen', title: 'Pen' },
  { name: 'highlighter', title: 'Highlighter' },
  { name: 'eraser', title: 'Eraser' },
  { name: 'shape', title: 'Shapes' },
];

const shapeNames: ShapeTypeName[] = [
  'square', 'rectangle', 'circle', 'triangle', 'hexagon', 'diamond',
  'arrow', 'line', 'heart', 'star', 'cloud', 'parallelogram',
];
const penStyles: Array<{ style: PenStyleName; label: string }> = [
  { style: 'natural', label: 'Ink' },
  { style: 'flat-tip', label: 'Flat' },
  { style: 'round-tip', label: 'Round' },
  { style: 'marker', label: 'Marker' },
];
const inkColors = ['#1f2937', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed'];
const highlightColors = [
  'rgba(250, 204, 21, 0.45)',
  'rgba(74, 222, 128, 0.4)',
  'rgba(96, 165, 250, 0.4)',
  'rgba(244, 114, 182, 0.4)',
];
const backgroundColors = ['#ffffff', '#fffbea', '#f1f5f9', '#ecfdf5', '#1f2937'];

const container = ref<HTMLDivElement>();
const svgInput = ref<HTMLInputElement>();
const imageInput = ref<HTMLInputElement>();
const editor = shallowRef<Editor | null>(null);

const activeTool = ref<ToolName | null>('pen');
const canUndo = ref(false);
const canRedo = ref(false);
const background = ref<BackgroundTypeName>('none');
const stylusOnly = ref<boolean | 'auto'>('auto');

const penState = ref({
  pen: { color: inkColors[0], thickness: 3, style: 'natural' as PenStyleName },
  highlighter: { color: highlightColors[0], thickness: 24, style: 'marker' as PenStyleName },
});
const shapeState = ref({ shape: 'rectangle' as ShapeTypeName, thickness: 2 });

const currentPen = computed(() => {
  return activeTool.value === 'pen' || activeTool.value === 'highlighter'
    ? penState.value[activeTool.value]
    : null;
});

const cleanups: Array<() => void> = [];

onMounted(async () => {
  const { Editor } = await import('easydrawer');

  const instance = new Editor(container.value!, {
    tools: {
      initial: 'pen',
      pen: penState.value.pen,
      highlighter: penState.value.highlighter,
      shape: { shape: 'rectangle', color: 'transparent', borderColor: '#1f2937', thickness: 2 },
    },
    input: { stylusOnly: 'auto' },
  });
  editor.value = instance;

  cleanups.push(
    instance.tools.onChange((name) => (activeTool.value = name)),
    instance.onChange(() => {
      canUndo.value = instance.canUndo();
      canRedo.value = instance.canRedo();
    }),
  );
});

onBeforeUnmount(() => {
  cleanups.forEach((cleanup) => cleanup());
  editor.value?.remove();
});

function toggleTool(name: ToolName) {
  editor.value?.tools.use(activeTool.value === name ? null : name);
}

function updatePen(options: Partial<{ color: string; thickness: number; style: PenStyleName }>) {
  const tool = activeTool.value;
  if (tool !== 'pen' && tool !== 'highlighter') return;

  Object.assign(penState.value[tool], options);
  editor.value?.tools.configure(tool, options);
}

function updateShape(options: Partial<{ shape: ShapeTypeName; color: string; borderColor: string; thickness: number }>) {
  if (options.shape) shapeState.value.shape = options.shape;
  if (options.thickness !== undefined) shapeState.value.thickness = options.thickness;
  editor.value?.tools.configure('shape', options);
}

function toggleBackground(type: BackgroundTypeName) {
  background.value = background.value === type ? 'none' : type;
  editor.value?.setBackground({ type: background.value });
}

function cycleStylusOnly() {
  stylusOnly.value = stylusOnly.value === 'auto' ? true : stylusOnly.value ? false : 'auto';
  editor.value?.toolController.setStylusOnly(stylusOnly.value);
}

function download(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

function saveSvg() {
  if (!editor.value) return;
  const url = URL.createObjectURL(new Blob([editor.value.toSVGString()], { type: 'image/svg+xml' }));
  download(url, 'drawing.svg');
  URL.revokeObjectURL(url);
}

function savePng() {
  if (editor.value) download(editor.value.toDataURL('image/png'), 'drawing.png');
}

async function onSvgSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !editor.value) return;

  editor.value.history.clearAllStack();
  await editor.value.loadFromSVG(await file.text());
  input.value = '';
}

async function onImagesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || !editor.value) return;

  await editor.value.uploadImages([...input.files]);
  input.value = '';
}
</script>

<template>
  <div class="playground">
    <div ref="container" class="playground-canvas" />

    <div class="playground-toolbar">
      <div class="row">
        <button
          v-for="tool in tools"
          :key="tool.name"
          class="tool"
          :class="{ active: activeTool === tool.name }"
          :title="tool.title"
          :aria-label="tool.title"
          :aria-pressed="activeTool === tool.name"
          @click="toggleTool(tool.name)"
        >
          <svg viewBox="0 0 24 24"><path :d="icons[tool.name]" /></svg>
        </button>

        <span class="sep" />

        <button class="tool" title="Undo" aria-label="Undo" :disabled="!canUndo" @click="editor?.undo()">
          <svg viewBox="0 0 24 24"><path :d="icons.undo" /></svg>
        </button>
        <button class="tool" title="Redo" aria-label="Redo" :disabled="!canRedo" @click="editor?.redo()">
          <svg viewBox="0 0 24 24"><path :d="icons.redo" /></svg>
        </button>
        <button class="tool" title="Clear" aria-label="Clear" @click="editor?.clear()">
          <svg viewBox="0 0 24 24"><path :d="icons.clear" /></svg>
        </button>

        <span class="sep" />

        <button
          v-for="type in (['solid', 'grid', 'dot'] as const)"
          :key="type"
          class="tool"
          :class="{ active: background === type }"
          :title="`${type} background`"
          :aria-label="`${type} background`"
          @click="toggleBackground(type)"
        >
          <svg viewBox="0 0 24 24"><path :d="icons[type]" /></svg>
        </button>

        <span class="sep" />

        <button class="tool" title="Insert image" aria-label="Insert image" @click="imageInput?.click()">
          <svg viewBox="0 0 24 24"><path :d="icons.image" /></svg>
        </button>
        <button class="tool" title="Open SVG" aria-label="Open SVG" @click="svgInput?.click()">
          <svg viewBox="0 0 24 24"><path :d="icons.open" /></svg>
        </button>
        <button class="tool text" title="Save SVG" @click="saveSvg">SVG</button>
        <button class="tool text" title="Save PNG" @click="savePng">PNG</button>
      </div>

      <div v-if="currentPen" class="row options">
        <button
          v-for="color in (activeTool === 'pen' ? inkColors : highlightColors)"
          :key="color"
          class="swatch"
          :class="{ active: currentPen.color === color }"
          :style="{ background: color }"
          :aria-label="color"
          @click="updatePen({ color })"
        />
        <input
          type="color"
          class="color-input"
          aria-label="Custom color"
          @input="updatePen({ color: ($event.target as HTMLInputElement).value })"
        >

        <label class="slider">
          Size
          <input
            type="range"
            min="1"
            :max="activeTool === 'pen' ? 16 : 48"
            step="0.5"
            :value="currentPen.thickness"
            @input="updatePen({ thickness: Number(($event.target as HTMLInputElement).value) })"
          >
        </label>

        <div class="segmented">
          <button
            v-for="item in penStyles"
            :key="item.style"
            :class="{ active: currentPen.style === item.style }"
            @click="updatePen({ style: item.style })"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="activeTool === 'shape'" class="row options">
        <div class="segmented wrap">
          <button
            v-for="shape in shapeNames"
            :key="shape"
            :class="{ active: shapeState.shape === shape }"
            @click="updateShape({ shape })"
          >
            {{ shape }}
          </button>
        </div>
        <span class="label">Fill</span>
        <button
          v-for="color in ['transparent', ...inkColors]"
          :key="`fill-${color}`"
          class="swatch"
          :style="{ background: color }"
          :aria-label="`Fill ${color}`"
          @click="updateShape({ color })"
        />
        <span class="label">Border</span>
        <button
          v-for="color in inkColors"
          :key="`border-${color}`"
          class="swatch"
          :style="{ background: color }"
          :aria-label="`Border ${color}`"
          @click="updateShape({ borderColor: color })"
        />
        <label class="slider">
          Border
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            :value="shapeState.thickness"
            @input="updateShape({ thickness: Number(($event.target as HTMLInputElement).value) })"
          >
        </label>
      </div>

      <div v-if="background !== 'none'" class="row options">
        <span class="label">Background</span>
        <button
          v-for="color in backgroundColors"
          :key="color"
          class="swatch"
          :style="{ background: color }"
          :aria-label="color"
          @click="editor?.setBackground({ color })"
        />
      </div>
    </div>

    <button class="stylus-mode" title="Palm rejection" @click="cycleStylusOnly">
      Fingers:
      <b>{{ stylusOnly === 'auto' ? 'auto' : stylusOnly ? 'pan only' : 'draw' }}</b>
    </button>

    <input ref="svgInput" type="file" accept="image/svg+xml" hidden @change="onSvgSelected">
    <input ref="imageInput" type="file" accept="image/*" multiple hidden @change="onImagesSelected">
  </div>
</template>

<style scoped>
.playground {
  position: relative;
  height: calc(100dvh - var(--vp-nav-height));
  overflow: hidden;
  overscroll-behavior: none;
  background: #fdf6e3;
}

.playground-canvas {
  position: absolute;
  inset: 0;
}

.playground-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  max-width: calc(100% - 16px);
  box-sizing: border-box;
  padding: 8px;
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: center;
}

.options {
  margin-top: 8px;
  padding-top: 8px;
  gap: 8px;
  border-top: 1px dashed #e5e7eb;
}

.tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: inherit;
  touch-action: manipulation;
}

.tool.text {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.tool svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tool:disabled {
  opacity: 0.35;
}

@media (hover: hover) {
  .tool:not(:disabled):hover {
    background: #f3f4f6;
  }
}

.tool.active,
.segmented button.active {
  background: #e8eefc;
  color: #1d4ed8;
}

.sep {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: #d1d5db;
}

.swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #d1d5db;
  background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%);
  touch-action: manipulation;
}

.swatch.active {
  box-shadow: 0 0 0 2px #2563eb;
}

.color-input {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
}

.slider,
.label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #6b7280;
}

.segmented {
  display: flex;
  padding: 2px;
  border-radius: 8px;
  background: #f3f4f6;
}

.segmented.wrap {
  flex-wrap: wrap;
  justify-content: center;
}

.segmented button {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  text-transform: capitalize;
  touch-action: manipulation;
}

.stylus-mode {
  position: absolute;
  right: 12px;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 10;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-size: 13px;
}

/* Tablets & phones: larger touch targets */
@media (pointer: coarse) {
  .tool {
    width: 44px;
    height: 44px;
  }

  .tool svg {
    width: 24px;
    height: 24px;
  }

  .swatch {
    width: 36px;
    height: 36px;
  }

  .segmented button {
    padding: 10px 14px;
    font-size: 15px;
  }

  .slider input {
    width: 180px;
    height: 32px;
  }
}
</style>
