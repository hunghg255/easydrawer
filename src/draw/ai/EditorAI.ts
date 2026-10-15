import { Color4, type IVec2, Mat33, Path, Rect2, Vec2 } from '~/math';

import buildChart, { type Chart, validateChart } from './charts';
import layoutGraph from './layoutGraph';
import { diagramToMermaid, parseMermaid } from './mermaid';
import layoutMindMap, { type MindMapNode, validateMindMap } from './mindMap';
import parseAIJSON, { parsePartialAIJSON } from './parseJSON';
import svgToStrokes from './svgToStrokes';
import { AIError, type AIMessage, type AIRequestHandler } from './types';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import type AbstractComponent from '../components/AbstractComponent';
import Connector from '../components/Connector';
import ImageComponent from '../components/ImageComponent';
import StickyNote from '../components/StickyNote';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import { type RouteSide } from '../components/util/routeOrthogonal';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import type RenderablePathSpec from '../rendering/RenderablePathSpec';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import { newSketchSeed, sketchParts, sketchSourceOf, type SketchOptions } from '../rendering/sketch';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';

/** Colors the AI can choose for diagram nodes and note groups. */
export type AIColorName = 'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'gray';
/**
 * Kinds of diagram nodes. `'entity'` is a box with a title and a list of `details` (e.g. a
 * database table and its columns, or a class and its members).
 */
export type DiagramNodeKind = 'process' | 'decision' | 'terminal' | 'io' | 'entity';

