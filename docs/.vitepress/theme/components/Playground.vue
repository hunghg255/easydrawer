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
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01',
  ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3v4 M17 5h4 M5 17v4 M3 19h4',
  group: 'M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 7h7v5H7z M10 12h7v5h-7z',
  ungroup: 'M4 5h8v6H4z M12 13h8v6h-8z',
  align: 'M4 3v18 M8 7h12v4H8z M8 14h7v4H8z',
  frame: 'M3 7h18 M3 17h18 M7 3v18 M17 3v18',
  play: 'M7 4l13 8-13 8z',
  mermaid: 'M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2 M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2',
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

const tools: Array<{ name: ToolName; title: string; key?: string }> = [
  { name: 'select', title: 'Select', key: 'V' },
  { name: 'pen', title: 'Pen', key: 'P' },
  { name: 'highlighter', title: 'Highlighter', key: 'M' },
  { name: 'eraser', title: 'Eraser', key: 'E' },
  { name: 'shape', title: 'Shapes', key: 'S' },
  { name: 'connector', title: 'Connector (arrow between shapes)', key: 'C' },
  { name: 'text', title: 'Text', key: 'T' },
  { name: 'sticky', title: 'Sticky note', key: 'N' },
  { name: 'laser', title: 'Laser pointer', key: 'K' },
  { name: 'eyedropper', title: 'Eyedropper', key: 'I' },
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
  ['Ctrl/⌘ + K', 'Ask AI to do something'],
  ['→ / Space, ←, Esc', 'Next / previous frame, stop (while presenting)'],
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
type AIAction =
  | 'diagram'
  | 'mindmap'
  | 'mermaid'
  | 'expand'
  | 'chart'
  | 'picture'
  | 'code'
  | 'edit'
  | 'brainstorm'
  | 'organize'
  | 'command'
  | 'selection';

const showMenu = ref(false);

// What the AI panel creates
type AIMode = 'diagram' | 'mindmap' | 'chart' | 'picture' | 'code' | 'mermaid';
const aiMode = ref<AIMode>('diagram');
const aiModes: Array<{
  id: AIMode;
  label: string;
  action: AIAction;
  button: string;
  placeholder: string;
  examples: string[];
}> = [
  {
    id: 'diagram',
    label: 'Diagram',
    action: 'diagram',
    button: '✨ Generate diagram',
    placeholder: 'Describe a process, a flowchart, an architecture…',
    examples: [
      'Login flow: enter email and password, check them, show an error if wrong, otherwise open the dashboard',
      'Quy trình đặt hàng online: chọn sản phẩm, thêm vào giỏ, thanh toán, giao hàng, nhận hàng',
      'Architecture of a web app: browser, CDN, API server, database, cache, background worker',
    ],
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    action: 'mindmap',
    button: '🧠 Generate mind map',
    placeholder: 'A topic, e.g. "launching a mobile app" — then select a topic to grow it',
    examples: ['Launching a mobile app', 'Kế hoạch du lịch Đà Nẵng 4 ngày', 'Learning machine learning from scratch'],
  },
  {
    id: 'chart',
    label: 'Chart',
    action: 'chart',
    button: '📊 Draw chart',
    placeholder: 'Data or a description, e.g. "revenue Q1–Q4: 10, 20, 15, 30"',
    examples: [
      'Revenue 2024 by quarter: Q1 120, Q2 150, Q3 135, Q4 190 (k$)',
      'Thị phần trình duyệt: Chrome 65%, Safari 18%, Edge 5%, Firefox 3%, khác 9%',
      'Monthly visitors Jan–Jun for web and mobile, mobile growing faster',
    ],
  },
  {
    id: 'picture',
    label: 'Picture',
    action: 'picture',
    button: '🎨 Draw picture',
    placeholder: 'What to draw, e.g. "a cat reading a book", "database icon"',
    examples: ['A cute cat reading a book', 'Icon of a cloud database', 'A coffee cup with steam', 'Con thuyền trên biển lúc hoàng hôn'],
  },
  {
    id: 'code',
    label: 'Code',
    action: 'code',
    button: '🧩 Code → diagram',
    placeholder: 'Paste SQL (→ ERD), classes (→ class diagram) or code (→ flowchart)',
    examples: [
      'CREATE TABLE users (id INT PRIMARY KEY, email TEXT);\nCREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id), total DECIMAL);\nCREATE TABLE order_items (id INT PRIMARY KEY, order_id INT REFERENCES orders(id), product TEXT, qty INT);',
      'class Animal { name: string; speak(): void {} }\nclass Dog extends Animal { breed: string; fetch(): void {} }\nclass Owner { dogs: Dog[]; walk(dog: Dog) {} }',
      'function login(user) {\n  if (!user.email) throw new Error("missing email");\n  const ok = checkPassword(user);\n  if (!ok) return showError();\n  return openDashboard();\n}',
    ],
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    action: 'mermaid',
    button: '🧜 Draw Mermaid (no AI)',
    placeholder: 'Paste a Mermaid flowchart, erDiagram or classDiagram',
    examples: [
      'flowchart TD\n  A([Start]) --> B{Logged in?}\n  B -->|yes| C[Dashboard]\n  B -->|no| D[/Login form/] --> B',
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains\n  CUSTOMER {\n    int id PK\n    string email\n  }\n  ORDER {\n    int id PK\n    int customer_id FK\n  }',
      'classDiagram\n  Animal <|-- Dog\n  Animal <|-- Cat\n  class Animal {\n    +String name\n    +speak()\n  }\n  class Dog {\n    +fetch()\n  }',
    ],
  },
];
const currentAIMode = computed(() => aiModes.find((mode) => mode.id === aiMode.value)!);

// ✨ in the floating toolbar: change the selection with AI.
const showQuickAI = ref(false);
const quickAIText = ref('');
const quickAIInput = ref<HTMLInputElement>();
function toggleQuickAI() {
  showQuickAI.value = !showQuickAI.value;
  void nextTick(() => {
    updateQuickBar();
    quickAIInput.value?.focus();
  });
}
const aiBusy = ref<AIAction | null>(null);
const selectionHasDiagram = ref(false);
const selectionHasTopic = ref(false);
const selectionHasMindMap = ref(false);

// Command palette (Ctrl/⌘+K while the drawing has focus)
const showCommand = ref(false);
const commandText = ref('');
const commandInput = ref<HTMLInputElement>();
const commandExamples = [
  'Color the notes about marketing in blue',
  'Align the selected shapes to the left and group them',
  'Thêm bước gửi email xác nhận vào sơ đồ',
  'What is missing in this flowchart?',
];
function openCommand() {
  showCommand.value = true;
  void nextTick(() => commandInput.value?.focus());
}
const aiMessage = ref<{ kind: 'error' | 'info'; text: string } | null>(null);
let aiAbort: AbortController | null = null;

// Shown after the AI changed the drawing (the panel closes so the result is visible).
const aiToast = ref('');
let aiToastTimeout: ReturnType<typeof setTimeout> | undefined;
function showAIToast(text: string, duration = 5000) {
  aiToast.value = text;
  clearTimeout(aiToastTimeout);
  aiToastTimeout = setTimeout(() => (aiToast.value = ''), duration);
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
    if (data?.error) throw new Error(data.error);
    throw new Error(
      response.status === 404
        ? 'AI is not available here: /api/ai was not found (it only runs on Vercel).'
        : response.status === 504
          ? 'The AI took too long to answer (timeout). Try again, or use a faster model.'
          : `AI request failed (HTTP ${response.status}).`,
    );
  }
  return data.content as string;
}

