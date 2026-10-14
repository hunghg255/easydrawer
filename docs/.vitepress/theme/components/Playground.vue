<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import type {
  BackgroundTypeName,
  Editor,
  PenStyleName,
  ShapeTypeName,
  StickyNote,
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
  laser: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1 7 17 M17 7l2.1-2.1',
  eyedropper: 'm2 22 1-1h3l9-9 M3 21v-3l9-9 M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
  fit: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  undo: 'M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  redo: 'M21 7v6h-6 M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7',
  clear: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  image: 'M3 3h18v18H3z M9 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M21 15l-5-5L5 21',
  open: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  save: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  dot: 'M6 6h.01 M12 6h.01 M18 6h.01 M6 12h.01 M12 12h.01 M18 12h.01 M6 18h.01 M12 18h.01 M18 18h.01',
  solid: 'M3 3h18v18H3z M3 21 21 3',
  sticky: 'M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z M15 3v6h6',
  connector: 'M5 19 19 5 M9 5h10v10',
  front: 'M12 19V5 M5 12l7-7 7 7',
  back: 'M12 5v14 M19 12l-7 7-7-7',
  duplicate: 'M8 8h12v12H8z M4 16V4h12',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.75-1.4',
  ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3v4 M17 5h4 M5 17v4 M3 19h4',
  group: 'M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 7h7v5H7z M10 12h7v5h-7z',
  ungroup: 'M4 5h8v6H4z M12 13h8v6h-8z',
  align: 'M4 3v18 M8 7h12v4H8z M8 14h7v4H8z',
  'align-left': 'M4 3v18 M8 7h12v4H8z M8 14h7v4H8z',
  'align-center': 'M12 3v18 M6 7h12v4H6z M8.5 14h7v4h-7z',
  'align-right': 'M20 3v18 M4 7h12v4H4z M9 14h7v4H9z',
  'align-top': 'M3 4h18 M7 8h4v12H7z M14 8h4v7h-4z',
  'align-middle': 'M3 12h18 M7 6h4v12H7z M14 8.5h4v7h-4z',
  'align-bottom': 'M3 20h18 M7 4h4v12H7z M14 9h4v7h-4z',
  'distribute-horizontal': 'M4 3v18 M20 3v18 M10 7h4v10h-4z',
  'distribute-vertical': 'M3 4h18 M3 20h18 M7 10h10v4H7z',
};

const alignments = [
  { edge: 'left', title: 'Align left' },
  { edge: 'center', title: 'Align centers horizontally' },
  { edge: 'right', title: 'Align right' },
  { edge: 'top', title: 'Align top' },
  { edge: 'middle', title: 'Align centers vertically' },
  { edge: 'bottom', title: 'Align bottom' },
] as const;

const tools: Array<{ name: ToolName; title: string }> = [
  { name: 'select', title: 'Select' },
  { name: 'text', title: 'Text' },
  { name: 'pen', title: 'Pen' },
  { name: 'highlighter', title: 'Highlighter' },
  { name: 'eraser', title: 'Eraser' },
  { name: 'shape', title: 'Shapes' },
  { name: 'laser', title: 'Laser pointer' },
  { name: 'eyedropper', title: 'Eyedropper' },
  { name: 'sticky', title: 'Sticky note' },
  { name: 'connector', title: 'Connector (arrow between shapes)' },
];

