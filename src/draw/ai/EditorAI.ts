import { Color4, type IVec2, Mat33, Path, Rect2, Vec2 } from '~/math';

import layoutGraph from './layoutGraph';
import parseAIJSON from './parseJSON';
import { AIError, type AIMessage, type AIRequestHandler } from './types';
import type AbstractComponent from '../components/AbstractComponent';
import Connector from '../components/Connector';
import { type RouteSide } from '../components/util/routeOrthogonal';
import ImageComponent from '../components/ImageComponent';
import StickyNote from '../components/StickyNote';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';

/** Colors the AI can choose for diagram nodes and note groups. */
export type AIColorName = 'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'gray';
export type DiagramNodeKind = 'process' | 'decision' | 'terminal' | 'io';

export interface DiagramNode {
  id: string;
  label: string;
  kind: DiagramNodeKind;
  color?: AIColorName;
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
}

const colorNames: AIColorName[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'gray'];
const nodeKinds: DiagramNodeKind[] = ['process', 'decision', 'terminal', 'io'];

const shapeColors: Record<AIColorName, { fill: string; border: string }> = {
  blue: { fill: '#dbeafe', border: '#1d4ed8' },
  green: { fill: '#dcfce7', border: '#15803d' },
  yellow: { fill: '#fef3c7', border: '#b45309' },
  pink: { fill: '#fce7f3', border: '#be185d' },
  purple: { fill: '#ede9fe', border: '#6d28d9' },
  gray: { fill: '#f3f4f6', border: '#4b5563' },
};

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
};

const diagramPrompt = `You convert descriptions into diagrams (flowcharts, processes, architectures, mind maps).
Answer with ONE JSON object and nothing else:
{"direction":"down","nodes":[{"id":"n1","label":"Start","kind":"terminal","color":"green"}],"edges":[{"from":"n1","to":"n2","label":""}]}
Rules:
- "kind": "terminal" (start/end), "process" (a step or a thing), "decision" (a question or condition), "io" (input/output, data).
- "color": one of ${colorNames.join(', ')}. Optional.
- Edges leaving a decision have short labels (e.g. "yes"/"no"). Other edge labels are usually empty.
- "direction": "right" for timelines and short pipelines, otherwise "down".
- At most 25 nodes. Labels are short (at most 6 words), in the same language as the description.`;