async function runAI(action: AIAction) {
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
      showAIToast(`✨ Added ${diagram.nodes.length} shapes and ${diagram.edges.length} arrows — Ctrl/⌘+Z to undo.`);
    } else if (action === 'mindmap' || action === 'mermaid' || action === 'chart' || action === 'picture' || action === 'code') {
      if (!aiPrompt.value.trim()) {
        aiMessage.value = { kind: 'info', text: 'Type something first, or pick an example.' };
        return;
      }
      if (action === 'mindmap') {
        const mindMap = await instance.ai.generateMindMap(aiPrompt.value, { signal: aiAbort.signal });
        showAIToast(`🧠 Added a mind map with ${mindMap.children?.length ?? 0} branches — select a topic and “Grow” it.`);
      } else if (action === 'mermaid') {
        const diagram = await instance.ai.drawMermaid(aiPrompt.value);
        showAIToast(`🧜 Drew ${diagram.nodes.length} boxes and ${diagram.edges.length} arrows — Ctrl/⌘+Z to undo.`);
      } else if (action === 'chart') {
        const chart = await instance.ai.generateChart(aiPrompt.value, { signal: aiAbort.signal });
        showAIToast(`📊 Added a ${chart.type} chart${chart.title ? `: ${chart.title}` : ''} — Ctrl/⌘+Z to undo.`);
      } else if (action === 'picture') {
        const strokes = await instance.ai.generateIllustration(aiPrompt.value, { signal: aiAbort.signal });
        showAIToast(`🎨 Added a picture (${strokes.length} shapes, grouped) — Ctrl/⌘+Z to undo.`);
      } else {
        const diagram = await instance.ai.diagramFromCode(aiPrompt.value, { signal: aiAbort.signal });
        showAIToast(`🧩 Added a diagram with ${diagram.nodes.length} boxes — Ctrl/⌘+Z to undo.`);
      }
    } else if (action === 'edit') {
      if (!aiPrompt.value.trim()) {
        aiMessage.value = { kind: 'info', text: 'Describe the change, e.g. "add a step to send a confirmation email".' };
        return;
      }
      const diagram = await instance.ai.editDiagram(aiPrompt.value, { signal: aiAbort.signal });
      showAIToast(`✏️ Updated the diagram (${diagram.nodes.length} shapes) — Ctrl/⌘+Z to undo.`);
    } else if (action === 'selection') {
      const request = quickAIText.value.trim();
      if (!request) return;
      const result = await instance.ai.editSelection(request, { signal: aiAbort.signal });
      quickAIText.value = '';
      showQuickAI.value = false;
      showAIToast(`✨ ${result.message}`, result.actions.length === 0 ? 12000 : 5000);
    } else if (action === 'expand') {
      const topics = await instance.ai.expandMindMap({ signal: aiAbort.signal });
      showAIToast(`🌿 Added ${topics.length} sub-topics — Ctrl/⌘+Z to undo.`);
    } else if (action === 'brainstorm') {
      const notes = await instance.ai.brainstorm({ signal: aiAbort.signal });
      showAIToast(`💡 Added ${notes.length} ideas — Ctrl/⌘+Z to undo.`);
    } else if (action === 'command') {
      const request = commandText.value.trim();
      if (!request) return;
      const result = await instance.ai.runCommand(request, { signal: aiAbort.signal });
      showCommand.value = false;
      commandText.value = '';
      showAIToast(`✨ ${result.message}`, result.actions.length === 0 ? 12000 : 5000);
    } else {
      const groups = await instance.ai.organizeNotes({ signal: aiAbort.signal });
      showAIToast(`🗂️ Sorted into ${groups.length} groups: ${groups.map((g) => g.title).join(', ')}.`);
    }
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      const text = (error as Error)?.message ?? String(error);
      if (action === 'command' || action === 'selection') {
        showAIToast(`⚠️ ${text}`, 8000);
      } else {
        aiMessage.value = { kind: 'error', text };
      }
    }
  } finally {
    aiBusy.value = null;
    aiAbort = null;
  }
}