const shortcuts: Array<[string, string]> = [
  ['V', 'Select'],
  ['P', 'Pen'],
  ['M', 'Highlighter'],
  ['E', 'Eraser'],
  ['T', 'Text'],
  ['S', 'Shapes'],
  ['K', 'Laser pointer'],
  ['I', 'Eyedropper'],
  ['N', 'Sticky note (click a note to edit it)'],
  ['C', 'Connector: drag from one shape to another'],
  ['1 – 9', 'Tools in toolbar order'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Ctrl/⌘ + A', 'Select all'],
  ['Delete', 'Delete selection'],
  ['Ctrl/⌘ + G', 'Group (Ctrl/⌘ + Shift + G: ungroup)'],
  ['Double click', 'Edit a note or text'],
  ['− / =', 'Thinner / thicker pen'],
  ['Ctrl/⌘ + wheel, pinch', 'Zoom'],
  ['Arrows, two fingers', 'Pan'],
  ['Hold still at the end of a stroke', 'Snap to line / circle / rectangle'],
  ['?', 'Show/hide this help'],
];

const shapeNames: ShapeTypeName[] = [
  'square', 'rectangle', 'circle', 'triangle', 'hexagon', 'diamond',
  'arrow', 'line', 'heart', 'star', 'cloud', 'parallelogram',
];
const penStyles: Array<{ style: PenStyleName; label: string }> = [
  { style: 'natural', label: 'Ink' },
  { style: 'pencil', label: 'Pencil' },
  { style: 'calligraphy', label: 'Brush' },
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
const noteColors = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff'];
const arrowModes = [
  { mode: 'end', label: '→' },
  { mode: 'both', label: '↔' },
  { mode: 'none', label: '—' },
] as const;

const container = ref<HTMLDivElement>();
const svgInput = ref<HTMLInputElement>();
const imageInput = ref<HTMLInputElement>();
const editor = shallowRef<Editor | null>(null);

const activeTool = ref<ToolName | null>('pen');
const canUndo = ref(false);
const canRedo = ref(false);
const background = ref<BackgroundTypeName>('none');
const stylusOnly = ref<boolean | 'auto'>('auto');
const zoom = ref(1);
const selectMode = ref<'rectangle' | 'lasso'>('rectangle');
const showHelp = ref(false);

// AI panel
const showAI = ref(false);
const aiPrompt = ref('');
const aiBusy = ref<'diagram' | 'organize' | null>(null);
const aiMessage = ref<{ kind: 'error' | 'info'; text: string } | null>(null);
const aiExamples = [
  'Login flow: enter email and password, check them, show an error if wrong, otherwise open the dashboard',
  'Quy trình đặt hàng online: chọn sản phẩm, thêm vào giỏ, thanh toán, giao hàng, nhận hàng',
  'Architecture of a web app: browser, CDN, API server, database, cache, background worker',
];
let aiAbort: AbortController | null = null;

// Shown after the AI changed the drawing (the panel closes so the result is visible).
const aiToast = ref('');
let aiToastTimeout: ReturnType<typeof setTimeout> | undefined;
function showAIToast(text: string) {
  aiToast.value = text;
  clearTimeout(aiToastTimeout);
  aiToastTimeout = setTimeout(() => (aiToast.value = ''), 5000);
}

// The playground's server function (api/ai.js) forwards requests to OpenRouter.
async function playgroundAIRequest({ messages, signal }: { messages: unknown[]; signal?: AbortSignal }) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.content !== 'string') {
    throw new Error(data?.error ?? `AI is not available here (${response.status}).`);
  }
  return data.content as string;
}

async function runAI(action: 'diagram' | 'organize') {
  const instance = editor.value;
  if (!instance || aiBusy.value) return;

  aiAbort = new AbortController();
  aiBusy.value = action;
  aiMessage.value = null;
  try {
    if (action === 'diagram') {
      if (!aiPrompt.value.trim()) {
        aiMessage.value = { kind: 'info', text: 'Describe the diagram first, or pick an example.' };
        return;
      }
      const diagram = await instance.ai.generateDiagram(aiPrompt.value, { signal: aiAbort.signal });
      showAI.value = false;
      showAIToast(`✨ Added ${diagram.nodes.length} shapes and ${diagram.edges.length} arrows — Ctrl/⌘+Z to undo.`);
    } else {
      const groups = await instance.ai.organizeNotes({ signal: aiAbort.signal });
      showAI.value = false;
      showAIToast(`🗂️ Sorted into ${groups.length} groups: ${groups.map((g) => g.title).join(', ')}.`);
    }
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      aiMessage.value = { kind: 'error', text: (error as Error)?.message ?? String(error) };
    }
  } finally {
    aiBusy.value = null;
    aiAbort = null;
  }
}

function cancelAI() {
  aiAbort?.abort();
}
const stickyColor = ref(noteColors[0]);
const connectorState = ref({
  color: inkColors[0],
  arrow: 'end' as 'end' | 'both' | 'none',
  routing: 'elbow' as 'straight' | 'elbow',
});

// Floating toolbar next to the selection
const quickBar = ref<HTMLDivElement>();
const selectionCount = ref(0);
const selectionHasNote = ref(false);
// Things that move separately: groups count as one.
const selectionUnits = ref(0);
const selectionHasGroups = ref(false);
const showAlign = ref(false);
const lockedCount = ref(0);
const quickBarPosition = ref<{ left: number; top: number } | null>(null);
const pointerDown = ref(false);

