import { describe, expect, it } from 'vitest';

import { diagramToMermaid, MermaidError, parseMermaid } from './mermaid';
import layoutMindMap, { validateMindMap } from './mindMap';

describe('parseMermaid', () => {
  it('reads flowcharts with shapes, chains and labels', () => {
    const diagram = parseMermaid(`
      %% a comment
      flowchart LR
        A([Start]) --> B{Logged in?}
        B -->|yes| C[Dashboard]
        B -- no --> D[/Login form/] --> B
        C & D -.-> E((End));
        style A fill:#f00
        subgraph x
        end
    `);
    expect(diagram.direction).toBe('right');
    expect(diagram.nodes.map((n) => [n.id, n.label, n.kind])).toEqual([
      ['A', 'Start', 'terminal'],
      ['B', 'Logged in?', 'decision'],
      ['C', 'Dashboard', 'process'],
      ['D', 'Login form', 'io'],
      ['E', 'End', 'terminal'],
    ]);
    expect(diagram.edges).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C', label: 'yes' },
      { from: 'B', to: 'D', label: 'no' },
      { from: 'D', to: 'B' },
      { from: 'C', to: 'E' },
      { from: 'D', to: 'E' },
    ]);
  });

  it('reads quoted labels, graph TD, and unicode ids', () => {
    const diagram = parseMermaid('graph TD\n  bước1["Đăng nhập (OAuth) <br/> ngay"] --- B2');
    expect(diagram.direction).toBe('down');
    expect(diagram.nodes[0]).toMatchObject({ id: 'bước1', label: 'Đăng nhập (OAuth) ngay' });
    expect(diagram.nodes[1]).toMatchObject({ id: 'B2', label: 'B2' });
    expect(diagram.edges).toEqual([{ from: 'bước1', to: 'B2' }]);
  });

  it('reads ER diagrams', () => {
    const diagram = parseMermaid(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE-ITEM : "contains"
      CUSTOMER {
        string name
        int id PK
      }
      ORDER { int id PK }
    `);
    expect(diagram.nodes.map((n) => [n.id, n.kind, n.details])).toEqual([
      ['CUSTOMER', 'entity', ['name string', 'id int PK']],
      ['ORDER', 'entity', ['id int PK']],
      ['LINE-ITEM', 'entity', undefined],
    ]);
    expect(diagram.edges).toEqual([
      { from: 'CUSTOMER', to: 'ORDER', label: 'places' },
      { from: 'ORDER', to: 'LINE-ITEM', label: 'contains' },
    ]);
  });

  it('reads class diagrams', () => {
    const diagram = parseMermaid(`classDiagram
      Animal <|-- Duck
      class Duck {
        +String beakColor
        +swim()
      }
      class Shape~T~
      <<interface>> Shape
      Animal : +int age
      Duck "1" --> "*" Egg : lays
    `);
    const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
    expect(byId.get('Duck')?.details).toEqual(['+String beakColor', '+swim()']);
    expect(byId.get('Animal')?.details).toEqual(['+int age']);
    expect(byId.get('Shape')).toMatchObject({ label: 'Shape<T>', details: ['«interface»'] });
    expect(diagram.edges).toEqual([
      { from: 'Duck', to: 'Animal' },
      { from: 'Duck', to: 'Egg', label: 'lays' },
    ]);
  });

  it('rejects other diagrams', () => {
    expect(() => parseMermaid('sequenceDiagram\n A->>B: hi')).toThrow(MermaidError);
    expect(() => parseMermaid('flowchart TD')).toThrow(MermaidError);
  });
});

describe('diagramToMermaid', () => {
  it('writes flowcharts that can be read back', () => {
    const diagram = {
      direction: 'down' as const,
      nodes: [
        { id: 'n1', label: 'Start', kind: 'terminal' as const, color: 'green' as const },
        { id: 'n2', label: 'Say "hi"?', kind: 'decision' as const },
        { id: 'end', label: 'Done', kind: 'io' as const },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'end', label: 'yes' },
      ],
    };
    const text = diagramToMermaid(diagram);
    expect(text).toContain('classDef green');
    const back = parseMermaid(text);
    expect(back.nodes.map((n) => [n.label, n.kind])).toEqual([
      ['Start', 'terminal'],
      ['Say "hi"?', 'decision'],
      ['Done', 'io'],
    ]);
    expect(back.edges.map((e) => e.label)).toEqual([undefined, 'yes']);
  });

  it('writes ER and class diagrams for entities', () => {
    const er = diagramToMermaid({
      direction: 'right',
      nodes: [
        { id: 'a', label: 'users', kind: 'entity', details: ['id INT PK', 'email TEXT'] },
        { id: 'b', label: 'orders', kind: 'entity', details: ['user_id INT FK'] },
      ],
      edges: [{ from: 'b', to: 'a', label: 'user_id' }],
    });
    expect(er.split('\n')[0]).toBe('erDiagram');
    expect(parseMermaid(er).nodes[0].details).toEqual(['id INT PK', 'email TEXT']);

    const classes = diagramToMermaid({
      direction: 'down',
      nodes: [{ id: 'a', label: 'User', kind: 'entity', details: ['+ name: string', '+ save(): void'] }],
      edges: [],
    });
    expect(classes.split('\n')[0]).toBe('classDiagram');
    expect(parseMermaid(classes).nodes[0].details).toEqual(['+ name: string', '+ save(): void']);
  });
});

describe('mind maps', () => {
  it('validates AI answers', () => {
    const map = validateMindMap({ root: 'Trip', children: ['Food', { label: 'Places', children: [{ text: 'Beach' }] }, ''] });
    expect(map).toEqual({ label: 'Trip', children: [{ label: 'Food' }, { label: 'Places', children: [{ label: 'Beach' }] }] });
    expect(() => validateMindMap({ label: 'Alone' })).toThrow();
  });

  it('puts branches on both sides without overlaps', () => {
    const root = {
      label: 'root',
      children: ['a', 'b', 'c', 'd'].map((label) => ({ label, children: [{ label: `${label}1` }, { label: `${label}2` }] })),
    };
    const placed = layoutMindMap(root, () => ({ width: 100, height: 40 }), { levelGap: 50, siblingGap: 10 });
    expect(placed).toHaveLength(13);
    expect(placed[0]).toMatchObject({ x: 0, y: 0, depth: 0 });

    const branches = placed.filter((p) => p.depth === 1);
    expect(branches.filter((p) => p.side === 1)).toHaveLength(2);
    expect(branches.filter((p) => p.side === -1)).toHaveLength(2);
    expect(new Set(placed.filter((p) => p.depth > 0).map((p) => p.branch))).toEqual(new Set([0, 1, 2, 3]));

    for (const p of placed) {
      if (p.parent >= 0) {
        // Children are further out than their parent, on the same side.
        expect(Math.abs(p.x)).toBeGreaterThan(Math.abs(placed[p.parent].x));
        expect(Math.sign(p.x)).toBe(p.side);
      }
      for (const q of placed) {
        if (p === q) continue;
        const overlap = Math.abs(p.x - q.x) < (p.width + q.width) / 2 && Math.abs(p.y - q.y) < (p.height + q.height) / 2;
        expect(overlap).toBe(false);
      }
    }
  });
});
