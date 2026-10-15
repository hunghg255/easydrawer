import type { AIColorName, Diagram, DiagramEdge, DiagramNode, DiagramNodeKind } from './EditorAI';

/** Thrown by {@link parseMermaid} for text it can't read. */
export class MermaidError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MermaidError';
  }
}

const maxNodes = 200;

function cleanLabel (text: string) {
  let label = text.trim();
  if (label.length >= 2 && label.startsWith('"') && label.endsWith('"')) {
    label = label.slice(1, -1);
  }
  return label
    .replaceAll(/<br\s*\/?>/gi, ' ')
    .replaceAll('#quot;', '"')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** Lines of the text without comments, front matter and directives. */
function linesOf (text: string) {
  let lines = text.replaceAll('\r', '').split('\n');
  // Front matter (--- … ---)
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end > 0) lines = lines.slice(end + 1);
  }
  return lines
    .map((line) => line.replace(/%%.*$/, '').trim())
    .filter((line) => line !== '');
}

class DiagramBuilder {
  public readonly nodes = new Map<string, DiagramNode>();
  public readonly edges: DiagramEdge[] = [];

  public node(id: string, label?: string, kind?: DiagramNodeKind) {
    let node = this.nodes.get(id);
    if (!node) {
      if (this.nodes.size >= maxNodes) {
        throw new MermaidError(`Too many nodes (more than ${maxNodes}).`);
      }
      node = { id, label: id, kind: kind ?? 'process' };
      this.nodes.set(id, node);
    }
    if (label !== undefined && label !== '') node.label = label;
    if (kind) node.kind = kind;
    return node;
  }

  public edge(from: string, to: string, label?: string) {
    if (from === to) return;
    this.edges.push({ from, to, ...(label ? { label: label.slice(0, 40) } : {}) });
  }

  public build(direction: Diagram['direction']): Diagram {
    if (this.nodes.size === 0) {
      throw new MermaidError('The diagram has no nodes.');
    }
    return { direction, nodes: [...this.nodes.values()], edges: this.edges };
  }
}

// Flowcharts --------------------------------------------------------------------------------

// Node shapes: opening, closing, kind. Longer openings first.
const shapes: Array<[open: string, close: string[], kind: DiagramNodeKind]> = [
  ['(((', [')))'], 'terminal'],
  ['((', ['))'], 'terminal'],
  ['([', ['])'], 'terminal'],
  ['[[', [']]'], 'process'],
  ['[(', [')]'], 'process'],
  ['[/', ['/]', String.raw`\]`], 'io'],
  ['[\\', [String.raw`\]`, '/]'], 'io'],
  ['{{', ['}}'], 'decision'],
  ['[', [']'], 'process'],
  ['(', [')'], 'terminal'],
  ['{', ['}'], 'decision'],
  ['>', [']'], 'process'],
];

const idPattern = /^[\p{L}\p{N}_$]+/u;
// `-- text -->`, `== text ==>`, `-. text .->`
const labeledLinkPattern = /^<?(?:--|==|-\.)(?![.=>-])\s*([^\n>]*?)\s*(?:-{2,}[>ox]|={2,}[>ox]|\.-+[>ox]|-{3,}|={3,}|\.-+)/;
// `-->`, `---`, `==>`, `-.->`, `--o`, `~~~`…
const linkPattern = /^<?(?:-{2,}[>ox]?|={2,}[>ox]?|-\.+-[>ox]?|~~~)/;

interface Cursor {
  text: string;
  pos: number;
}

function skipSpaces (cursor: Cursor) {
  while (cursor.pos < cursor.text.length && /\s/.test(cursor.text[cursor.pos])) cursor.pos++;
}

function readNode (cursor: Cursor, builder: DiagramBuilder): string | null {
  skipSpaces(cursor);
  const rest = cursor.text.slice(cursor.pos);
  const idMatch = rest.match(idPattern);
  if (!idMatch) return null;
  const id = idMatch[0];
  cursor.pos += id.length;

  // Optional shape with a label: A[label], A{label}…
  const after = cursor.text.slice(cursor.pos);
  for (const [open, closings, kind] of shapes) {
    if (!after.startsWith(open)) continue;
    let end = -1;
    let closeLength = 0;
    // Quoted labels can contain brackets.
    const quoted = after.slice(open.length).trimStart().startsWith('"');
    const searchFrom = quoted ? after.indexOf('"', after.indexOf('"') + 1) + 1 : open.length;
    for (const close of closings) {
      const index = after.indexOf(close, Math.max(searchFrom, open.length));
      if (index !== -1 && (end === -1 || index < end)) {
        end = index;
        closeLength = close.length;
      }
    }
    if (end === -1) break;
    builder.node(id, cleanLabel(after.slice(open.length, end)), kind);
    cursor.pos += end + closeLength;
    // Class shorthand: A:::className
    const classMatch = cursor.text.slice(cursor.pos).match(/^:::[\w-]+/);
    if (classMatch) cursor.pos += classMatch[0].length;
    return id;
  }

  const classMatch = cursor.text.slice(cursor.pos).match(/^:::[\w-]+/);
  if (classMatch) cursor.pos += classMatch[0].length;
  builder.node(id);
  return id;
}