// Recently used colors, remembered between visits (when storage is available).
const recentColorsKey = 'easydrawer-playground-recent-colors';
const recentColors = ref<string[]>([]);
function loadRecentColors() {
  try {
    recentColors.value = JSON.parse(localStorage.getItem(recentColorsKey) ?? '[]');
  } catch {
    recentColors.value = [];
  }
}
function rememberColor(color: string) {
  if ([...inkColors, ...highlightColors].includes(color)) return;
  recentColors.value = [color, ...recentColors.value.filter((c) => c !== color)].slice(0, 6);
  try {
    localStorage.setItem(recentColorsKey, JSON.stringify(recentColors.value));
  } catch {
    // Not important: the list just won't be remembered.
  }
}

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
  const { Editor, Color4, StickyNote: StickyNoteClass } = await import('easydrawer');

  const instance = new Editor(container.value!, {
    tools: {
      initial: 'pen',
      pen: penState.value.pen,
      highlighter: penState.value.highlighter,
      shape: { shape: 'rectangle', color: 'transparent', borderColor: '#1f2937', thickness: 2 },
      connector: { routing: 'elbow' },
    },
    input: { stylusOnly: 'auto' },
    ai: { request: playgroundAIRequest },
  });
  editor.value = instance;

  loadRecentColors();

  // Restore the previous drawing and keep saving it.
  cleanups.push(await instance.autosave({ key: 'easydrawer-playground' }));

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key === '?') {
      showHelp.value = !showHelp.value;
    } else if (event.key === 'Escape') {
      showHelp.value = false;
    }
  };
  window.addEventListener('keydown', onKeyDown);
  cleanups.push(() => window.removeEventListener('keydown', onKeyDown));

  cleanups.push(
    instance.tools.onChange((name) => {
      activeTool.value = name;
      // The eyedropper may have changed the pen colors.
      for (const tool of ['pen', 'highlighter'] as const) {
        const current = instance.tools[tool].getColor();
        if (!Color4.fromString(penState.value[tool].color).eq(current)) {
          const color = current.toHexString();
          penState.value[tool].color = color;
          rememberColor(color);
        }
      }
    }),
    instance.onChange(() => {
      canUndo.value = instance.canUndo();
      canRedo.value = instance.canRedo();
    }),
    instance.onZoomChange((value) => (zoom.value = value)),
    instance.selection.onChange((items) => {
      selectionCount.value = items.length;
      selectionHasNote.value = items.some((item) => item instanceof StickyNoteClass);
      selectionUnits.value = new Set(items.map((item) => item.getGroupId() ?? item.getId())).size;
      selectionHasGroups.value = instance.selection.hasGroups;
      if (items.length === 0) showAlign.value = false;
      lockedCount.value = instance.selection.lockedCount;
      // After Vue has updated the toolbar's buttons (its width depends on them).
      void nextTick(updateQuickBar);
    }),
  );

  // Hide the floating toolbar while dragging (e.g. moving the selection).
  const onPointerDown = () => (pointerDown.value = true);
  const onPointerUp = () => {
    pointerDown.value = false;
    updateQuickBar();
  };
  container.value!.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp);
  cleanups.push(() => {
    container.value?.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUp);
  });
});

function updateQuickBar() {
  const rect = editor.value?.selection.getScreenRect();
  const area = container.value;
  if (!rect || !area) {
    quickBarPosition.value = null;
    return;
  }

  // Below the selection if there's room, otherwise above it (clear of the rotation handle).
  // Measured while hidden (visibility: hidden), so the size is known before showing it.
  const barWidth = quickBar.value?.offsetWidth || 320;
  const barHeight = quickBar.value?.offsetHeight || 44;
  const margin = 8;
  let top = rect.bottomRight.y + 16;
  if (top + barHeight > area.clientHeight - margin) {
    top = rect.topLeft.y - barHeight - 48;
  }
  const left = rect.center.x - barWidth / 2;
  quickBarPosition.value = {
    left: Math.min(Math.max(margin, left), area.clientWidth - barWidth - margin),
    top: Math.min(Math.max(margin, top), area.clientHeight - barHeight - margin),
  };
}

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
  if (options.color) rememberColor(options.color);
}

function updateShape(options: Partial<{ shape: ShapeTypeName; color: string; borderColor: string; thickness: number }>) {
  if (options.shape) shapeState.value.shape = options.shape;
  if (options.thickness !== undefined) shapeState.value.thickness = options.thickness;
  editor.value?.tools.configure('shape', options);
}

