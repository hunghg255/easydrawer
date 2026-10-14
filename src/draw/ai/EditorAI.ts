import { Color4, Mat33, Path, Rect2, Vec2 } from '~/math';

import layoutGraph from './layoutGraph';
import parseAIJSON from './parseJSON';
import { AIError, type AIMessage, type AIRequestHandler } from './types';
import type AbstractComponent from '../components/AbstractComponent';
import Connector from '../components/Connector';
import ImageComponent from '../components/ImageComponent';
import StickyNote from '../components/StickyNote';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import type Command from '../commands/Command';
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

  /** Draws a diagram (as returned by {@link generateDiagram}) in the middle of the screen. */
  public async drawDiagram(diagram: Diagram) {
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
      { direction: diagram.direction, nodeGap: 50 * scale, layerGap: 70 * scale },
    );
    const center = editor.viewport.visibleRect.center;

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

    for (const edge of diagram.edges) {
      const from = shapeById.get(edge.from)!;
      const to = shapeById.get(edge.to)!;
      const connector = new Connector(
        { point: from.getBBox().center, targetId: from.getId() },
        { point: to.getBBox().center, targetId: to.getId() },
        { color: Color4.fromHex('#374151'), thickness: 2 * scale, arrow: 'end', label: edge.label },
      );
      created.push(connector);
    }

    await this.addAndShow(created);
  }

  // Adds new components in one undoable step, selects them and makes sure they're visible.
  private async addAndShow(
    components: AbstractComponent[],
    extraCommands: Command[] = [],
    alsoSelect: AbstractComponent[] = [],
  ) {
    const editor = this.editor;
    const commands = [...components.map((c) => EditorImage.addComponent(c)), ...extraCommands];
    await editor.dispatch(uniteCommands(commands));

    const selection = [...components, ...alsoSelect];
    editor.selection.set(selection);

    const bbox = Rect2.union(...selection.map((c) => c.getBBox()));
    if (!editor.viewport.visibleRect.containsRect(bbox)) {
      await editor.dispatchNoAnnounce(editor.viewport.zoomTo(bbox.grownBy(bbox.maxDimension * 0.15)), false);
    }
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