function cancelAI() {
  aiAbort?.abort();
}

// The selected diagram (or the whole drawing) as Mermaid text: copied, and shown in the panel.
async function copyMermaid() {
  const text = editor.value?.ai.toMermaid();
  if (!text) {
    aiMessage.value = { kind: 'info', text: 'There is no diagram to export: draw boxes with text and arrows between them.' };
    return;
  }
  aiMode.value = 'mermaid';
  aiPrompt.value = text;
  try {
    await navigator.clipboard.writeText(text);
    showAIToast('📋 Copied as Mermaid — paste it in GitHub, Notion, Obsidian…');
  } catch {
    showAIToast('🧜 The Mermaid text is in the AI panel.');
  }
}

// Frames and presentation
const root = ref<HTMLElement>();
const frameCount = ref(0);
const presenting = ref<number | null>(null);

async function addFrame() {
  showMenu.value = false;
  const frame = await editor.value?.frames.add();
  if (frame) showAIToast(`▢ Added “${frame.title}” — double-click its title to rename it. ▶ Present in the ⋯ menu.`);
}

async function frameSelection() {
  showMenu.value = false;
  const frame = await editor.value?.frames.addAroundSelection();
  if (frame) showAIToast(`▣ Added “${frame.title}” around the selection.`);
}

async function showSlide(index: number) {
  const instance = editor.value;
  if (!instance) return;
  const count = instance.frames.list().length;
  if (count === 0) {
    stopPresentation();
    return;
  }
  presenting.value = Math.min(Math.max(index, 0), count - 1);
  await instance.frames.goTo(presenting.value, { padding: 8 });
}

async function startPresentation() {
  showMenu.value = false;
  showAI.value = false;
  const instance = editor.value;
  if (!instance) return;
  if (instance.frames.list().length === 0) {
    showAIToast('Add a frame first: ⋯ → Add frame.');
    return;
  }
  instance.selection.clear();
  presenting.value = 0;
  try {
    await root.value?.requestFullscreen?.();
  } catch {
    // Not available (e.g. iOS Safari): present in the page.
  }
  await nextTick();
  await showSlide(0);
}

function stopPresentation() {
  presenting.value = null;
  if (document.fullscreenElement) void document.exitFullscreen?.();
}

function nextSlide(step: number) {
  if (presenting.value === null) return;
  const count = editor.value?.frames.list().length ?? 0;
  const next = presenting.value + step;
  if (next >= count) {
    stopPresentation();
    return;
  }
  void showSlide(next);
}