const editDiagramPrompt = `${diagramPrompt}
You are EDITING an existing diagram: answer with the complete updated diagram.
Keep the ids, labels, kinds and colors of the nodes that should not change.`;

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

  /** Whether a request handler has been given. */
  public get isConfigured() {
    return this.requestHandler !== null;
  }

  public setRequestHandler(handler: AIRequestHandler | null) {
    this.requestHandler = handler;
  }

  /** Sends `messages` to the AI and returns the JSON object of its answer. */
  public async requestJSON(messages: AIMessage[], options: AIOptions = {}): Promise<any> {
    if (!this.requestHandler) {
      throw new AIError('AI is not configured: give a request handler with the "ai" editor setting.');
    }

    let answer: string;
    try {
      answer = await this.requestHandler({ messages, json: true, signal: options.signal });
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(`AI request failed: ${(error as Error)?.message ?? error}`, error);
    }
    return parseAIJSON(answer);
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
    const json = await this.requestJSON(
      [
        { role: 'system', content: diagramPrompt },
        { role: 'user', content: prompt.slice(0, 4000) },
      ],
      options,
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
    const created = this.buildDiagram(diagram, options.center ?? this.editor.viewport.visibleRect.center);
    await this.addAndShow(created);
  }

  // Creates the components of a diagram centered on `center` (not added to the image).
  private buildDiagram(diagram: Diagram, center: IVec2): AbstractComponent[] {
    const editor = this.editor;
    const scale = editor.viewport.getSizeOfPixelOnCanvas();
    const textStyle: TextRenderingStyle = {
      size: 15 * scale,
      fontFamily: 'sans-serif',
      renderingStyle: { fill: Color4.fromHex('#1f2937') },
    };
    const lineHeight = textStyle.size * 1.25;

    // Sizes
    const sized = diagram.nodes.map((node) => {
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
    const created: AbstractComponent[] = [];
    const shapeById = new Map<string, Stroke>();
    for (const { node, lines, width, height } of sized) {
      const position = positions.get(node.id)!;
      const nodeCenter = Vec2.of(center.x + position.x, center.y + position.y);
      const colors = shapeColors[node.color ?? defaultKindColors[node.kind]];

      const shape = new Stroke([
        pathToRenderable(nodePath(node.kind, width, height).transformedBy(Mat33.translation(nodeCenter)), {
          fill: Color4.fromHex(colors.fill),
          stroke: { color: Color4.fromHex(colors.border), width: 2 * scale },
        }),
      ]);
      const groupId = `group-${shape.getId()}`;
      shape.setGroupDirectly(groupId);
      shape.setMetadata({
        diagramNode: node.id,
        kind: node.kind,
        direction: diagram.direction,
        ...(node.color ? { color: node.color } : {}),
      });
      shapeById.set(node.id, shape);
      created.push(shape);

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
        { color: Color4.fromHex('#374151'), thickness: 2 * scale, arrow: 'end', label: edge.label, routing: 'elbow' },
      );
      created.push(connector);
    }

    return created;
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
   * Reads a diagram drawn by {@link drawDiagram} from `components` (by default the selection,
   * or everything): its nodes and the connectors between them.
   *
   * @returns the diagram, and the components it is made of, or `null` if there is none.
   */
  public readDiagram(components?: AbstractComponent[]): { diagram: Diagram; parts: AbstractComponent[] } | null {
    const image = this.editor.image;
    const all = image.getAllComponents();
    let candidates = components ?? this.editor.selection.items;
    if (candidates.length === 0) candidates = all;

    const shapes = candidates.filter((c) => c instanceof Stroke && c.getMetadata().diagramNode);
    if (shapes.length === 0) return null;

    const parts = new Set<AbstractComponent>(shapes);
    const shortIds = new Map<string, string>();
    const nodes: DiagramNode[] = shapes.map((shape, i) => {
      const meta = shape.getMetadata();
      const id = `n${i + 1}`;
      shortIds.set(shape.getId(), id);

      // The node's text: texts in the same group, top to bottom.
      const groupId = shape.getGroupId();
      const texts = groupId
        ? all.filter((c): c is TextComponent => c instanceof TextComponent && c.getGroupId() === groupId)
        : [];
      texts.sort((a, b) => a.getBBox().y - b.getBBox().y);
      for (const text of texts) parts.add(text);

      return {
        id,
        label: texts.map((t) => t.getText()).join(' ') || '…',
        kind: oneOf(meta.kind, nodeKinds, 'process'),
        color: meta.color ? oneOf(meta.color, colorNames, 'blue') : undefined,
      };
    });

    const edges: DiagramEdge[] = [];
    for (const component of all) {
      if (!(component instanceof Connector)) continue;
      const from = shortIds.get(component.getStart().targetId ?? '');
      const to = shortIds.get(component.getEnd().targetId ?? '');
      if (from && to) {
        edges.push({ from, to, label: component.getLabel() || undefined });
        parts.add(component);
      }
    }

    const direction = shapes[0].getMetadata().direction === 'right' ? 'right' : 'down';
    return { diagram: { direction, nodes, edges }, parts: [...parts] };
  }

  /**
   * Changes the selected diagram (drawn by {@link generateDiagram}) as described by
   * `instruction`, e.g. "add a step to send a confirmation email after the payment".
   * The diagram is redrawn in the same place, in one undoable step.
   */
  public async editDiagram(instruction: string, options: AIOptions = {}): Promise<Diagram> {
    const current = this.readDiagram();
    if (!current) {
      throw new AIError('Select a diagram made with "Generate diagram" first.');
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
    const created = this.buildDiagram(diagram, center);
    await this.addAndShow(created, [], [], [new Erase(current.parts)]);
    return diagram;
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
          { color: Color4.fromHex('#9ca3af'), thickness, arrow: 'none' },
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
          const target = editor.image.lookupElement(item[key] as string);
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
        { size: titleSize, fontFamily: 'sans-serif', fontWeight: 'bold', renderingStyle: { fill: Color4.fromHex('#1f2937') } },
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