function setStickyColor(color: string) {
  stickyColor.value = color;
  editor.value?.tools.configure('sticky', { color });
}

function updateConnector(options: Partial<{ color: string; arrow: 'end' | 'both' | 'none'; routing: 'straight' | 'elbow' }>) {
  Object.assign(connectorState.value, options);
  editor.value?.tools.configure('connector', options);
}

function editNote() {
  const instance = editor.value;
  const note = instance?.selection.items[0];
  if (!instance || !note) return;
  instance.selection.clear();
  instance.tools.sticky.edit(note as StickyNote);
}

async function unlockAll() {
  await editor.value?.selection.unlockAll();
  lockedCount.value = editor.value?.selection.lockedCount ?? 0;
}

function setSelectMode(mode: 'rectangle' | 'lasso') {
  selectMode.value = mode;
  editor.value?.tools.configure('select', { mode });
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

        <span class="sep" />

        <button
          class="tool text ai-button"
          :class="{ active: showAI }"
          title="AI: generate diagrams, organize notes"
          aria-label="AI"
          @click="showAI = !showAI"
        >
          <svg viewBox="0 0 24 24"><path :d="icons.ai" /></svg>
          AI
        </button>
      </div>

      <div v-if="showAI" class="row options ai-panel">
        <form class="ai-form" @submit.prevent="runAI('diagram')">
          <textarea
            v-model="aiPrompt"
            rows="2"
            placeholder="Describe a diagram: a process, a flowchart, an architecture…"
            :disabled="!!aiBusy"
            @keydown.enter.exact.prevent="runAI('diagram')"
          />
          <div class="ai-actions">
            <button type="submit" class="ai-primary" :disabled="!!aiBusy">
              {{ aiBusy === 'diagram' ? 'Drawing…' : '✨ Generate diagram' }}
            </button>
            <button
              type="button"
              :disabled="!!aiBusy"
              title="Group the sticky notes (selected, or all) by theme"
              @click="runAI('organize')"
            >
              {{ aiBusy === 'organize' ? 'Organizing…' : '🗂️ Organize sticky notes' }}
            </button>
            <button v-if="aiBusy" type="button" @click="cancelAI">Cancel</button>
          </div>
        </form>
        <div class="ai-examples">
          <span class="label">Try:</span>
          <button v-for="example in aiExamples" :key="example" type="button" :disabled="!!aiBusy" @click="aiPrompt = example">
            {{ example.length > 42 ? `${example.slice(0, 40)}…` : example }}
          </button>
        </div>
        <p v-if="aiMessage" class="ai-message" :class="aiMessage.kind">{{ aiMessage.text }}</p>
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
        <button
          v-for="color in recentColors"
          :key="`recent-${color}`"
          class="swatch"
          :class="{ active: currentPen.color === color }"
          :style="{ background: color }"
          :aria-label="`Recent color ${color}`"
          @click="updatePen({ color })"
        />
        <button
          class="tool"
          title="Pick a color from the drawing (I)"
          aria-label="Pick a color from the drawing"
          @click="editor?.tools.use('eyedropper')"
        >
          <svg viewBox="0 0 24 24"><path :d="icons.eyedropper" /></svg>
        </button>
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

      <div v-if="activeTool === 'select'" class="row options">
        <div class="segmented">
          <button :class="{ active: selectMode === 'rectangle' }" @click="setSelectMode('rectangle')">
            Rectangle
          </button>
          <button :class="{ active: selectMode === 'lasso' }" @click="setSelectMode('lasso')">
            Lasso
          </button>
        </div>
      </div>

      <div v-if="activeTool === 'select' && lockedCount > 0" class="row options">
        <span class="label">{{ lockedCount }} locked</span>
        <button class="tool text" title="Unlock all" @click="unlockAll">
          <svg viewBox="0 0 24 24"><path :d="icons.unlock" /></svg>
          Unlock all
        </button>
      </div>

      <div v-if="activeTool === 'sticky'" class="row options">
        <span class="label">Note color</span>
        <button
          v-for="color in noteColors"
          :key="color"
          class="swatch"
          :class="{ active: stickyColor === color }"
          :style="{ background: color }"
          :aria-label="`Note ${color}`"
          @click="setStickyColor(color)"
        />
        <span class="label">Click to add a note, click a note to edit it.</span>
      </div>

      <div v-if="activeTool === 'connector'" class="row options">
        <button
          v-for="color in inkColors"
          :key="`connector-${color}`"
          class="swatch"
          :class="{ active: connectorState.color === color }"
          :style="{ background: color }"
          :aria-label="color"
          @click="updateConnector({ color })"
        />
        <div class="segmented">
          <button
            v-for="item in arrowModes"
            :key="item.mode"
            :class="{ active: connectorState.arrow === item.mode }"
            :aria-label="`Arrow ${item.mode}`"
            @click="updateConnector({ arrow: item.mode })"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="segmented">
          <button :class="{ active: connectorState.routing === 'straight' }" @click="updateConnector({ routing: 'straight' })">
            Straight
          </button>
          <button :class="{ active: connectorState.routing === 'elbow' }" @click="updateConnector({ routing: 'elbow' })">
            Elbow
          </button>
        </div>
        <span class="label">Drag from one shape to another — the arrow follows them.</span>
      </div>

      <div v-if="activeTool === 'laser'" class="row options">
        <span class="label">Point at things — the trail fades away and is never saved.</span>
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

    <div
      ref="quickBar"
      class="quick-bar"
      :class="{ hidden: !(selectionCount > 0 && quickBarPosition && !pointerDown) }"
      :style="quickBarPosition ? { left: `${quickBarPosition.left}px`, top: `${quickBarPosition.top}px` } : {}"
    >
      <button
        v-for="color in (selectionHasNote ? [...noteColors, ...inkColors.slice(0, 3)] : inkColors)"
        :key="`quick-${color}`"
        class="swatch small"
        :style="{ background: color }"
        :aria-label="`Color ${color}`"
        @click="editor?.selection.setColor(color)"
      />
      <span class="sep" />
      <button v-if="selectionCount === 1 && selectionHasNote" class="tool" title="Edit text" aria-label="Edit text" @click="editNote">
        <svg viewBox="0 0 24 24"><path :d="icons.text" /></svg>
      </button>
      <button
        v-if="selectionUnits > 1"
        class="tool"
        title="Group (Ctrl/⌘+G)"
        aria-label="Group"
        @click="editor?.selection.group()"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.group" /></svg>
      </button>
      <button
        v-if="selectionHasGroups"
        class="tool"
        title="Ungroup (Ctrl/⌘+Shift+G)"
        aria-label="Ungroup"
        @click="editor?.selection.ungroup()"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.ungroup" /></svg>
      </button>
      <button
        v-if="selectionUnits > 1"
        class="tool"
        :class="{ active: showAlign }"
        title="Align & distribute"
        aria-label="Align and distribute"
        @click="showAlign = !showAlign; nextTick(updateQuickBar)"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.align" /></svg>
      </button>
      <button class="tool" title="Bring to front" aria-label="Bring to front" @click="editor?.selection.bringToFront()">
        <svg viewBox="0 0 24 24"><path :d="icons.front" /></svg>
      </button>
      <button class="tool" title="Send to back" aria-label="Send to back" @click="editor?.selection.sendToBack()">
        <svg viewBox="0 0 24 24"><path :d="icons.back" /></svg>
      </button>
      <button class="tool" title="Duplicate" aria-label="Duplicate" @click="editor?.selection.duplicate()">
        <svg viewBox="0 0 24 24"><path :d="icons.duplicate" /></svg>
      </button>
      <button class="tool" title="Lock" aria-label="Lock" @click="editor?.selection.lock()">
        <svg viewBox="0 0 24 24"><path :d="icons.lock" /></svg>
      </button>
      <button class="tool danger" title="Delete" aria-label="Delete" @click="editor?.selection.delete()">
        <svg viewBox="0 0 24 24"><path :d="icons.clear" /></svg>
      </button>
      <div v-if="showAlign && selectionUnits > 1" class="quick-row">
        <button
          v-for="item in alignments"
          :key="item.edge"
          class="tool"
          :title="item.title"
          :aria-label="item.title"
          @click="editor?.selection.align(item.edge)"
        >
          <svg viewBox="0 0 24 24"><path :d="icons[`align-${item.edge}`]" /></svg>
        </button>
        <template v-if="selectionUnits > 2">
          <span class="sep" />
          <button
            v-for="direction in (['horizontal', 'vertical'] as const)"
            :key="direction"
            class="tool"
            :title="`Distribute ${direction}ly`"
            :aria-label="`Distribute ${direction}ly`"
            @click="editor?.selection.distribute(direction)"
          >
            <svg viewBox="0 0 24 24"><path :d="icons[`distribute-${direction}`]" /></svg>
          </button>
        </template>
      </div>
    </div>

    <div v-if="aiToast" class="ai-toast" role="status">{{ aiToast }}</div>

    <div class="zoom-controls">
      <button class="tool" title="Zoom out" aria-label="Zoom out" @click="editor?.zoomOut()">−</button>
      <button class="zoom-value" title="Reset to 100%" @click="editor?.setZoom(1)">
        {{ Math.round(zoom * 100) }}%
      </button>
      <button class="tool" title="Zoom in" aria-label="Zoom in" @click="editor?.zoomIn()">+</button>
      <button class="tool" title="Fit to content" aria-label="Fit to content" @click="editor?.zoomToFit()">
        <svg viewBox="0 0 24 24"><path :d="icons.fit" /></svg>
      </button>
    </div>

    <div v-if="showHelp" class="help" role="dialog" aria-label="Keyboard shortcuts" @click.self="showHelp = false">
      <div class="help-card">
        <div class="help-header">
          <b>Keyboard shortcuts</b>
          <button class="tool" aria-label="Close" @click="showHelp = false">✕</button>
        </div>
        <dl>
          <template v-for="[keys, action] in shortcuts" :key="keys">
            <dt><kbd>{{ keys }}</kbd></dt>
            <dd>{{ action }}</dd>
          </template>
        </dl>
      </div>
    </div>

    <button class="help-button" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" @click="showHelp = !showHelp">?</button>

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

.ai-button svg {
  margin-right: 4px;
}

.ai-panel {
  flex-direction: column;
  align-items: stretch;
  width: min(560px, calc(100vw - 48px));
  margin-left: auto;
  margin-right: auto;
}

.ai-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  resize: vertical;
}