// Each frame as a page, printed to PDF by the browser.
function exportFramesPDF() {
  showMenu.value = false;
  const instance = editor.value;
  if (!instance) return;
  const frames = instance.frames.list();
  if (frames.length === 0) return;
  const images = frames.map((_, i) => instance.frames.toDataURL(i, { pixelRatio: 2 }));
  const landscape = frames.filter((f) => f.rect.w >= f.rect.h).length >= frames.length / 2;
  const page = window.open('', '_blank');
  if (!page) {
    showAIToast('⚠️ Allow pop-ups to export a PDF.');
    return;
  }
  page.document.write(`<!doctype html><title>Frames</title><style>
    @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 0 }
    body { margin: 0 }
    img { display: block; width: 100vw; height: 100vh; object-fit: contain; page-break-after: always; break-after: page }
  </style>${images.map((src) => `<img src="${src}">`).join('')}`);
  page.document.close();
  page.addEventListener('load', () => page.print());
  setTimeout(() => page.print(), 600);
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
  const { Editor, Color4, StickyNote: StickyNoteClass, TextComponent: TextComponentClass } = await import('easydrawer');

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
  // For debugging and browser tests in development.
  if (import.meta.env.DEV) (window as any).__editor = instance;

  loadRecentColors();

  // Restore the previous drawing and keep saving it.
  cleanups.push(await instance.autosave({ key: 'easydrawer-playground' }));

  // Ctrl/⌘+K while the drawing has focus: AI command palette (elsewhere, the docs search).
  const onCommandShortcut = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && container.value?.contains(document.activeElement)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openCommand();
    }
  };
  window.addEventListener('keydown', onCommandShortcut, true);
  cleanups.push(() => window.removeEventListener('keydown', onCommandShortcut, true));

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (presenting.value !== null) {
      const step = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, Enter: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[event.key];
      if (step) {
        nextSlide(step);
      } else if (event.key === 'Escape') {
        stopPresentation();
      } else if (event.key === 'Home') {
        void showSlide(0);
      } else if (event.key === 'End') {
        void showSlide(Infinity);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key === '?') {
      showHelp.value = !showHelp.value;
    } else if (event.key === 'Escape') {
      showHelp.value = false;
    }
  };
  window.addEventListener('keydown', onKeyDown, true);
  cleanups.push(() => window.removeEventListener('keydown', onKeyDown, true));

  // Presenting: keep the slide fitted to the screen, and stop when leaving fullscreen.
  const onResize = () => {
    if (presenting.value !== null) setTimeout(() => presenting.value !== null && void showSlide(presenting.value), 120);
  };
  const onFullscreenChange = () => {
    if (!document.fullscreenElement && presenting.value !== null) presenting.value = null;
    onResize();
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  cleanups.push(() => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
  });

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
      frameCount.value = instance.frames.list().length;
    }),
    instance.onZoomChange((value) => (zoom.value = value)),
    instance.selection.onChange((items) => {
      selectionCount.value = items.length;
      selectionHasNote.value = items.some((item) => item instanceof StickyNoteClass);
      selectionHasDiagram.value = items.length > 0 && instance.ai.readDiagram(items) !== null;
      selectionHasTopic.value = items.some((item) => item instanceof StickyNoteClass || item instanceof TextComponentClass);
      selectionHasMindMap.value = items.some((item) => item.getMetadata().mindmap !== undefined);
      selectionUnits.value = new Set(items.map((item) => item.getGroupId() ?? item.getId())).size;
      selectionHasGroups.value = instance.selection.hasGroups;
      if (items.length === 0) {
        showAlign.value = false;
        showQuickAI.value = false;
      }
      lockedCount.value = instance.selection.lockedCount;
      // After Vue has updated the toolbar's buttons (its width depends on them).
      void nextTick(updateQuickBar);
    }),
  );

  // Hide the floating toolbar while dragging (e.g. moving the selection).
  const onPointerDown = () => {
    pointerDown.value = true;
    showMenu.value = false;
  };
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

function setBackgroundType(type: BackgroundTypeName) {
  background.value = type;
  editor.value?.setBackground({ type });
}