/** `A & B` */
function readNodeGroup (cursor: Cursor, builder: DiagramBuilder): string[] {
  const ids: string[] = [];
  for (;;) {
    const id = readNode(cursor, builder);
    if (!id) break;
    ids.push(id);
    skipSpaces(cursor);
    if (cursor.text[cursor.pos] !== '&') break;
    cursor.pos++;
  }
  return ids;
}

function readLink (cursor: Cursor): { label?: string; reverse: boolean } | null {
  skipSpaces(cursor);
  const rest = cursor.text.slice(cursor.pos);
  let match = rest.match(labeledLinkPattern);
  let label: string | undefined;
  if (match && match[1].trim() !== '') {
    label = cleanLabel(match[1]);
  } else {
    match = rest.match(linkPattern);
  }
  if (!match) return null;
  cursor.pos += match[0].length;
  const reverse = match[0].startsWith('<') && !/[>ox]$/.test(match[0]);

  // `-->|label|`
  skipSpaces(cursor);
  const pipe = cursor.text.slice(cursor.pos).match(/^\|([^|]*)\|/);
  if (pipe) {
    label = cleanLabel(pipe[1]);
    cursor.pos += pipe[0].length;
  }
  return { label: label || undefined, reverse };
}

const skippedStatements = /^(?:subgraph|end|style|classDef|class|click|linkStyle|direction|accTitle|accDescr|title)\b/;

function parseFlowchart (lines: string[], header: string): Diagram {
  const builder = new DiagramBuilder();
  const directionMatch = header.match(/^(?:graph|flowchart)\s+(\w+)/i);
  const direction = directionMatch && /^(?:lr|rl)$/i.test(directionMatch[1]) ? 'right' : 'down';

  for (const line of lines) {
    // `;` separates statements, except in quoted labels (and entities like `#quot;`).
    for (const statement of line.match(/(?:"[^"]*"|#\w+;|[^";])+/g) ?? []) {
      const text = statement.trim();
      if (text === '' || skippedStatements.test(text)) continue;

      const cursor = { text, pos: 0 };
      let previous = readNodeGroup(cursor, builder);
      while (previous.length > 0) {
        const link = readLink(cursor);
        if (!link) break;
        const next = readNodeGroup(cursor, builder);
        for (const from of previous) {
          for (const to of next) {
            if (link.reverse) builder.edge(to, from, link.label);
            else builder.edge(from, to, link.label);
          }
        }
        previous = next;
      }
    }
  }
  return builder.build(direction);
}

// ER diagrams --------------------------------------------------------------------------------