export interface DiagramNode {
  id: string;
  label: string;
  kind: DiagramNodeKind;
  color?: AIColorName;
  /** For `'entity'` nodes: lines below the title (columns, fields, methods…). */
  details?: string[];
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Diagram {
  direction: 'down' | 'right';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** What {@link EditorAI.runCommand} did. */
export interface AICommandResult {
  /** The AI's reply (e.g. the answer to a question). */
  message: string;
  /** The actions that were run, e.g. `['select', 'setColor']`. */
  actions: string[];
}

export interface NoteGroup {
  title: string;
  color: AIColorName;
  notes: StickyNote[];
}

interface AIOptions {
  signal?: AbortSignal;
  /**
   * Draw the answer step by step while it arrives, if the request handler streams it
   * (see `AIRequest.onText`). Default: `true`.
   */
  stream?: boolean;
}

const colorNames: AIColorName[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'gray'];
const nodeKinds: DiagramNodeKind[] = ['process', 'decision', 'terminal', 'io', 'entity'];

const shapeColors: Record<AIColorName, { fill: string; border: string }> = {
  blue: { fill: '#dbeafe', border: '#1d4ed8' },
  green: { fill: '#dcfce7', border: '#15803d' },
  yellow: { fill: '#fef3c7', border: '#b45309' },
  pink: { fill: '#fce7f3', border: '#be185d' },
  purple: { fill: '#ede9fe', border: '#6d28d9' },
  gray: { fill: '#f3f4f6', border: '#4b5563' },
};

const mindMapColors: AIColorName[] = ['blue', 'green', 'yellow', 'pink', 'purple'];

const noteColors: Record<AIColorName, string> = {
  yellow: '#fde68a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
  gray: '#e5e7eb',
};

const defaultKindColors: Record<DiagramNodeKind, AIColorName> = {
  terminal: 'green',
  process: 'blue',
  decision: 'yellow',
  io: 'purple',
  entity: 'blue',
};

const diagramPrompt = `You convert descriptions into diagrams (flowcharts, processes, architectures, mind maps).
Answer with ONE JSON object and nothing else:
{"direction":"down","nodes":[{"id":"n1","label":"Start","kind":"terminal","color":"green"}],"edges":[{"from":"n1","to":"n2","label":""}]}
Rules:
- "kind": "terminal" (start/end), "process" (a step or a thing), "decision" (a question or condition), "io" (input/output, data),
  "entity" (a box with a title and "details": a list of lines, e.g. a table and its columns).
- "color": one of ${colorNames.join(', ')}. Optional.
- Edges leaving a decision have short labels (e.g. "yes"/"no"). Other edge labels are usually empty.
- "direction": "right" for timelines and short pipelines, otherwise "down".
- At most 25 nodes. Labels are short (at most 6 words), in the same language as the description.`;

const codeDiagramPrompt = `You turn source code or SQL into a diagram.
Answer with ONE JSON object and nothing else:
{"direction":"right","nodes":[{"id":"users","label":"users","kind":"entity","details":["id: int PK","email: text"]}],"edges":[{"from":"orders","to":"users","label":"user_id"}]}
Choose the diagram from the input:
- SQL (CREATE TABLE, schemas): an entity-relationship diagram. One "entity" node per table, "label" = table name,
  "details" = its columns as "name: type" with PK / FK. One edge per foreign key, from the table with the key to the
  referenced table, "label" = the key column. "direction": "right".
- Classes, interfaces, structs, types: a class diagram. One "entity" node per class, "details" = fields
  ("+ name: type") then methods ("+ name(): type"). Edges for inheritance ("extends"/"implements") and use ("uses").
  "direction": "down".
- Other code (functions, scripts, handlers): a flowchart of its logic with "kind" "terminal" (start/end),
  "process", "decision" (conditions, labeled edges "yes"/"no"…) and "io" (input/output, calls to other systems).
  "direction": "down".
At most 25 nodes. Short labels.`;

const chartPrompt = `You turn data or a description into a chart.
Answer with ONE JSON object and nothing else:
{"type":"bar","title":"Revenue 2024","unit":"","labels":["Q1","Q2","Q3","Q4"],"series":[{"name":"Revenue","values":[10,20,15,30]}]}
Rules:
- "type": "pie" for parts of a whole, "line" for a trend over time, otherwise "bar".
- One value per label in each series. Numbers only (no units in values; put the unit in "unit", e.g. "%", "k$").
- Use the numbers given. Without numbers, use realistic example numbers.
- Title, labels and series names in the same language as the request.`;

const illustrationPrompt = `You draw simple, clean, flat vector illustrations and icons.
Answer with ONLY an SVG document and nothing else, like:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">…</svg>
Rules:
- Use only <path>, <circle>, <ellipse>, <rect>, <line>, <polyline>, <polygon> and <g>, with fill and stroke colors.
- Friendly flat style, a few harmonious colors, at most 60 elements.
- No text, gradients, filters, images, masks, CSS or scripts.`;

const editDiagramPrompt = `${diagramPrompt}
You are EDITING an existing diagram: answer with the complete updated diagram.
Keep the ids, labels, kinds, colors and "details" of the nodes that should not change.`;

const mindMapPrompt = `You make mind maps.
Answer with ONE JSON object and nothing else:
{"label":"Central topic","children":[{"label":"Branch","children":[{"label":"Sub-topic"}]}]}
Rules:
- 4 to 7 branches, each with 2 to 4 sub-topics. A third level only when it really helps.
- Labels are short (at most 5 words), in the same language as the request.`;

const expandMindMapPrompt = `You extend a mind map.
Answer with ONE JSON object and nothing else: {"children":["first sub-topic","second sub-topic"]}
Give short (at most 5 words), concrete and varied sub-topics of the LAST topic of the path, different from the
existing ones, in the same language as the topics.`;

const brainstormPrompt = `You help people brainstorm.
Answer with ONE JSON object and nothing else: {"ideas":["first idea","second idea"]}
Give short, concrete and varied ideas (at most 12 words each), in the same language as the topic.`;

const commandPrompt = `You control a whiteboard app. Turn the user's request into actions.
Answer with ONE JSON object and nothing else: {"actions":[{"type":"select","ids":["s1"]}],"message":"Done!"}
Actions (most of them apply to the selected items):
{"type":"select","ids":["s1","s2"]} select items, by their ids in the scene
{"type":"setColor","color":"#2563eb"} any CSS color
{"type":"align","edge":"left|center|right|top|middle|bottom"}
{"type":"distribute","direction":"horizontal|vertical"}
{"type":"bringToFront"} {"type":"sendToBack"} {"type":"group"} {"type":"ungroup"}
{"type":"lock"} {"type":"duplicate"} {"type":"delete"}
{"type":"addNote","text":"...","color":"yellow|green|blue|pink|purple|gray"}
{"type":"generateDiagram","prompt":"description of a new diagram"}
{"type":"editDiagram","instruction":"what to change in the selected diagram"}
{"type":"mindMap","topic":"the central topic, with any details"} draw a new mind map
{"type":"expandMindMap"} add sub-topics to the selected mind map topic
{"type":"brainstorm"} ideas around the selected sticky note
{"type":"organizeNotes"} sort sticky notes into themed columns
For questions about the board, use no actions and answer in "message".
"message" is short, in the language of the request.`;

const organizePrompt = `You organize brainstorming sticky notes into groups by theme.
Answer with ONE JSON object and nothing else:
{"groups":[{"title":"Short title","color":"blue","notes":["n1","n4"]}]}
Rules:
- 2 to 7 groups. Every note is in exactly one group.
- "color": one of ${colorNames.join(', ')}, different for each group.
- Titles have at most 4 words, in the same language as the notes.`;

function oneOf<T extends string> (value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function shortText (value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/** Checks and cleans up a diagram returned by an AI. @internal */
export function validateDiagram (json: any): Diagram {
  const rawNodes: any[] = Array.isArray(json?.nodes) ? json.nodes.slice(0, 40) : [];
  const nodes: DiagramNode[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of rawNodes.entries()) {
    let id = shortText(raw?.id, 40) || `node-${i}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    nodes.push({
      id,
      label: shortText(raw?.label ?? raw?.text, 80) || '…',
      kind: oneOf(raw?.kind ?? raw?.type, nodeKinds, 'process'),
      color: raw?.color ? oneOf(raw.color, colorNames, 'blue') : undefined,
      ...(Array.isArray(raw?.details)
        ? { details: raw.details.slice(0, 24).map((d: unknown) => shortText(d, 60)).filter((d: string) => d !== '') }
        : {}),
    });
  }
  if (nodes.length === 0) {
    throw new AIError('The AI did not return any diagram nodes.');
  }

  const rawEdges: any[] = Array.isArray(json?.edges) ? json.edges.slice(0, 80) : [];
  const edges: DiagramEdge[] = rawEdges
    .map((raw) => ({
      from: shortText(raw?.from ?? raw?.source, 40),
      to: shortText(raw?.to ?? raw?.target, 40),
      label: shortText(raw?.label, 30) || undefined,
    }))
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to);

  return { direction: json?.direction === 'right' ? 'right' : 'down', nodes, edges };
}

/**
 * The two ends of a hand-drawn arrow or line (from the points of its path): the points
 * furthest apart. The head is the end with the most points around it (the arrowhead). @internal
 */
export function arrowEnds (points: IVec2[]): [tail: IVec2, head: IVec2] {
  const sample = points.length > 200 ? points.filter((_, i) => i % Math.ceil(points.length / 200) === 0) : points;
  let a = sample[0];
  let b = sample[sample.length - 1];
  let longest = -1;
  for (const p of sample) {
    for (const q of sample) {
      const d = Vec2.ofXY(p).distanceTo(q);
      if (d > longest) {
        longest = d;
        a = p;
        b = q;
      }
    }
  }
  const radius = longest * 0.25;
  const near = (end: IVec2) => sample.filter((p) => Vec2.ofXY(p).distanceTo(end) < radius).length;
  return near(a) > near(b) ? [b, a] : [a, b];
}

/** Wraps `text` into lines at most `maxWidth` wide. */
function wrapText (text: string, style: TextRenderingStyle, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && TextComponent.measureTextWidth(candidate, style) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/**
 * Chooses which side of their shapes the arrows of a laid-out diagram leave from and arrive at,
 * like in a hand-made flowchart: forward arrows go from the bottom to the top (or right to left),
 * the branches of a node with several arrows leave from different sides, and arrows going back
 * leave and arrive on the side. @internal
 */
export function assignSides (diagram: Diagram, positions: Map<string, { x: number; y: number }>) {
  const down = diagram.direction === 'down';
  const along = (id: string) => (down ? positions.get(id)!.x : positions.get(id)!.y);
  const across = (id: string) => (down ? positions.get(id)!.y : positions.get(id)!.x);
  const exit: RouteSide = down ? 'bottom' : 'right';
  const entry: RouteSide = down ? 'top' : 'left';
  const low: RouteSide = down ? 'left' : 'top';
  const high: RouteSide = down ? 'right' : 'bottom';
  const mean = diagram.nodes.reduce((sum, n) => sum + along(n.id), 0) / diagram.nodes.length;

  const result: Array<{ start?: RouteSide; end?: RouteSide }> = diagram.edges.map(() => ({}));
  const usedExits = new Map<string, Set<RouteSide>>();
  const useExit = (node: string, side: RouteSide) => {
    const used = usedExits.get(node) ?? new Set();
    usedExits.set(node, used);
    if (used.has(side)) return undefined;
    used.add(side);
    return side;
  };

  // Forward arrows: branches spread over the sides, by where their targets are.
  for (const node of diagram.nodes) {
    const forward = diagram.edges
      .map((edge, i) => ({ edge, i }))
      .filter(({ edge }) => edge.from === node.id && across(edge.to) > across(edge.from));
    for (const { edge, i } of forward) {
      let side: RouteSide = exit;
      if (forward.length > 1) {
        const delta = along(edge.to) - along(edge.from);
        side = delta < -1 ? low : delta > 1 ? high : exit;
      }
      result[i] = { start: useExit(node.id, side), end: entry };
    }
  }

  // Arrows going back (or sideways): around the side.
  for (const [i, edge] of diagram.edges.entries()) {
    if (across(edge.to) > across(edge.from)) continue;
    const side = along(edge.from) <= mean ? low : high;
    result[i] = { start: useExit(edge.from, side), end: side };
  }

  return result;
}

/** The outline of a diagram node centered on (0, 0). */
function nodePath (kind: DiagramNodeKind, w: number, h: number): Path {
  const x = -w / 2;
  const y = -h / 2;
  const rounded = (r: number) =>
    `M${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} ` +
    `Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} ` +
    `L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;

  switch (kind) {
    case 'decision':
      return Path.fromString(`M0,${y} L${x + w},0 L0,${y + h} L${x},0 Z`);
    case 'terminal':
      return Path.fromString(rounded(h / 2));
    case 'io': {
      const slant = h * 0.3;
      return Path.fromString(`M${x + slant},${y} L${x + w},${y} L${x + w - slant},${y + h} L${x},${y + h} Z`);
    }
    default:
      return Path.fromString(rounded(Math.min(10, h / 4)));
  }
}

/**
 * AI features. Available as `editor.ai`, once a request handler is given with the
 * `ai` setting (or {@link setRequestHandler}).
 *
 * Every change made by the AI is one step in the undo history.
 */
export default class EditorAI {
  private requestHandler: AIRequestHandler | null;

  public constructor(private editor: Editor) {
    this.requestHandler = editor.getCurrentSettings().ai?.request ?? null;
  }

  /**
   * Draws diagrams, mind maps and brainstorm links in a hand-drawn style (like Excalidraw):
   * `true`, sketch options, or `null` for clean lines (the default).
   */
  public sketch: SketchOptions | null = null;

  /** Font of the text of diagrams, mind maps and note titles. Default: `'sans-serif'`. */
  public fontFamily = 'sans-serif';

  public setSketch(sketch: SketchOptions | boolean | null) {
    this.sketch = sketch === true ? {} : sketch || null;
  }

  // A shape, hand-drawn if `sketch` is set (filled with a solid color, so that text stays readable).
  private shapeStroke(parts: RenderablePathSpec[]) {
    if (!this.sketch) return new Stroke(parts);
    const options = { fillStyle: 'solid' as const, ...this.sketch, scale: this.editor.viewport.getSizeOfPixelOnCanvas(), seed: newSketchSeed() };
    const stroke = new Stroke(sketchParts(parts, options));
    // To draw it again when it's resized (see Stroke).
    stroke.setMetadata({ sketch: '1', sketchSource: sketchSourceOf(parts, options) });
    return stroke;
  }

  /** Whether a request handler has been given. */
  public get isConfigured() {
    return this.requestHandler !== null;
  }

  public setRequestHandler(handler: AIRequestHandler | null) {
    this.requestHandler = handler;
  }

  /** Sends `messages` to the AI and returns the text of its answer. */
  public async requestText(messages: AIMessage[], options: AIOptions = {}): Promise<string> {
    if (!this.requestHandler) {
      throw new AIError('AI is not configured: give a request handler with the "ai" editor setting.');
    }
    try {
      return await this.requestHandler({ messages, json: false, signal: options.signal });
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`AI request failed: ${(error as Error)?.message ?? error}`, error);
    }
  }

  /** Sends `messages` to the AI and returns the JSON object of its answer. */
  public async requestJSON(
    messages: AIMessage[],
    options: AIOptions & { onText?: (textSoFar: string) => void } = {},
  ): Promise<any> {
    if (!this.requestHandler) {
      throw new AIError('AI is not configured: give a request handler with the "ai" editor setting.');
    }

    let answer: string;
    try {
      answer = await this.requestHandler({ messages, json: true, signal: options.signal, onText: options.onText });
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`AI request failed: ${(error as Error)?.message ?? error}`, error);
    }
    return parseAIJSON(answer);
  }

  /**
   * Like {@link requestJSON}, but while the answer arrives (if the request handler streams
   * it), shows what `build` makes of the complete part of it so far: `read` checks it (and
   * throws if it can't be used yet). The preview isn't part of the drawing or of the undo
   * history, and is removed at the end.
   */
  private async requestJSONWithPreview<T>(
    messages: AIMessage[],
    options: AIOptions,
    read: (json: any) => T,
    build: (value: T, ignore: Set<AbstractComponent>) => AbstractComponent[],
  ): Promise<any> {
    if (options.stream === false) return this.requestJSON(messages, options);

    const editor = this.editor;
    let shown: Command[] = [];
    let shownComponents = new Set<AbstractComponent>();
    let latestText = '';
    let lastKey = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const clear = () => {
      for (const command of shown.reverse()) command.unapply(editor);
      shown = [];
      shownComponents = new Set();
      editor.queueRerender();
    };
    const update = () => {
      timer = null;
      if (done) return;
      const json = parsePartialAIJSON(latestText);
      if (!json) return;
      let value: T;
      try {
        value = read(json);
      } catch {
        return;
      }
      const key = JSON.stringify(value);
      if (key === lastKey) return;
      lastKey = key;

      const components = build(value, shownComponents);
      clear();
      shown = components.map((component) => EditorImage.addComponent(component));
      for (const command of shown) command.apply(editor);
      shownComponents = new Set(components);
      editor.queueRerender();
    };

    try {
      return await this.requestJSON(messages, {
        ...options,
        onText: (text) => {
          latestText = text;
          // Not too often: building and drawing take a moment.
          timer ??= setTimeout(update, 120);
        },
      });
    } finally {
      done = true;
      if (timer) clearTimeout(timer);
      clear();
    }
  }

  /**
   * A compact description of the drawing for prompts: notes, texts, shapes, images and
   * connectors with their positions. Freehand strokes are summarized.
   */
  public describeScene(components: AbstractComponent[] = this.editor.image.getAllComponents()) {
    const round = (n: number) => Math.round(n);
    const items: Array<Record<string, unknown>> = [];
    let strokeCount = 0;

    for (const component of components.slice(0, 300)) {
      const b = component.getBBox();
      const base = { id: component.getId(), box: [round(b.x), round(b.y), round(b.w), round(b.h)] };
      if (component instanceof StickyNote) {
        items.push({ ...base, type: 'note', text: component.getText() });
      } else if (component instanceof TextComponent) {
        items.push({ ...base, type: 'text', text: component.getText() });
      } else if (component instanceof Connector) {
        const start = component.getStart();
        const end = component.getEnd();
        items.push({ id: base.id, type: 'arrow', from: start.targetId, to: end.targetId, label: component.getLabel() || undefined });
      } else if (component instanceof ImageComponent) {
        items.push({ ...base, type: 'image' });
      } else if (component instanceof Stroke) {
        strokeCount++;
      }
    }

    return { items, freehandStrokes: strokeCount };
  }

  /**
   * Asks the AI for a diagram described by `prompt` (e.g. "the steps of a login flow")
   * and draws it in the middle of the screen: shapes with text, and connectors that stay
   * attached to them. The new items are selected.
   *
   * @returns the diagram as returned by the AI (after validation).
   */
  public async generateDiagram(prompt: string, options: AIOptions = {}): Promise<Diagram> {
    const json = await this.requestJSONWithPreview(
      [
        { role: 'system', content: diagramPrompt },
        { role: 'user', content: prompt.slice(0, 4000) },
      ],
      options,
      validateDiagram,
      (diagram, ignore) => this.buildDiagram(diagram, this.editor.viewport.visibleRect.center, ignore),
    );
    const diagram = validateDiagram(json);
    await this.drawDiagram(diagram);
    return diagram;
  }

  /**
   * Draws a diagram (as returned by {@link generateDiagram}), by default in the middle of the
   * screen.
   */
  public async drawDiagram(diagram: Diagram, options: { center?: IVec2 } = {}) {
    // Next to what is already drawn, rather than on top of it.
    const created = this.buildDiagram(diagram, options.center ?? this.editor.viewport.visibleRect.center, new Set());
    await this.addAndShow(created);
  }

  // Creates the components of a diagram centered on `center` (not added to the image).
  private buildDiagram(diagram: Diagram, preferredCenter: IVec2, ignore: Set<AbstractComponent>): AbstractComponent[] {
    const editor = this.editor;
    const scale = editor.viewport.getSizeOfPixelOnCanvas();
    const textStyle: TextRenderingStyle = {
      size: 15 * scale,
      fontFamily: this.fontFamily,
      renderingStyle: { fill: Color4.fromHex('#1f2937') },
    };
    const lineHeight = textStyle.size * 1.25;

    const titleStyle: TextRenderingStyle = { ...textStyle, fontWeight: 'bold' };
    const detailStyle: TextRenderingStyle = { ...textStyle, size: 13 * scale, fontFamily: 'monospace' };
    const headerHeight = 36 * scale;
    const detailHeight = 18 * scale;

    // Sizes
    const sized = diagram.nodes.map((node) => {
      if (node.kind === 'entity') {
        const details = node.details ?? [];
        const width = Math.max(
          160 * scale,
          TextComponent.measureTextWidth(node.label, titleStyle) + 36 * scale,
          ...details.map((d) => TextComponent.measureTextWidth(d, detailStyle) + 28 * scale),
        );
        const height = headerHeight + (details.length > 0 ? details.length * detailHeight + 14 * scale : 0);
        return { node, lines: [node.label], width, height };
      }
      const lines = wrapText(node.label, textStyle, 170 * scale);
      const textWidth = Math.max(...lines.map((line) => TextComponent.measureTextWidth(line, textStyle)));
      let width = Math.max(130 * scale, textWidth + 36 * scale);
      let height = Math.max(54 * scale, lines.length * lineHeight + 26 * scale);
      if (node.kind === 'decision') {
        width *= 1.5;
        height *= 1.5;
      } else if (node.kind === 'io') {
        width += height * 0.6;
      }
      return { node, lines, width, height };
    });

    const positions = layoutGraph(
      sized.map(({ node, width, height }) => ({ id: node.id, width, height })),
      diagram.edges,
      { direction: diagram.direction, nodeGap: 70 * scale, layerGap: 80 * scale },
    );
    const layoutBox = Rect2.union(
      ...sized.map(({ node, width, height }) => {
        const p = positions.get(node.id)!;
        return new Rect2(p.x - width / 2, p.y - height / 2, width, height);
      }),
    );
    const center = this.findFreeSpot(layoutBox, preferredCenter, ignore);
    const created: AbstractComponent[] = [];
    const shapeById = new Map<string, Stroke>();
    for (const { node, lines, width, height } of sized) {
      const position = positions.get(node.id)!;
      const nodeCenter = Vec2.of(center.x + position.x, center.y + position.y);
      const colors = shapeColors[node.color ?? defaultKindColors[node.kind]];

      const shape = this.shapeStroke([
        pathToRenderable(nodePath(node.kind === 'entity' ? 'process' : node.kind, width, height).transformedBy(Mat33.translation(nodeCenter)), {
          fill: Color4.fromHex(colors.fill),
          stroke: { color: Color4.fromHex(colors.border), width: 2 * scale },
        }),
      ]);
      const groupId = `group-${shape.getId()}`;
      shape.setGroupDirectly(groupId);
      shape.setMetadata({
        ...shape.getMetadata(),
        diagramNode: node.id,
        kind: node.kind,
        direction: diagram.direction,
        ...(node.color ? { color: node.color } : {}),
      });
      shapeById.set(node.id, shape);
      created.push(shape);

      if (node.kind === 'entity') {
        // Title, a line, and the details below it.
        const top = nodeCenter.y - height / 2;
        const left = nodeCenter.x - width / 2;
        const titleWidth = TextComponent.measureTextWidth(node.label, titleStyle);
        const title = TextComponent.fromLines(
          [node.label],
          Mat33.translation(Vec2.of(nodeCenter.x - titleWidth / 2, top + headerHeight / 2 + titleStyle.size * 0.35)),
          titleStyle,
        );
        title.setGroupDirectly(groupId);
        created.push(title);

        const details = node.details ?? [];
        if (details.length > 0) {
          const separator = this.shapeStroke([
            pathToRenderable(Path.fromString(`M${left},${top + headerHeight} L${left + width},${top + headerHeight}`), {
              fill: Color4.transparent,
              stroke: { color: Color4.fromHex(colors.border), width: 1.5 * scale },
            }),
          ]);
          separator.setGroupDirectly(groupId);
          created.push(separator);
        }
        for (const [i, detail] of details.entries()) {
          const line = TextComponent.fromLines(
            [detail],
            Mat33.translation(Vec2.of(left + 14 * scale, top + headerHeight + 7 * scale + (i + 1) * detailHeight - 4 * scale)),
            detailStyle,
          );
          line.setGroupDirectly(groupId);
          created.push(line);
        }
        continue;
      }

      // Centered lines of text
      const textTop = nodeCenter.y - (lines.length * lineHeight) / 2;
      for (const [i, line] of lines.entries()) {
        const lineWidth = TextComponent.measureTextWidth(line, textStyle);
        const baseline = textTop + (i + 1) * lineHeight - (lineHeight - textStyle.size) / 2 - textStyle.size * 0.18;
        const text = TextComponent.fromLines(
          [line],
          Mat33.translation(Vec2.of(nodeCenter.x - lineWidth / 2, baseline)),
          textStyle,
        );
        text.setGroupDirectly(groupId);
        created.push(text);
      }
    }

    const sides = assignSides(diagram, positions);
    for (const [i, edge] of diagram.edges.entries()) {
      const from = shapeById.get(edge.from)!;
      const to = shapeById.get(edge.to)!;
      const connector = new Connector(
        { point: from.getBBox().center, targetId: from.getId(), side: sides[i].start },
        { point: to.getBBox().center, targetId: to.getId(), side: sides[i].end },
        { color: Color4.fromHex('#374151'), thickness: 2 * scale, arrow: 'end', label: edge.label, routing: 'elbow', sketch: !!this.sketch },
      );
      created.push(connector);
    }

    return created;
  }

  /**
   * Where to put something of size `box` (relative to its center) so that it doesn't
   * cover what is already drawn (except `ignore`): `preferred` if possible, otherwise the
   * closest free spot around it.
   */
  private findFreeSpot(box: Rect2, preferred: IVec2, ignore: Set<AbstractComponent>): IVec2 {
    const image = this.editor.image;
    const margin = 40 * this.editor.viewport.getSizeOfPixelOnCanvas();
    const isFree = (center: IVec2) => {
      const area = box.translatedBy(Vec2.ofXY(center)).grownBy(margin);
      return !image.getComponentsIntersecting(area).some((c) => !ignore.has(c) && c.isSelectable());
    };
    if (isFree(preferred)) return preferred;

    // Try positions on rings around the preferred one, closest first.
    const step = Vec2.of((box.w + margin) / 2, (box.h + margin) / 2);
    for (let ring = 1; ring <= 8; ring++) {
      const candidates: IVec2[] = [];
      for (let i = -ring; i <= ring; i++) {
        for (let j = -ring; j <= ring; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          candidates.push(Vec2.ofXY(preferred).plus(Vec2.of(i * step.x, j * step.y)));
        }
      }
      candidates.sort((a, b) => a.distanceTo(preferred) - b.distanceTo(preferred));
      const free = candidates.find(isFree);
      if (free) return free;
    }

    // Right of everything.
    const all = image.getAllComponents().filter((c) => !ignore.has(c));
    if (all.length === 0) return preferred;
    const content = Rect2.union(...all.map((c) => c.getBBox()));
    return Vec2.of(content.x + content.w + margin + box.w / 2, Vec2.ofXY(preferred).y);
  }

  // Adds new components in one undoable step, selects them and makes sure they're visible.
  private async addAndShow(
    components: AbstractComponent[],
    extraCommands: Command[] = [],
    alsoSelect: AbstractComponent[] = [],
    commandsBefore: Command[] = [],
  ) {
    const editor = this.editor;
    const commands = [...commandsBefore, ...components.map((c) => EditorImage.addComponent(c)), ...extraCommands];
    await editor.dispatch(uniteCommands(commands));

    const selection = [...components, ...alsoSelect];
    editor.selection.set(selection);

    const bbox = Rect2.union(...selection.map((c) => c.getBBox()));
    if (!editor.viewport.visibleRect.containsRect(bbox)) {
      await editor.dispatchNoAnnounce(editor.viewport.zoomTo(bbox.grownBy(bbox.maxDimension * 0.15)), false);
    }
  }

  /**
   * Draws a [Mermaid](https://mermaid.js.org) diagram (`flowchart`/`graph`, `erDiagram` or
   * `classDiagram`) with editable shapes and connectors. No AI needed.
   *
   * @throws `MermaidError` if the text can't be read.
   * @returns the diagram that was drawn.
   */
  public async drawMermaid(text: string, options: { center?: IVec2 } = {}): Promise<Diagram> {
    const diagram = parseMermaid(text);
    await this.drawDiagram(diagram, options);
    return diagram;
  }

  /**
   * The selected diagram (or the whole drawing) as [Mermaid](https://mermaid.js.org) text, or
   * `null` if there is no diagram. See {@link readDiagram}.
   */
  public toMermaid(components?: AbstractComponent[]): string | null {
    const result = this.readDiagram(components);
    return result ? diagramToMermaid(result.diagram) : null;
  }

  /**
   * Asks the AI for a mind map about `topic` and draws it: the topic in the middle, colored
   * branches on both sides. Select a topic and use {@link expandMindMap} to grow it.
   */
  public async generateMindMap(topic: string, options: AIOptions = {}): Promise<MindMapNode> {
    const json = await this.requestJSONWithPreview(
      [
        { role: 'system', content: mindMapPrompt },
        { role: 'user', content: topic.slice(0, 4000) },
      ],
      options,
      validateMindMap,
      (mindMap, ignore) => this.buildMindMap(mindMap, this.editor.viewport.visibleRect.center, ignore),
    );
    const mindMap = validateMindMap(json);
    await this.drawMindMap(mindMap);
    return mindMap;
  }

  /** Draws a mind map (as returned by {@link generateMindMap}) next to what is already drawn. */
  public async drawMindMap(mindMap: MindMapNode, options: { center?: IVec2 } = {}) {
    await this.addAndShow(this.buildMindMap(mindMap, options.center ?? this.editor.viewport.visibleRect.center, new Set()));
  }

  // Creates the components of a mind map (not added to the image).
  private buildMindMap(mindMap: MindMapNode, preferredCenter: IVec2, ignore: Set<AbstractComponent>) {
    const editor = this.editor;
    const scale = editor.viewport.getSizeOfPixelOnCanvas();
    const layout = layoutMindMap(mindMap, (node, depth) => this.mindMapNodeSize(node.label, depth), {
      levelGap: 56 * scale,
      siblingGap: 14 * scale,
    });

    const box = Rect2.union(...layout.map((n) => new Rect2(n.x - n.width / 2, n.y - n.height / 2, n.width, n.height)));
    const center = this.findFreeSpot(box, preferredCenter, ignore);
    const offset = Vec2.ofXY(center);

    const created: AbstractComponent[] = [];
    const shapes: Stroke[] = [];
    for (const placed of layout) {
      const color = mindMapColors[(placed.branch + mindMapColors.length) % mindMapColors.length];
      const { components, shape } = this.buildMindMapNode(placed.node.label, placed.depth, offset.plus(Vec2.of(placed.x, placed.y)), color, placed.side);
      created.push(...components);
      shapes.push(shape);
      if (placed.parent >= 0) {
        created.push(this.mindMapLink(shapes[placed.parent], shape, color, placed.depth));
      }
    }
    return created;
  }

  /**
   * Asks the AI for sub-topics of the selected mind map topic (drawn by {@link drawMindMap})
   * and adds them next to it.
   *
   * @returns the shapes of the new topics.
   */
  public async expandMindMap(options: AIOptions & { count?: number } = {}): Promise<Stroke[]> {
    const editor = this.editor;
    const image = editor.image;
    const all = image.getAllComponents();
    const isTopic = (c: AbstractComponent): c is Stroke => c instanceof Stroke && c.getMetadata().mindmap !== undefined;

    // The selected topic (its shape, or its text).
    let topic: Stroke | undefined;
    for (const item of editor.selection.items) {
      if (isTopic(item)) {
        topic = item;
        break;
      }
      const groupId = item.getGroupId();
      topic ??= groupId === null ? undefined : all.find((c): c is Stroke => isTopic(c) && c.getGroupId() === groupId);
    }
    if (!topic) {
      throw new AIError('Select a topic of a mind map first.');
    }

    const labelOf = (shape: Stroke) => {
      const groupId = shape.getGroupId();
      return all
        .filter((c): c is TextComponent => c instanceof TextComponent && groupId !== null && c.getGroupId() === groupId)
        .map((t) => t.getText())
        .join(' ');
    };
    const links = all.filter((c): c is Connector => c instanceof Connector);
    const parentOf = (shape: Stroke) => {
      const link = links.find((l) => l.getEnd().targetId === shape.getId());
      const parent = link ? image.lookupElement(link.getStart().targetId ?? '') : null;
      return parent && isTopic(parent) ? parent : null;
    };
    const childrenOf = (shape: Stroke) =>
      links
        .filter((l) => l.getStart().targetId === shape.getId())
        .map((l) => image.lookupElement(l.getEnd().targetId ?? ''))
        .filter((c): c is Stroke => c !== null && isTopic(c));

    const path: string[] = [];
    for (let node: Stroke | null = topic; node && path.length < 8; node = parentOf(node)) {
      path.unshift(labelOf(node));
    }
    const existing = childrenOf(topic);
    const count = Math.min(Math.max(options.count ?? 4, 1), 8);
    const json = await this.requestJSON(
      [
        { role: 'system', content: expandMindMapPrompt },
        {
          role: 'user',
          content:
            `Path: ${path.join(' > ').slice(0, 1000)}\n` +
            (existing.length > 0 ? `Existing sub-topics: ${existing.map(labelOf).join('; ').slice(0, 1000)}\n` : '') +
            `Give ${count} sub-topics.`,
        },
      ],
      options,
    );
    const labels: string[] = (Array.isArray(json?.children) ? json.children : Array.isArray(json?.ideas) ? json.ideas : [])
      .map((child: any) => shortText(typeof child === 'string' ? child : child?.label, 80))
      .filter((label: string) => label !== '')
      .slice(0, count);
    if (labels.length === 0) {
      throw new AIError('The AI did not return any sub-topics.');
    }

    // Rebuild the tree of the whole mind map from the board, add the new topics, and lay it out
    // again around its central topic (which doesn't move).
    let root = topic;
    for (let parent = parentOf(root), i = 0; parent && parent !== topic && i < 50; parent = parentOf(parent), i++) root = parent;
    const rootDepth = Number(root.getMetadata().mindmap) || 0;
    // The size of a screen pixel when the mind map was drawn.
    const mapScale = (root.getBBox().h / this.mindMapNodeSize(labelOf(root), rootDepth, 1).height) || this.editor.viewport.getSizeOfPixelOnCanvas();

    type TreeNode = MindMapNode & { shape?: Stroke; children: TreeNode[] };
    const visited = new Set<Stroke>();
    const treeOf = (shape: Stroke): TreeNode => {
      visited.add(shape);
      const children = childrenOf(shape)
        .filter((child) => !visited.has(child))
        .sort((a, b) => a.getBBox().center.y - b.getBBox().center.y)
        .map(treeOf);
      const side = shape.getMetadata().side;
      return { label: labelOf(shape), shape, children, ...(side === 'left' || side === 'right' ? { side } : {}) };
    };
    const tree = treeOf(root);
    const findNode = (node: TreeNode): TreeNode | undefined => node.shape === topic ? node : node.children.map(findNode).find((n) => n);
    const target = findNode(tree)!;

    const rootSide = root.getMetadata().side === 'left' ? 'left' : 'right';
    const newNodes: TreeNode[] = labels.map((label) => ({ label, children: [] }));
    if (target === tree) {
      // New branches go to the side with fewer topics.
      const weight = (node: MindMapNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + weight(child), 0);
      for (const node of newNodes) {
        const right = tree.children.filter((c) => (c.side ?? rootSide) === 'right').reduce((sum, c) => sum + weight(c), 0);
        const left = tree.children.filter((c) => (c.side ?? rootSide) === 'left').reduce((sum, c) => sum + weight(c), 0);
        node.side = rootDepth > 0 ? rootSide : right <= left ? 'right' : 'left';
        tree.children.push(node);
      }
    } else {
      target.children.push(...newNodes);
    }
    // A detached part of a mind map stays on its side.
    if (rootDepth > 0) {
      for (const branch of tree.children) branch.side = rootSide;
    }

    const layout = layoutMindMap(
      tree,
      (node, d) => {
        const shape = (node as TreeNode).shape;
        return shape ? { width: shape.getBBox().w, height: shape.getBBox().h } : this.mindMapNodeSize(node.label, d + rootDepth, mapScale);
      },
      { levelGap: 56 * mapScale, siblingGap: 14 * mapScale },
    );

    const origin = root.getBBox().center;
    const moves: Command[] = [];
    const created: AbstractComponent[] = [];
    const shapes = new Map<MindMapNode, Stroke>();
    const colorOf = new Map<MindMapNode, AIColorName>();
    const nextBranchColor = () =>
      mindMapColors[(tree.children.length - newNodes.length + created.filter((c) => c instanceof Connector).length) % mindMapColors.length];
    for (const placed of layout) {
      const node = placed.node as TreeNode;
      const center = origin.plus(Vec2.of(placed.x, placed.y));
      if (node.shape) {
        shapes.set(node, node.shape);
        colorOf.set(node, oneOf(node.shape.getMetadata().color, colorNames, 'blue'));
        const delta = center.minus(node.shape.getBBox().center);
        if (delta.magnitude() > 1e-6 * mapScale) {
          const groupId = node.shape.getGroupId();
          const parts = groupId === null ? [node.shape] : all.filter((c) => c.getGroupId() === groupId);
          moves.push(...parts.map((part) => part.transformBy(Mat33.translation(delta))));
        }
        continue;
      }
      const parent = layout[placed.parent].node;
      const color = placed.depth + rootDepth === 1 ? nextBranchColor() : (colorOf.get(parent) ?? 'blue');
      colorOf.set(node, color);
      const { components, shape } = this.buildMindMapNode(node.label, placed.depth + rootDepth, center, color, placed.side, mapScale);
      created.push(...components, this.mindMapLink(shapes.get(parent)!, shape, color, placed.depth + rootDepth, mapScale));
      shapes.set(node, shape);
    }

    await this.addAndShow(created, [], [], moves);
    return newNodes.map((node) => shapes.get(node)!);
  }

  private mindMapNodeSize(label: string, depth: number, scale = this.editor.viewport.getSizeOfPixelOnCanvas()) {
    const style = this.mindMapTextStyle(depth, scale);
    const lines = wrapText(label, style, (depth === 0 ? 300 : 190) * scale);
    const textWidth = Math.max(...lines.map((line) => TextComponent.measureTextWidth(line, style)));
    const padding = (depth === 0 ? 26 : depth === 1 ? 18 : 12) * scale;
    return {
      width: textWidth + padding * 2,
      height: lines.length * style.size * 1.25 + padding * (depth === 0 ? 1.1 : 0.9),
    };
  }

  private mindMapTextStyle(depth: number, scale: number): TextRenderingStyle {
    return {
      size: (depth === 0 ? 22 : depth === 1 ? 17 : 15) * scale,
      fontFamily: this.fontFamily,
      ...(depth <= 1 ? { fontWeight: 'bold' } : {}),
      renderingStyle: { fill: Color4.fromHex(depth === 0 ? '#ffffff' : '#1f2937') },
    };
  }

  // A topic: a rounded box with its text, grouped.
  private buildMindMapNode(
    label: string,
    depth: number,
    center: IVec2,
    color: AIColorName,
    side: number,
    scale = this.editor.viewport.getSizeOfPixelOnCanvas(),
  ) {
    const style = this.mindMapTextStyle(depth, scale);
    const { width, height } = this.mindMapNodeSize(label, depth, scale);
    const colors = shapeColors[color];
    const fill = depth === 0 ? '#1e293b' : depth === 1 ? colors.fill : '#ffffff';
    const border = depth === 0 ? '#1e293b' : colors.border;
    const shape = this.shapeStroke([
      pathToRenderable(nodePath(depth === 0 ? 'terminal' : 'process', width, height).transformedBy(Mat33.translation(center)), {
        fill: Color4.fromHex(fill),
        stroke: { color: Color4.fromHex(border), width: (depth <= 1 ? 2.5 : 1.5) * scale },
      }),
    ]);
    const groupId = `group-${shape.getId()}`;
    shape.setGroupDirectly(groupId);
    shape.setMetadata({ ...shape.getMetadata(), mindmap: String(depth), color, ...(side !== 0 ? { side: side < 0 ? 'left' : 'right' } : {}) });

    const components: AbstractComponent[] = [shape];
    const lines = wrapText(label, style, (depth === 0 ? 300 : 190) * scale);
    const lineHeight = style.size * 1.25;
    const textTop = center.y - (lines.length * lineHeight) / 2;
    for (const [i, line] of lines.entries()) {
      const lineWidth = TextComponent.measureTextWidth(line, style);
      const baseline = textTop + (i + 1) * lineHeight - (lineHeight - style.size) / 2 - style.size * 0.18;
      const text = TextComponent.fromLines([line], Mat33.translation(Vec2.of(center.x - lineWidth / 2, baseline)), style);
      text.setGroupDirectly(groupId);
      components.push(text);
    }
    return { components, shape };
  }

  private mindMapLink(from: Stroke, to: Stroke, color: AIColorName, depth: number, scale = this.editor.viewport.getSizeOfPixelOnCanvas()) {
    return new Connector(
      { point: from.getBBox().center, targetId: from.getId() },
      { point: to.getBBox().center, targetId: to.getId() },
      { color: Color4.fromHex(shapeColors[color].border), thickness: (depth === 1 ? 3 : 2) * scale, arrow: 'none', sketch: !!this.sketch },
    );
  }

  /**
   * Turns source code or SQL into a diagram: an entity-relationship diagram for SQL tables,
   * a class diagram for classes and types, or a flowchart of the logic for other code.
   */
  public async diagramFromCode(code: string, options: AIOptions = {}): Promise<Diagram> {
    const json = await this.requestJSONWithPreview(
      [
        { role: 'system', content: codeDiagramPrompt },
        { role: 'user', content: code.slice(0, 12000) },
      ],
      options,
      validateDiagram,
      (diagram, ignore) => this.buildDiagram(diagram, this.editor.viewport.visibleRect.center, ignore),
    );
    const diagram = validateDiagram(json);
    await this.drawDiagram(diagram);
    return diagram;
  }

  /**
   * Asks the AI for a chart (bar, line or pie) of the data or description in `prompt`
   * (e.g. "revenue Q1–Q4: 10, 20, 15, 30", or pasted table data) and draws it.
   */
  public async generateChart(prompt: string, options: AIOptions = {}): Promise<Chart> {
    const json = await this.requestJSONWithPreview(
      [
        { role: 'system', content: chartPrompt },
        { role: 'user', content: prompt.slice(0, 8000) },
      ],
      options,
      validateChart,
      (chart, ignore) => this.buildChartComponents(chart, ignore),
    );
    const chart = validateChart(json);
    await this.drawChart(chart);
    return chart;
  }

  /**
   * Draws a chart (as returned by {@link generateChart}) next to what is already drawn.
   * The chart is made of normal shapes and text, grouped.
   */
  public async drawChart(chart: Chart) {
    await this.addAndShow(this.buildChartComponents(chart, new Set()));
  }

  // Creates the components of a chart, grouped (not added to the image).
  private buildChartComponents(chart: Chart, ignore: Set<AbstractComponent>) {
    const editor = this.editor;
    const scale = editor.viewport.getSizeOfPixelOnCanvas();
    const { size } = buildChart(chart, Vec2.zero, scale);
    const box = new Rect2(-size.x / 2, -size.y / 2, size.x, size.y);
    const center = this.findFreeSpot(box, editor.viewport.visibleRect.center, ignore);
    const { components } = buildChart(chart, Vec2.ofXY(center).minus(size.times(0.5)), scale);

    const groupId = `group-${components[0]?.getId()}`;
    for (const component of components) {
      component.setGroupDirectly(groupId);
    }
    components[0]?.setMetadata({ chart: chart.type });
    return components;
  }

  /**
   * Asks the AI to draw an illustration or icon described by `prompt` (e.g. "a cat reading a
   * book", "database icon"), as editable shapes, next to what is already drawn.
   *
   * @returns the new strokes.
   */
  public async generateIllustration(prompt: string, options: AIOptions & { size?: number } = {}): Promise<Stroke[]> {
    const answer = await this.requestText(
      [
        { role: 'system', content: illustrationPrompt },
        { role: 'user', content: prompt.slice(0, 2000) },
      ],
      options,
    );
    const svg = answer.match(/<svg[\S\s]*<\/svg>/i)?.[0];
    if (!svg) {
      throw new AIError('The AI answer does not contain an SVG image.');
    }

    const strokes = svgToStrokes(svg).slice(0, 400);
    if (strokes.length === 0) {
      throw new AIError('The SVG from the AI has nothing that can be drawn.');
    }

    // Scale to `size` screen pixels, next to the rest of the drawing.
    const editor = this.editor;
    const bbox = Rect2.union(...strokes.map((s) => s.getBBox()));
    const targetSize = (options.size ?? 260) * editor.viewport.getSizeOfPixelOnCanvas();
    const factor = targetSize / Math.max(bbox.w, bbox.h, 1e-6);
    const box = new Rect2((-bbox.w * factor) / 2, (-bbox.h * factor) / 2, bbox.w * factor, bbox.h * factor);
    const center = this.findFreeSpot(box, editor.viewport.visibleRect.center, new Set());
    const transform = Mat33.translation(Vec2.ofXY(center))
      .rightMul(Mat33.scaling2D(factor))
      .rightMul(Mat33.translation(bbox.center.times(-1)));

    const placed = strokes.map((stroke) => stroke.transformedPreview(transform) as Stroke);
    const groupId = `group-${placed[0].getId()}`;
    for (const stroke of placed) {
      stroke.setGroupDirectly(groupId);
    }
    placed[0].setMetadata({ illustration: prompt.slice(0, 80) });
    await this.addAndShow(placed);
    return placed;
  }

  /**
   * Reads a diagram from `components` (by default the selection, or everything): diagrams
   * drawn by {@link drawDiagram}, and hand-made ones — shapes with text inside, sticky notes,
   * connectors, and arrows/lines drawn between two shapes.
   *
   * @returns the diagram, and the components it is made of, or `null` if there is none.
   */
  public readDiagram(components?: AbstractComponent[]): { diagram: Diagram; parts: AbstractComponent[] } | null {
    const image = this.editor.image;
    const all = image.getAllComponents();
    let candidates = components ?? this.editor.selection.items;
    if (candidates.length === 0) candidates = all;
    const candidateSet = new Set(candidates);

    const connectors = all.filter((c): c is Connector => c instanceof Connector);
    const connectedIds = new Set(connectors.flatMap((c) => [c.getStart().targetId, c.getEnd().targetId]));
    const strokes = candidates.filter((c): c is Stroke => c instanceof Stroke);
    const texts = candidates.filter((c): c is TextComponent => c instanceof TextComponent);

    // Texts inside a shape (same group, or drawn on top of it) are its label.
    const labelsOf = new Map<Stroke, TextComponent[]>();
    const usedTexts = new Set<TextComponent>();
    for (const stroke of strokes) {
      const groupId = stroke.getGroupId();
      const box = stroke.getBBox();
      const inside = (groupId ? all : texts).filter(
        (c): c is TextComponent =>
          c instanceof TextComponent &&
          !usedTexts.has(c) &&
          ((groupId !== null && c.getGroupId() === groupId) || box.containsPoint(c.getBBox().center)),
      );
      inside.sort((a, b) => a.getBBox().y - b.getBBox().y || a.getBBox().x - b.getBBox().x);
      labelsOf.set(stroke, inside);
      for (const text of inside) usedTexts.add(text);
    }

    // Nodes: shapes made by drawDiagram, shapes with text or attached connectors, notes, and
    // texts with attached connectors. Other strokes may be hand-drawn arrows (see below).
    type NodeSource = {
      component: AbstractComponent;
      label: string;
      details?: string[];
      meta: Readonly<Record<string, string>>;
    };
    const sources: NodeSource[] = [];
    const nodeOf = new Map<AbstractComponent, number>();
    const addNode = (component: AbstractComponent, label: string, details?: string[]) => {
      nodeOf.set(component, sources.length);
      sources.push({ component, label, details, meta: component.getMetadata() });
    };
    for (const stroke of strokes) {
      const labels = labelsOf.get(stroke)!;
      if (stroke.getMetadata().diagramNode || labels.length > 0 || connectedIds.has(stroke.getId())) {
        if (stroke.getMetadata().kind === 'entity') {
          // Title, then one text per detail line.
          addNode(stroke, labels[0]?.getText() ?? '', labels.slice(1).map((t) => t.getText()));
        } else {
          addNode(stroke, labels.map((t) => t.getText()).join(' '));
        }
        for (const label of labels) nodeOf.set(label, nodeOf.get(stroke)!);
      }
    }
    for (const component of candidates) {
      if (component instanceof StickyNote) {
        addNode(component, component.getText());
      } else if (component instanceof TextComponent && !usedTexts.has(component) && connectedIds.has(component.getId())) {
        addNode(component, component.getText());
      }
    }
    if (sources.length === 0) return null;

    const parts = new Set<AbstractComponent>(nodeOf.keys());
    // Everything grouped with a node (e.g. the line under the title of an entity) is part of it.
    const nodeGroups = new Set<string | null>(sources.map((s) => s.component.getGroupId()).filter((g) => g !== null));
    for (const component of all) {
      if (component.getGroupId() !== null && nodeGroups.has(component.getGroupId()) && !(component instanceof Connector)) {
        parts.add(component);
      }
    }
    const edges: DiagramEdge[] = [];
    const edgeKeys = new Set<string>();
    const addEdge = (from: number | undefined, to: number | undefined, label?: string) => {
      if (from === undefined || to === undefined || from === to) return false;
      const key = `${from}>${to}`;
      if (edgeKeys.has(key)) return true;
      edgeKeys.add(key);
      edges.push({ from: `n${from + 1}`, to: `n${to + 1}`, label: label || undefined });
      return true;
    };

    for (const connector of connectors) {
      const from = image.lookupElement(connector.getStart().targetId ?? '');
      const to = image.lookupElement(connector.getEnd().targetId ?? '');
      if (from && to && addEdge(nodeOf.get(from), nodeOf.get(to), connector.getLabel())) {
        parts.add(connector);
      }
    }

    // Hand-drawn arrows and lines: strokes whose two ends touch two different nodes.
    const nodeBoxes = sources.map((s) => s.component.getBBox());
    const tolerance = 24 * this.editor.viewport.getSizeOfPixelOnCanvas();
    const nodeNear = (point: IVec2) => {
      let best = -1;
      let bestDistance = tolerance;
      for (const [i, box] of nodeBoxes.entries()) {
        const distance = box.containsPoint(point) ? 0 : box.signedDistance(point);
        if (distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      }
      return best === -1 ? undefined : best;
    };
    for (const stroke of strokes) {
      if (nodeOf.has(stroke)) continue;
      const points = stroke.getParts().flatMap((part) => [part.startPoint, ...part.commands.map((c) => ('endPoint' in c ? c.endPoint : c.point))]);
      if (points.length < 2) continue;
      const [tail, head] = arrowEnds(points);
      if (addEdge(nodeNear(tail), nodeNear(head))) {
        parts.add(stroke);
      }
    }

    const nodes: DiagramNode[] = sources.map(({ label, details, meta }, i) => ({
      id: `n${i + 1}`,
      label: shortText(label, 80) || '…',
      kind: oneOf(meta.kind, nodeKinds, label.trim().endsWith('?') ? 'decision' : 'process'),
      color: meta.color ? oneOf(meta.color, colorNames, 'blue') : undefined,
      ...(details ? { details } : {}),
    }));

    // Direction: from the metadata, or from how the nodes are laid out.
    let direction: Diagram['direction'] = sources[0].meta.direction === 'right' ? 'right' : 'down';
    if (!sources[0].meta.direction && edges.length > 0) {
      let dx = 0;
      let dy = 0;
      for (const edge of edges) {
        const a = nodeBoxes[Number(edge.from.slice(1)) - 1].center;
        const b = nodeBoxes[Number(edge.to.slice(1)) - 1].center;
        dx += Math.abs(b.x - a.x);
        dy += Math.abs(b.y - a.y);
      }
      direction = dx > dy ? 'right' : 'down';
    }

    // Keep everything that was selected with the diagram (e.g. decorations) out of `parts`:
    // only what the diagram is made of is replaced.
    return {
      diagram: { direction, nodes, edges },
      parts: [...parts].filter((part) => candidateSet.has(part) || part instanceof Connector || part instanceof TextComponent),
    };
  }

  /**
   * Changes the selected diagram (drawn by {@link generateDiagram}) as described by
   * `instruction`, e.g. "add a step to send a confirmation email after the payment".
   * The diagram is redrawn in the same place, in one undoable step.
   */
  public async editDiagram(instruction: string, options: AIOptions = {}): Promise<Diagram> {
    const current = this.readDiagram();
    if (!current) {
      throw new AIError('Select a diagram first (shapes with text, notes, and the arrows between them).');
    }

    const json = await this.requestJSON(
      [
        { role: 'system', content: editDiagramPrompt },
        {
          role: 'user',
          content: `Current diagram:\n${JSON.stringify(current.diagram)}\n\nChange: ${instruction.slice(0, 2000)}`,
        },
      ],
      options,
    );
    const diagram = validateDiagram(json);

    const center = Rect2.union(...current.parts.map((c) => c.getBBox())).center;
    // In the same place (if it still fits there, around what isn't part of the diagram).
    const created = this.buildDiagram(diagram, center, new Set(current.parts));
    await this.addAndShow(created, [], [], [new Erase(current.parts)]);
    return diagram;
  }

  /**
   * Changes what is selected as described by `instruction`: a selected diagram is edited
   * with {@link editDiagram} ("add a step…", "remove…", "rename…"); anything else goes
   * through {@link runCommand}.
   */
  public async editSelection(instruction: string, options: AIOptions = {}): Promise<AICommandResult> {
    const items = this.editor.selection.items;
    if (items.length > 0 && this.readDiagram(items)) {
      const diagram = await this.editDiagram(instruction, options);
      return { message: `Updated the diagram (${diagram.nodes.length} shapes).`, actions: ['editDiagram'] };
    }
    return this.runCommand(instruction, options);
  }

  /**
   * Asks the AI for ideas about the selected sticky note (or text), and adds them as notes
   * around it, linked to it.
   *
   * @returns the new notes.
   */
  public async brainstorm(options: AIOptions & { count?: number } = {}): Promise<StickyNote[]> {
    const editor = this.editor;
    const source = editor.selection.items.find((c) => c instanceof StickyNote || c instanceof TextComponent);
    const topic = source instanceof StickyNote || source instanceof TextComponent ? source.getText().trim() : '';
    if (!source || !topic) {
      throw new AIError('Select a sticky note (or a text) with the topic first.');
    }

    const count = Math.min(Math.max(options.count ?? 6, 2), 12);
    const json = await this.requestJSON(
      [
        { role: 'system', content: brainstormPrompt },
        { role: 'user', content: `Topic: ${topic.slice(0, 500)}\nGive ${count} ideas.` },
      ],
      options,
    );
    const ideas: string[] = (Array.isArray(json?.ideas) ? json.ideas : [])
      .map((idea: unknown) => shortText(idea, 160))
      .filter((idea: string) => idea !== '')
      .slice(0, count);
    if (ideas.length === 0) {
      throw new AIError('The AI did not return any ideas.');
    }

    // Notes in a ring around the topic.
    const sourceBox = source.getBBox();
    const noteSize = source instanceof StickyNote ? source.getBBox().w * 0.85 : 170 * editor.viewport.getSizeOfPixelOnCanvas();
    const radius = Math.max(sourceBox.w, sourceBox.h) / 2 + noteSize * 1.25;
    const sourceColor = source instanceof StickyNote ? source.getColor().toHexString() : '';
    const colors = Object.values(noteColors).filter((c) => !sourceColor.startsWith(c));
    const thickness = 2 * editor.viewport.getSizeOfPixelOnCanvas();

    const created: AbstractComponent[] = [];
    const notes: StickyNote[] = [];
    for (const [i, idea] of ideas.entries()) {
      const angle = -Math.PI / 2 + (i / ideas.length) * Math.PI * 2;
      const center = sourceBox.center.plus(Vec2.of(Math.cos(angle), Math.sin(angle)).times(radius));
      const note = StickyNote.centeredAt(center, {
        text: idea,
        color: Color4.fromHex(colors[i % colors.length]),
        size: Vec2.of(noteSize, noteSize * 0.75),
        fontSize: noteSize / 10,
      });
      notes.push(note);
      created.push(note);
      created.push(
        new Connector(
          { point: sourceBox.center, targetId: source.getId() },
          { point: center, targetId: note.getId() },
          { color: Color4.fromHex('#9ca3af'), thickness, arrow: 'none', sketch: !!this.sketch },
        ),
      );
    }

    await this.addAndShow(created);
    editor.selection.set(notes);
    return notes;
  }

  /**
   * Does what `request` says, using the editor's features: select items by description,
   * recolor, align, group, lock, add notes, draw or edit diagrams, brainstorm, organize
   * notes, or answer a question about the board. For example:
   * "color the notes about marketing in blue", "align the selected shapes to the left",
   * "what is missing in this flowchart?".
   */
  public async runCommand(request: string, options: AIOptions = {}): Promise<AICommandResult> {
    const editor = this.editor;
    const all = editor.image.getAllComponents().filter((c) => c.isSelectable()).slice(-200);

    // Short ids for the scene
    const byShortId = new Map<string, AbstractComponent>();
    const shortIdOf = new Map<AbstractComponent, string>();
    for (const [i, component] of all.entries()) {
      byShortId.set(`s${i + 1}`, component);
      shortIdOf.set(component, `s${i + 1}`);
    }
    const scene = this.describeScene(all).items.map((item) => {
      const component = all.find((c) => c.getId() === item.id)!;
      const result: Record<string, unknown> = { ...item, id: shortIdOf.get(component) };
      for (const key of ['from', 'to'] as const) {
        if (typeof item[key] === 'string') {
          const target = editor.image.lookupElement(item[key]);
          result[key] = target ? shortIdOf.get(target) : undefined;
        }
      }
      if (component.getGroupId()) result.group = component.getGroupId();
      if (component.isLocked()) result.locked = true;
      return result;
    });
    const shapeCount = all.filter((c) => c instanceof Stroke && c.getMetadata().diagramNode).length;
    const selected = editor.selection.items.map((c) => shortIdOf.get(c)).filter((id) => id);

    const json = await this.requestJSON(
      [
        { role: 'system', content: commandPrompt },
        {
          role: 'user',
          content:
            `Scene: ${JSON.stringify(scene)}\n` +
            (shapeCount > 0 ? `(${shapeCount} diagram shapes; their text is in the items of the same group)\n` : '') +
            `Selected: ${JSON.stringify(selected)}\n` +
            `Request: ${request.slice(0, 2000)}`,
        },
      ],
      options,
    );

    const actions: any[] = Array.isArray(json?.actions) ? json.actions.slice(0, 20) : [];
    const done: string[] = [];
    const selection = editor.selection;
    let noteOffset = 0;
    for (const action of actions) {
      const type = typeof action?.type === 'string' ? action.type : '';
      switch (type) {
        case 'select': {
          const ids: unknown[] = Array.isArray(action.ids) ? action.ids : [];
          selection.set(ids.map((id) => byShortId.get(String(id))).filter((c): c is AbstractComponent => !!c));
          break;
        }
        case 'setColor':
          if (typeof action.color !== 'string') continue;
          try {
            await selection.setColor(action.color);
          } catch {
            continue;
          }
          break;
        case 'align':
          await selection.align(oneOf(action.edge, ['left', 'center', 'right', 'top', 'middle', 'bottom'] as const, 'left'));
          break;
        case 'distribute':
          await selection.distribute(action.direction === 'vertical' ? 'vertical' : 'horizontal');
          break;
        case 'bringToFront': await selection.bringToFront(); break;
        case 'sendToBack': await selection.sendToBack(); break;
        case 'group': await selection.group(); break;
        case 'ungroup': await selection.ungroup(); break;
        case 'lock': await selection.lock(); break;
        case 'duplicate': await selection.duplicate(); break;
        case 'delete': await selection.delete(); break;
        case 'addNote': {
          const scale = editor.viewport.getSizeOfPixelOnCanvas();
          const center = editor.viewport.visibleRect.center.plus(Vec2.of(noteOffset, noteOffset).times(scale));
          noteOffset += 30;
          const color = noteColors[oneOf(action.color, colorNames, 'yellow')];
          const note = StickyNote.centeredAt(center, {
            text: shortText(action.text, 500),
            color: Color4.fromHex(color),
            size: Vec2.of(200, 200).times(scale),
            fontSize: 20 * scale,
          });
          await editor.dispatch(EditorImage.addComponent(note));
          selection.set([note]);
          break;
        }
        case 'generateDiagram':
          if (typeof action.prompt !== 'string') continue;
          await this.generateDiagram(action.prompt, options);
          break;
        case 'editDiagram':
          if (typeof action.instruction !== 'string') continue;
          await this.editDiagram(action.instruction, options);
          break;
        case 'mindMap':
          if (typeof action.topic !== 'string') continue;
          await this.generateMindMap(action.topic, options);
          break;
        case 'expandMindMap': await this.expandMindMap(options); break;
        case 'brainstorm': await this.brainstorm(options); break;
        case 'organizeNotes': await this.organizeNotes(options); break;
        default:
          continue;
      }
      done.push(type);
    }

    const message = shortText(json?.message, 2000) || (done.length > 0 ? 'Done.' : 'Nothing to do.');
    return { message, actions: done };
  }

  /**
   * Asks the AI to sort sticky notes into themed groups, then arranges each group in a
   * column under a title, with one color per group. Uses the selected notes, or all notes
   * if none are selected.
   */
  public async organizeNotes(options: AIOptions = {}): Promise<NoteGroup[]> {
    const editor = this.editor;
    const editable = (c: AbstractComponent): c is StickyNote => c instanceof StickyNote && c.isEditable();
    let notes = editor.selection.items.filter(editable);
    if (notes.length === 0) {
      notes = editor.image.getAllComponents().filter(editable);
    }
    if (notes.length < 2) {
      throw new AIError('Add at least two sticky notes to organize.');
    }
    notes = notes.slice(0, 80);

    const shortIds = new Map(notes.map((note, i) => [`n${i + 1}`, note]));
    const list = [...shortIds].map(([id, note]) => `${id}: ${note.getText().replace(/\s+/g, ' ').slice(0, 200) || '(empty)'}`);
    const json = await this.requestJSON(
      [
        { role: 'system', content: organizePrompt },
        { role: 'user', content: list.join('\n') },
      ],
      options,
    );

    // Each note in exactly one group, in the order given by the AI.
    const placed = new Set<StickyNote>();
    const groups: NoteGroup[] = [];
    const rawGroups: any[] = Array.isArray(json?.groups) ? json.groups.slice(0, 10) : [];
    for (const [i, raw] of rawGroups.entries()) {
      const members = (Array.isArray(raw?.notes) ? raw.notes : [])
        .map((id: unknown) => shortIds.get(String(id).trim()))
        .filter((note: StickyNote | undefined): note is StickyNote => !!note && !placed.has(note));
      if (members.length === 0) continue;
      for (const note of members) placed.add(note);
      groups.push({
        title: shortText(raw?.title, 40) || `Group ${i + 1}`,
        color: oneOf(raw?.color, colorNames, colorNames[i % colorNames.length]),
        notes: members,
      });
    }
    const rest = notes.filter((note) => !placed.has(note));
    if (rest.length > 0) {
      groups.push({ title: 'Other', color: 'gray', notes: rest });
    }
    if (groups.length === 0) {
      throw new AIError('The AI did not return any groups.');
    }

    // Columns, starting where the notes are.
    const bboxes = notes.map((note) => note.getBBox());
    const origin = Rect2.union(...bboxes).topLeft;
    const columnWidth = Math.max(...bboxes.map((b) => b.w));
    const gap = columnWidth * 0.12;
    const titleSize = columnWidth * 0.11;

    const commands: Command[] = [];
    const titles: AbstractComponent[] = [];
    for (const [column, group] of groups.entries()) {
      const left = origin.x + column * (columnWidth + gap);
      const groupId = `group-${group.notes[0].getId()}-organized`;
      const title = TextComponent.fromLines(
        [group.title],
        Mat33.translation(Vec2.of(left, origin.y + titleSize)),
        { size: titleSize, fontFamily: this.fontFamily, fontWeight: 'bold', renderingStyle: { fill: Color4.fromHex('#1f2937') } },
      );
      title.setGroupDirectly(groupId);
      titles.push(title);

      let top = origin.y + titleSize * 1.8;
      for (const note of group.notes) {
        const bbox = note.getBBox();
        const offset = Vec2.of(left - bbox.x, top - bbox.y);
        commands.push(note.setZIndexAndTransformBy(Mat33.translation(offset), note.getZIndex()));
        commands.push(note.updateStyle({ color: Color4.fromHex(noteColors[group.color]) }));
        commands.push(note.setGroup(groupId));
        top += bbox.h + gap * 0.6;
      }
    }

    await this.addAndShow(titles, commands, notes);
    return groups;
  }
}