// Tools with options in the flyout next to the rail
const toolsWithOptions: ToolName[] = ['pen', 'highlighter', 'select', 'shape', 'sticky', 'connector', 'laser'];
const hasToolOptions = computed(() => !!activeTool.value && toolsWithOptions.includes(activeTool.value));
const activeToolTitle = computed(() => tools.find((tool) => tool.name === activeTool.value)?.title ?? '');

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
  <div ref="root" class="playground" :class="{ presenting: presenting !== null }">
    <div ref="container" class="playground-canvas" />

    <!-- Tools: a rail on the left (a bar at the bottom on phones) -->
    <nav class="rail" aria-label="Tools">
      <button
        v-for="tool in tools"
        :key="tool.name"
        class="tool"
        :class="{ active: activeTool === tool.name }"
        :title="`${tool.title}${tool.key ? ` (${tool.key})` : ''}`"
        :aria-label="tool.title"
        :aria-pressed="activeTool === tool.name"
        @click="toggleTool(tool.name)"
      >
        <svg viewBox="0 0 24 24"><path :d="icons[tool.name]" /></svg>
      </button>

      <span class="sep" />

      <button class="tool" title="Undo (Ctrl/⌘ Z)" aria-label="Undo" :disabled="!canUndo" @click="editor?.undo()">
        <svg viewBox="0 0 24 24"><path :d="icons.undo" /></svg>
      </button>
      <button class="tool" title="Redo (Ctrl/⌘ Shift Z)" aria-label="Redo" :disabled="!canRedo" @click="editor?.redo()">
        <svg viewBox="0 0 24 24"><path :d="icons.redo" /></svg>
      </button>
      <button
        class="tool"
        :class="{ active: showMenu }"
        title="More: background, images, open & save"
        aria-label="More"
        :aria-expanded="showMenu"
        @click="showMenu = !showMenu"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.more" /></svg>
      </button>

      <span class="sep" />

      <button
        class="tool ai-button"
        :class="{ active: showAI }"
        title="AI: diagrams, charts, pictures, code → diagram"
        aria-label="AI"
        :aria-expanded="showAI"
        @click="showAI = !showAI"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.ai" /></svg>
      </button>
    </nav>

    <!-- Options of the active tool, next to the rail -->
    <div v-if="hasToolOptions && !showMenu" class="flyout" role="group" :aria-label="`${activeToolTitle} options`">
      <template v-if="currentPen">
        <div class="swatches">
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
          <label class="swatch custom" title="Custom color">
            <input
              type="color"
              aria-label="Custom color"
              @input="updatePen({ color: ($event.target as HTMLInputElement).value })"
            >
          </label>
          <button
            class="tool small"
            title="Pick a color from the drawing (I)"
            aria-label="Pick a color from the drawing"
            @click="editor?.tools.use('eyedropper')"
          >
            <svg viewBox="0 0 24 24"><path :d="icons.eyedropper" /></svg>
          </button>
        </div>
        <label class="slider">
          <span>Size</span>
          <input
            type="range"
            min="1"
            :max="activeTool === 'pen' ? 16 : 48"
            step="0.5"
            :value="currentPen.thickness"
            @input="updatePen({ thickness: Number(($event.target as HTMLInputElement).value) })"
          >
        </label>
        <div class="chips">
          <button
            v-for="item in penStyles"
            :key="item.style"
            :class="{ active: currentPen.style === item.style }"
            @click="updatePen({ style: item.style })"
          >
            {{ item.label }}
          </button>
        </div>
      </template>

      <template v-else-if="activeTool === 'select'">
        <div class="chips">
          <button :class="{ active: selectMode === 'rectangle' }" @click="setSelectMode('rectangle')">Rectangle</button>
          <button :class="{ active: selectMode === 'lasso' }" @click="setSelectMode('lasso')">Lasso</button>
        </div>
        <button v-if="lockedCount > 0" class="text-button" @click="unlockAll">
          <svg viewBox="0 0 24 24"><path :d="icons.unlock" /></svg>
          Unlock {{ lockedCount }} locked
        </button>
      </template>

      <template v-else-if="activeTool === 'shape'">
        <div class="shape-grid">
          <button
            v-for="shape in shapeNames"
            :key="shape"
            :class="{ active: shapeState.shape === shape }"
            :title="shape"
            @click="updateShape({ shape })"
          >
            {{ shape }}
          </button>
        </div>
        <span class="label">Fill</span>
        <div class="swatches">
          <button
            v-for="color in ['transparent', ...inkColors]"
            :key="`fill-${color}`"
            class="swatch"
            :style="{ background: color }"
            :aria-label="`Fill ${color}`"
            @click="updateShape({ color })"
          />
        </div>
        <span class="label">Border</span>
        <div class="swatches">
          <button
            v-for="color in inkColors"
            :key="`border-${color}`"
            class="swatch"
            :style="{ background: color }"
            :aria-label="`Border ${color}`"
            @click="updateShape({ borderColor: color })"
          />
        </div>
        <label class="slider">
          <span>Border</span>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            :value="shapeState.thickness"
            @input="updateShape({ thickness: Number(($event.target as HTMLInputElement).value) })"
          >
        </label>
      </template>

      <template v-else-if="activeTool === 'sticky'">
        <span class="label">Note color</span>
        <div class="swatches">
          <button
            v-for="color in noteColors"
            :key="color"
            class="swatch"
            :class="{ active: stickyColor === color }"
            :style="{ background: color }"
            :aria-label="`Note ${color}`"
            @click="setStickyColor(color)"
          />
        </div>
        <p class="hint">Click to add a note, click a note to edit it.</p>
      </template>

      <template v-else-if="activeTool === 'connector'">
        <div class="swatches">
          <button
            v-for="color in inkColors"
            :key="`connector-${color}`"
            class="swatch"
            :class="{ active: connectorState.color === color }"
            :style="{ background: color }"
            :aria-label="color"
            @click="updateConnector({ color })"
          />
        </div>
        <div class="chips">
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
        <div class="chips">
          <button :class="{ active: connectorState.routing === 'straight' }" @click="updateConnector({ routing: 'straight' })">
            Straight
          </button>
          <button :class="{ active: connectorState.routing === 'elbow' }" @click="updateConnector({ routing: 'elbow' })">
            Elbow
          </button>
        </div>
        <p class="hint">Drag from one shape to another — the arrow follows them.</p>
      </template>

      <template v-else-if="activeTool === 'laser'">
        <p class="hint">Point at things — the trail fades away and is never saved.</p>
      </template>
    </div>

    <!-- ⋯ menu -->
    <div v-if="showMenu" class="flyout menu" role="menu" aria-label="More">
      <span class="label">Background</span>
      <div class="chips">
        <button
          v-for="type in (['none', 'solid', 'grid', 'dot'] as const)"
          :key="type"
          :class="{ active: background === type }"
          @click="setBackgroundType(type)"
        >
          {{ type }}
        </button>
      </div>
      <div v-if="background !== 'none'" class="swatches">
        <button
          v-for="color in backgroundColors"
          :key="color"
          class="swatch"
          :style="{ background: color }"
          :aria-label="`Background ${color}`"
          @click="editor?.setBackground({ color })"
        />
      </div>
      <span class="sep-h" />
      <button class="menu-item" role="menuitem" @click="imageInput?.click()">
        <svg viewBox="0 0 24 24"><path :d="icons.image" /></svg> Insert image
      </button>
      <button class="menu-item" role="menuitem" @click="svgInput?.click()">
        <svg viewBox="0 0 24 24"><path :d="icons.open" /></svg> Open SVG
      </button>
      <button class="menu-item" role="menuitem" @click="saveSvg">
        <svg viewBox="0 0 24 24"><path :d="icons.save" /></svg> Save as SVG
      </button>
      <button class="menu-item" role="menuitem" @click="savePng">
        <svg viewBox="0 0 24 24"><path :d="icons.save" /></svg> Save as PNG
      </button>
      <button class="menu-item" role="menuitem" @click="copyMermaid(); showMenu = false">
        <svg viewBox="0 0 24 24"><path :d="icons.mermaid" /></svg> Copy diagram as Mermaid
      </button>
      <span class="sep-h" />
      <span class="label">Frames · slides</span>
      <button class="menu-item" role="menuitem" @click="addFrame">
        <svg viewBox="0 0 24 24"><path :d="icons.frame" /></svg> Add frame (this view)
      </button>
      <button class="menu-item" role="menuitem" :disabled="selectionCount === 0" @click="frameSelection">
        <svg viewBox="0 0 24 24"><path :d="icons.frame" /></svg> Frame the selection
      </button>
      <button class="menu-item" role="menuitem" :disabled="frameCount === 0" @click="startPresentation">
        <svg viewBox="0 0 24 24"><path :d="icons.play" /></svg> Present{{ frameCount > 0 ? ` (${frameCount})` : '' }}
      </button>
      <button class="menu-item" role="menuitem" :disabled="frameCount === 0" @click="exportFramesPDF">
        <svg viewBox="0 0 24 24"><path :d="icons.save" /></svg> Frames → PDF
      </button>
      <span class="sep-h" />
      <button class="menu-item" role="menuitem" @click="cycleStylusOnly">
        <svg viewBox="0 0 24 24"><path :d="icons.pen" /></svg>
        Fingers: <b>{{ stylusOnly === 'auto' ? 'auto' : stylusOnly ? 'pan only' : 'draw' }}</b>
      </button>
      <button class="menu-item" role="menuitem" @click="showHelp = true; showMenu = false">
        <svg viewBox="0 0 24 24"><path :d="icons.help" /></svg> Keyboard shortcuts
      </button>
      <button class="menu-item danger" role="menuitem" aria-label="Clear" @click="editor?.clear(); showMenu = false">
        <svg viewBox="0 0 24 24"><path :d="icons.clear" /></svg> Clear drawing
      </button>
    </div>

    <!-- AI panel (right side; a bottom sheet on phones) -->
    <aside v-if="showAI" class="ai-panel" aria-label="AI">
      <header class="ai-header">
        <b>✨ AI</b>
        <button class="tool small" aria-label="Close AI panel" @click="showAI = false">✕</button>
      </header>
      <div class="chips ai-modes" role="tablist">
        <button
          v-for="mode in aiModes"
          :key="mode.id"
          role="tab"
          :aria-selected="aiMode === mode.id"
          :class="{ active: aiMode === mode.id }"
          @click="aiMode = mode.id; aiMessage = null"
        >
          {{ mode.label }}
        </button>
      </div>
      <form class="ai-form" @submit.prevent="runAI(currentAIMode.action)">
        <textarea
          v-model="aiPrompt"
          :rows="aiMode === 'code' || aiMode === 'mermaid' ? 8 : 3"
          :class="{ code: aiMode === 'code' || aiMode === 'mermaid' }"
          :placeholder="currentAIMode.placeholder"
          :disabled="!!aiBusy"
          @keydown.enter.exact="aiMode !== 'code' && aiMode !== 'mermaid' && ($event.preventDefault(), runAI(currentAIMode.action))"
        />
        <div class="ai-actions">
          <button type="submit" class="ai-primary" :disabled="!!aiBusy">
            {{ aiBusy === currentAIMode.action ? 'Working…' : currentAIMode.button }}
          </button>
          <button v-if="aiBusy" type="button" @click="cancelAI">Cancel</button>
        </div>
      </form>
      <div class="ai-examples">
        <button
          v-for="example in currentAIMode.examples"
          :key="example"
          type="button"
          :disabled="!!aiBusy"
          @click="aiPrompt = example"
        >
          {{ example.length > 60 ? `${example.slice(0, 58)}…` : example }}
        </button>
      </div>
      <p v-if="aiMessage" class="ai-message" :class="aiMessage.kind">{{ aiMessage.text }}</p>

      <div class="ai-section">
        <span class="label">With the selection</span>
        <button class="text-button" :disabled="!!aiBusy || !selectionHasDiagram" @click="runAI('edit')">
          ✏️ {{ aiBusy === 'edit' ? 'Editing…' : 'Edit selected diagram (uses the text above)' }}
        </button>
        <button class="text-button" :disabled="!!aiBusy || !selectionHasMindMap" @click="runAI('expand')">
          🌿 {{ aiBusy === 'expand' ? 'Growing…' : 'Grow the selected mind map topic' }}
        </button>
        <button class="text-button" :disabled="!!aiBusy" @click="copyMermaid">
          🧜 Copy {{ selectionHasDiagram ? 'selected diagram' : 'diagram' }} as Mermaid
        </button>
        <button class="text-button" :disabled="!!aiBusy || !selectionHasTopic" @click="runAI('brainstorm')">
          💡 {{ aiBusy === 'brainstorm' ? 'Thinking…' : 'Brainstorm around the selected note' }}
        </button>
        <button class="text-button" :disabled="!!aiBusy" @click="runAI('organize')">
          🗂️ {{ aiBusy === 'organize' ? 'Organizing…' : 'Organize sticky notes by theme' }}
        </button>
      </div>
      <p class="ai-tip">
        <button type="button" class="link" @click="openCommand">Ask anything</button>
        with <kbd>Ctrl/⌘ K</kbd> — "color the notes about marketing in blue"…
      </p>
    </aside>

    <input ref="svgInput" type="file" accept="image/svg+xml" hidden @change="onSvgSelected">
    <input ref="imageInput" type="file" accept="image/*" multiple hidden @change="onImagesSelected">

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
      <button
        class="tool ai-quick"
        :class="{ active: showQuickAI }"
        title="Change the selection with AI"
        aria-label="Change the selection with AI"
        @click="toggleQuickAI"
      >
        <svg viewBox="0 0 24 24"><path :d="icons.ai" /></svg>
      </button>
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
      <form v-if="showQuickAI" class="quick-row quick-ai" @submit.prevent="runAI('selection')">
        <input
          ref="quickAIInput"
          v-model="quickAIText"
          :placeholder="selectionHasDiagram ? 'Add, change or remove steps… e.g. “add a payment step”' : 'What should AI do with the selection?'"
          :disabled="aiBusy === 'selection'"
          @keydown.esc="showQuickAI = false"
        >
        <button v-if="aiBusy === 'selection'" type="button" @click="cancelAI">Cancel</button>
        <button v-else type="submit">Go</button>
      </form>
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

    <!-- Presentation: click or arrow keys for the next frame, Esc to stop -->
    <template v-if="presenting !== null">
      <div class="present-overlay" @click="nextSlide(1)" />
      <div class="present-controls" role="toolbar" aria-label="Presentation">
        <button aria-label="Previous slide" :disabled="presenting === 0" @click="nextSlide(-1)">‹</button>
        <span>{{ presenting + 1 }} / {{ frameCount }}</span>
        <button aria-label="Next slide" @click="nextSlide(1)">›</button>
        <button aria-label="Stop presenting" @click="stopPresentation">✕</button>
      </div>
    </template>

    <div v-if="showCommand" class="command-backdrop" @click.self="showCommand = false">
      <form class="command" @submit.prevent="runAI('command')">
        <div class="command-row">
          <span class="command-icon">✨</span>
          <input
            ref="commandInput"
            v-model="commandText"
            placeholder="Ask AI to do something with the board…"
            :disabled="aiBusy === 'command'"
            @keydown.esc="showCommand = false"
          >
          <button v-if="aiBusy === 'command'" type="button" @click="cancelAI">Cancel</button>
          <button v-else type="submit">Run</button>
        </div>
        <p v-if="aiBusy === 'command'" class="command-status">Thinking…</p>
        <div v-else class="command-examples">
          <button v-for="example in commandExamples" :key="example" type="button" @click="commandText = example">
            {{ example }}
          </button>
        </div>
      </form>
    </div>

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