.ai-actions,
.ai-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ai-actions button,
.ai-examples button {
  padding: 6px 10px;
  border-radius: 8px;
  background: #f3f4f6;
  font-size: 13px;
  touch-action: manipulation;
}

.ai-actions .ai-primary {
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
}

.ai-actions button:disabled,
.ai-examples button:disabled {
  opacity: 0.6;
}

.ai-examples button {
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
}

.ai-toast {
  position: absolute;
  left: 50%;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 8px);
  transform: translateX(-50%);
  z-index: 16;
  max-width: calc(100% - 32px);
  padding: 8px 14px;
  border-radius: 999px;
  background: #1f2937;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.2);
}

.ai-message {
  margin: 0;
  font-size: 13px;
  color: #374151;
}

.ai-message.error {
  color: #b91c1c;
}

.quick-bar {
  position: absolute;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
  user-select: none;
  -webkit-user-select: none;
}

.quick-bar {
  flex-wrap: wrap;
  max-width: calc(100% - 16px);
}

.quick-row {
  display: flex;
  flex-basis: 100%;
  justify-content: center;
  gap: 2px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #e5e7eb;
}

.quick-bar.hidden {
  visibility: hidden;
  pointer-events: none;
}

.quick-bar .swatch.small {
  width: 22px;
  height: 22px;
  margin: 0 1px;
}

.quick-bar .tool {
  width: 32px;
  height: 32px;
}

.quick-bar .tool svg {
  width: 18px;
  height: 18px;
}

.quick-bar .danger {
  color: #dc2626;
}

.zoom-controls {
  position: absolute;
  left: 12px;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  font-size: 18px;
}

.zoom-value {
  min-width: 56px;
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  touch-action: manipulation;
}

.help {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.25);
}

.help-card {
  width: min(460px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  overflow: auto;
  padding: 16px 20px;
  border-radius: 14px;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.help dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
  font-size: 14px;
}

.help dt {
  text-align: end;
}

.help dd {
  margin: 0;
  color: #4b5563;
}

.help kbd {
  padding: 2px 6px;
  border: 1px solid #d1d5db;
  border-bottom-width: 2px;
  border-radius: 5px;
  background: #f9fafb;
  font-size: 12px;
  white-space: nowrap;
}

.help-button {
  position: absolute;
  right: 12px;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 44px);
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-weight: 600;
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

  .quick-bar .swatch.small {
    width: 30px;
    height: 30px;
  }

  .quick-bar .tool {
    width: 44px;
    height: 44px;
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