function parseER (lines: string[]): Diagram {
  const builder = new DiagramBuilder();
  const entityName = String.raw`("[^"]+"|[\p{L}\p{N}_-]+)`;
  const relation = new RegExp(String.raw`^${entityName}\s+([|}o][|o]?|[|o][|{]?)?(--|\.\.)([|o][|{]?|[|}o][|o]?)?\s+${entityName}\s*:\s*(.+)$`, 'u');
  const blockStart = new RegExp(String.raw`^${entityName}\s*(?:\[[^\]]*\])?\s*\{(.*)$`, 'u');
  let current: DiagramNode | null = null;

  const addAttribute = (text: string) => {
    // type name [PK, FK] ["comment"]
    const match = text.trim().match(/^([\w(),.[\]-]+)\s+([\w-]+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?/);
    if (!match || !current) return;
    current.details = [...(current.details ?? []), `${match[2]} ${match[1]}${match[3] ? ` ${match[3].replaceAll(/\s+/g, '')}` : ''}`];
  };

  for (const line of lines) {
    if (current) {
      const end = line.indexOf('}');
      const body = end === -1 ? line : line.slice(0, end);
      if (body.trim() !== '') addAttribute(body);
      if (end !== -1) current = null;
      continue;
    }

    const block = line.match(blockStart);
    if (block) {
      current = builder.node(cleanLabel(block[1]), undefined, 'entity');
      current.details ??= [];
      // One-line block: A { int id }
      const rest = block[2];
      const end = rest.indexOf('}');
      if (end !== -1) {
        for (const attribute of rest.slice(0, end).split(/\s{2,}|,(?![^(]*\))/)) {
          if (attribute.trim() !== '') addAttribute(attribute);
        }
        current = null;
      } else if (rest.trim() !== '') {
        addAttribute(rest);
      }
      continue;
    }

    const match = line.match(relation);
    if (match) {
      const from = cleanLabel(match[1]);
      const to = cleanLabel(match[5]);
      builder.node(from, undefined, 'entity');
      builder.node(to, undefined, 'entity');
      builder.edge(from, to, cleanLabel(match[6]));
      continue;
    }

    // An entity on its own
    const single = line.match(new RegExp(String.raw`^${entityName}$`, 'u'));
    if (single && !/^(?:direction|title)$/i.test(single[1])) {
      builder.node(cleanLabel(single[1]), undefined, 'entity');
    }
  }
  return builder.build('right');
}

// Class diagrams -----------------------------------------------------------------------------

function className (name: string) {
  return cleanLabel(name).replaceAll(/~([^~]*)~/g, '<$1>');
}

function parseClassDiagram (lines: string[]): Diagram {
  const builder = new DiagramBuilder();
  const name = String.raw`([\p{L}\p{N}_$]+(?:~[^~]*~)?|\x60[^\x60]+\x60)`;
  const cardinality = String.raw`(?:\s+"[^"]*")?`;
  const relation = new RegExp(
    String.raw`^${name}${cardinality}\s*(<\|--|<\|\.\.|\*--|o--|<--|<\.\.|-->|\.\.>|--\|>|\.\.\|>|--\*|--o|--|\.\.)\s*${cardinality.replace(String.raw`\s+`, String.raw`\s*`)}\s*${name}(?:\s*:\s*(.+))?$`,
    'u',
  );
  const classStart = new RegExp(String.raw`^class\s+${name}\s*(?:\[[^\]]*\])?\s*(\{)?(.*)$`, 'u');
  const member = new RegExp(String.raw`^${name}\s*:\s*(.+)$`, 'u');
  let current: DiagramNode | null = null;

  // `List~T~` and `List` are the same class.
  const entity = (name: string) => {
    const id = cleanLabel(name).replaceAll(/~[^~]*~/g, '').replaceAll('`', '');
    const node = builder.node(id, name.includes('~') ? className(name).replaceAll('`', '') : undefined, 'entity');
    node.details ??= [];
    return node;
  };
  const addMember = (node: DiagramNode, text: string) => {
    const value = text.trim();
    if (value === '' || node.details!.length >= 24) return;
    node.details!.push(value.startsWith('<<') ? value.replace(/^<<(.*)>>$/, '«$1»') : value.slice(0, 60));
  };

  for (const line of lines) {
    if (current) {
      const end = line.indexOf('}');
      addMember(current, end === -1 ? line : line.slice(0, end));
      if (end !== -1) current = null;
      continue;
    }

    const start = line.match(classStart);
    if (start) {
      const node = entity(start[1]);
      if (start[2]) {
        const rest = start[3];
        const end = rest.indexOf('}');
        if (end === -1) {
          addMember(node, rest);
          current = node;
        } else {
          addMember(node, rest.slice(0, end));
        }
      }
      continue;
    }

    const match = line.match(relation);
    if (match) {
      const left = entity(match[1]).id;
      const right = entity(match[3]).id;
      const arrow = match[2];
      const label = match[4] ? cleanLabel(match[4]) : undefined;
      // The arrow (or diamond) points at the left class for `<|--`, `*--`, `o--`, `<--`…
      if (/^[*<o]/.test(arrow)) builder.edge(right, left, label);
      else builder.edge(left, right, label);
      continue;
    }

    const annotation = line.match(new RegExp(String.raw`^<<(.+)>>\s*${name}$`, 'u'));
    if (annotation) {
      addMember(entity(annotation[2]), `<<${annotation[1]}>>`);
      continue;
    }

    const memberMatch = line.match(member);
    if (memberMatch) {
      addMember(entity(memberMatch[1]), memberMatch[2]);
    }
  }

  // Annotations first
  for (const node of builder.nodes.values()) {
    node.details?.sort((a, b) => Number(b.startsWith('«')) - Number(a.startsWith('«')));
  }
  return builder.build('down');
}

/**
 * Reads a [Mermaid](https://mermaid.js.org) diagram: flowcharts (`graph` / `flowchart`),
 * entity-relationship diagrams (`erDiagram`) and class diagrams (`classDiagram`).
 * Subgraphs, styles and click handlers are ignored.
 *
 * @throws {@link MermaidError} if the text isn't one of these diagrams.
 */
export function parseMermaid (text: string): Diagram {
  const lines = linesOf(text);
  const header = lines.shift() ?? '';
  if (/^(?:graph|flowchart)\b/i.test(header)) {
    return parseFlowchart(lines, header);
  }
  if (/^erDiagram\b/.test(header)) {
    return parseER(lines);
  }
  if (/^classDiagram(?:-v2)?\b/.test(header)) {
    return parseClassDiagram(lines);
  }
  throw new MermaidError(
    `Unsupported Mermaid diagram${header ? ` "${header.split(/\s/)[0]}"` : ''}: use flowchart, erDiagram or classDiagram.`,
  );
}

// Export -------------------------------------------------------------------------------------

const exportColors: Record<AIColorName, string> = {
  blue: 'fill:#dbeafe,stroke:#3b82f6',
  green: 'fill:#dcfce7,stroke:#22c55e',
  yellow: 'fill:#fef9c3,stroke:#eab308',
  pink: 'fill:#fce7f3,stroke:#ec4899',
  purple: 'fill:#ede9fe,stroke:#8b5cf6',
  gray: 'fill:#f3f4f6,stroke:#6b7280',
};

function quote (text: string) {
  return `"${text.replaceAll('"', '#quot;')}"`;
}

const erAttributePattern = /^([\w-]+)\s+([\w(),.[\]-]+)((?:\s+(?:PK|FK|UK)(?:,(?:PK|FK|UK))*)?)$/;

/**
 * Writes a diagram as [Mermaid](https://mermaid.js.org) text: an `erDiagram` when all the nodes
 * are entities with columns (`name TYPE [PK|FK]`), a `classDiagram` for other entities, and a
 * `flowchart` otherwise.
 */
export function diagramToMermaid (diagram: Diagram): string {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const node of diagram.nodes) {
    let id = node.id.replaceAll(/[^\p{L}\p{N}_]/gu, '_') || 'node';
    if (/^(?:end|graph|subgraph|class|style)$/i.test(id) || /^\d/.test(id)) id = `n_${id}`;
    while (used.has(id)) id += '_';
    used.add(id);
    ids.set(node.id, id);
  }
  const idOf = (id: string) => ids.get(id) ?? id;

  const allEntities = diagram.nodes.every((node) => node.kind === 'entity');
  if (allEntities) {
    const isER = diagram.nodes.every((node) => (node.details ?? []).every((d) => erAttributePattern.test(d.trim())));
    if (isER) {
      const lines = ['erDiagram'];
      for (const node of diagram.nodes) {
        const name = node.label.replaceAll(/[^\p{L}\p{N}_-]/gu, '_') || idOf(node.id);
        ids.set(node.id, name);
        const details = node.details ?? [];
        if (details.length === 0) {
          lines.push(`  ${name}`);
          continue;
        }
        lines.push(`  ${name} {`);
        for (const detail of details) {
          const [, column, type, keys] = detail.trim().match(erAttributePattern)!;
          lines.push(`    ${type} ${column}${keys ? ` ${keys.trim()}` : ''}`);
        }
        lines.push('  }');
      }
      for (const edge of diagram.edges) {
        lines.push(`  ${idOf(edge.from)} ||--o{ ${idOf(edge.to)} : ${quote(edge.label ?? 'has')}`);
      }
      return lines.join('\n');
    }

    const lines = ['classDiagram'];
    for (const node of diagram.nodes) {
      const name = node.label.replaceAll(/[^\p{L}\p{N}_]/gu, '_') || idOf(node.id);
      ids.set(node.id, name);
      lines.push(`  class ${name} {`);
      for (const detail of node.details ?? []) {
        lines.push(`    ${detail.startsWith('«') ? detail.replace(/^«(.*)»$/, '<<$1>>') : detail.replaceAll(/[{}]/g, '')}`);
      }
      lines.push('  }');
    }
    for (const edge of diagram.edges) {
      lines.push(`  ${idOf(edge.from)} --> ${idOf(edge.to)}${edge.label ? ` : ${edge.label}` : ''}`);
    }
    return lines.join('\n');
  }

  const lines = [`flowchart ${diagram.direction === 'right' ? 'LR' : 'TD'}`];
  for (const node of diagram.nodes) {
    const label = quote(node.kind === 'entity' ? [node.label, ...(node.details ?? [])].join('<br/>') : node.label);
    const shape =
      node.kind === 'decision' ? `{${label}}`
        : node.kind === 'terminal' ? `([${label}])`
          : node.kind === 'io' ? `[/${label}/]`
            : `[${label}]`;
    lines.push(`  ${idOf(node.id)}${shape}`);
  }
  for (const edge of diagram.edges) {
    const label = edge.label ? `|${quote(edge.label)}|` : '';
    lines.push(`  ${idOf(edge.from)} -->${label} ${idOf(edge.to)}`);
  }
  const colors = new Set(diagram.nodes.map((node) => node.color).filter((c): c is AIColorName => !!c));
  for (const color of colors) {
    lines.push(`  classDef ${color} ${exportColors[color]}`);
    const members = diagram.nodes.filter((node) => node.color === color).map((node) => idOf(node.id));
    lines.push(`  class ${members.join(',')} ${color}`);
  }
  return lines.join('\n');
}