/* Shared panel look */
.rail,
.flyout,
.ai-panel {
  position: absolute;
  z-index: 10;
  box-sizing: border-box;
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Tool rail on the left */
.rail {
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border-radius: 14px;
  max-height: calc(100% - 24px);
  overflow-y: auto;
  scrollbar-width: none;
}

.tool {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  color: inherit;
  touch-action: manipulation;
}

.tool.small {
  width: 30px;
  height: 30px;
}

.tool svg,
.menu-item svg,
.text-button svg {
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
  .tool:not(:disabled):hover,
  .menu-item:hover,
  .text-button:not(:disabled):hover {
    background: #f3f4f6;
  }
}

.tool.active,
.chips button.active,
.shape-grid button.active {
  background: #e8eefc;
  color: #1d4ed8;
}

.rail .ai-button {
  color: #4f46e5;
}

.rail .ai-button.active {
  background: #eef2ff;
}

.sep {
  flex-shrink: 0;
  width: 22px;
  height: 1px;
  margin: 4px auto;
  background: #e5e7eb;
}

.sep-h {
  display: block;
  height: 1px;
  margin: 2px 0;
  background: #f3f4f6;
}

/* Options of the active tool, and the ⋯ menu: next to the rail */
.flyout {
  left: 70px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 232px;
  max-height: calc(100% - 24px);
  overflow-y: auto;
  padding: 12px;
  border-radius: 14px;
}

.flyout.menu {
  gap: 4px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #d1d5db;
  background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%);
  touch-action: manipulation;
}

.swatch.active {
  box-shadow: 0 0 0 2px #2563eb;
}

.swatch.custom {
  position: relative;
  overflow: hidden;
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  cursor: pointer;
}

.swatch.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.slider {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.slider input {
  flex: 1;
  min-width: 0;
}

.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #9ca3af;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chips button,
.shape-grid button {
  padding: 5px 9px;
  border-radius: 7px;
  background: #f3f4f6;
  font-size: 12px;
  text-transform: capitalize;
  touch-action: manipulation;
}

.shape-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.shape-grid button {
  padding: 6px 2px;
  font-size: 11px;
}

.text-button,
.menu-item {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 7px 8px;
  border-radius: 8px;
  font-size: 13px;
  text-align: left;
  touch-action: manipulation;
}

.text-button:disabled {
  opacity: 0.45;
}

.menu-item.danger {
  color: #dc2626;
}

/* AI panel on the right */
.ai-panel {
  top: 12px;
  right: 12px;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 48px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 340px;
  padding: 12px;
  overflow-y: auto;
  border-radius: 14px;
  user-select: auto;
  -webkit-user-select: auto;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
}

.ai-modes button {
  flex: 1 0 28%;
  text-transform: none;
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

.ai-form textarea.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre;
}

.ai-actions,
.ai-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ai-actions button {
  padding: 7px 12px;
  border-radius: 8px;
  background: #f3f4f6;
  font-size: 13px;
  touch-action: manipulation;
}

.ai-actions .ai-primary {
  flex: 1;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
}

.ai-actions button:disabled,
.ai-examples button:disabled {
  opacity: 0.6;
}

.ai-examples button {
  padding: 5px 9px;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  text-align: left;
}

.ai-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.ai-tip {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.ai-tip .link {
  color: #4f46e5;
  text-decoration: underline;
}

.ai-tip kbd,
.command kbd {
  padding: 1px 5px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
}

.command-backdrop {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 18vh;
  background: rgba(15, 23, 42, 0.2);
}

.command {
  width: min(620px, calc(100% - 32px));
  padding: 10px;
  border-radius: 14px;
  background: #fff;
  color: #1f2937;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
}

.command-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.command-row input {
  flex: 1;
  min-width: 0;
  padding: 10px 8px;
  border: none;
  outline: none;
  font: inherit;
  font-size: 16px;
}

.command-row button {
  padding: 8px 14px;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
}

.command-icon {
  font-size: 18px;
}

.command-status {
  margin: 8px 8px 2px;
  font-size: 13px;
  color: #6b7280;
}

.command-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.command-examples button {
  padding: 5px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
}

.playground.presenting > :not(.playground-canvas, .present-overlay, .present-controls) {
  display: none !important;
}

.playground.presenting {
  height: 100dvh;
}

.present-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  cursor: pointer;
}

.present-controls {
  position: absolute;
  left: 50%;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 4px);
  transform: translateX(-50%);
  z-index: 31;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(31, 41, 55, 0.85);
  color: #fff;
  font-size: 13px;
  opacity: 0.35;
  transition: opacity 0.2s;
}

.present-controls:hover,
.present-controls:focus-within {
  opacity: 1;
}

.present-controls button {
  min-width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}

.present-controls button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.present-controls button:disabled {
  opacity: 0.4;
}

.menu-item:disabled {
  opacity: 0.45;
  cursor: default;
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

.quick-ai input {
  flex: 1;
  min-width: 260px;
  padding: 6px 8px;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  outline: none;
}

.quick-ai button {
  padding: 6px 12px;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.quick-bar .ai-quick {
  color: #4f46e5;
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
    width: 32px;
    height: 32px;
  }

  .chips button,
  .shape-grid button {
    padding: 9px 12px;
    font-size: 14px;
  }

  .quick-bar .swatch.small {
    width: 30px;
    height: 30px;
  }

  .quick-bar .tool {
    width: 44px;
    height: 44px;
  }
}

/* Phones: tools at the bottom, panels above them */
@media (max-width: 640px) {
  .rail {
    top: auto;
    left: 8px;
    right: 8px;
    bottom: max(8px, env(safe-area-inset-bottom));
    transform: none;
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .sep {
    width: 1px;
    height: 22px;
    margin: auto 4px;
  }

  .flyout {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: calc(max(8px, env(safe-area-inset-bottom)) + 66px);
    transform: none;
    width: auto;
    max-height: 45vh;
  }

  .ai-panel {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: calc(max(8px, env(safe-area-inset-bottom)) + 66px);
    width: auto;
    max-height: 60vh;
  }

  .zoom-controls {
    top: 8px;
    bottom: auto;
    left: 8px;
  }
}
</style>
