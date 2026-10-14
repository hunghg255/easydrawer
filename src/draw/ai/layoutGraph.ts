export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutOptions {
  /** `'down'`: rows from top to bottom. `'right'`: columns from left to right. */
  direction?: 'down' | 'right';
  /** Space between nodes of the same layer. Default: `60`. */
  nodeGap?: number;
  /** Space between layers. Default: `90`. */
  layerGap?: number;
}

/**
 * Positions the nodes of a directed graph in layers (a simple Sugiyama-style layout):
 * each node is placed one layer after the nodes pointing to it, and nodes in a layer are
 * ordered to reduce crossings. Cycles are allowed.
 *
 * @returns the center of each node, by ID. The layout is centered on (0, 0).
 */
export default function layoutGraph (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const direction = options.direction ?? 'down';
  const nodeGap = options.nodeGap ?? 60;
  const layerGap = options.layerGap ?? 90;
  const ids = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);

  const outgoing = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of validEdges) {
    outgoing.get(edge.from)!.push(edge.to);
  }

  // Ignore edges that close a cycle (found with a depth-first search).
  const forwardEdges: LayoutEdge[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'visiting');
    for (const next of outgoing.get(id)!) {
      if (state.get(next) === 'visiting') continue;
      forwardEdges.push({ from: id, to: next });
      if (!state.has(next)) visit(next);
    }
    state.set(id, 'done');
  };
  const hasIncoming = new Set(validEdges.map((e) => e.to));
  for (const node of nodes) {
    if (!hasIncoming.has(node.id) && !state.has(node.id)) visit(node.id);
  }
  for (const node of nodes) {
    if (!state.has(node.id)) visit(node.id);
  }

  // Layer = length of the longest path to the node.
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let changed = true, rounds = 0; changed && rounds <= nodes.length; rounds++) {
    changed = false;
    for (const { from, to } of forwardEdges) {
      if (layer.get(to)! < layer.get(from)! + 1) {
        layer.set(to, layer.get(from)! + 1);
        changed = true;
      }
    }
  }

  const layerCount = Math.max(0, ...layer.values()) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const node of nodes) {
    layers[layer.get(node.id)!].push(node.id);
  }

  // Order each layer by the average position of the nodes pointing to it.
  const order = new Map<string, number>();
  for (const [i, id] of layers[0].entries()) order.set(id, i);
  for (const ids of layers.slice(1)) {
    const parentPosition = (id: string) => {
      const parents = forwardEdges.filter((e) => e.to === id).map((e) => order.get(e.from) ?? 0);
      return parents.length > 0 ? parents.reduce((a, b) => a + b, 0) / parents.length : 0;
    };
    ids.sort((a, b) => parentPosition(a) - parentPosition(b));
    for (const [i, id] of ids.entries()) order.set(id, i);
  }

  const size = new Map(nodes.map((n) => [n.id, n]));
  // Along the layer (x when going down) and across layers (y when going down).
  const along = (id: string) => (direction === 'down' ? size.get(id)!.width : size.get(id)!.height);
  const across = (id: string) => (direction === 'down' ? size.get(id)!.height : size.get(id)!.width);

  const result = new Map<string, { x: number; y: number }>();
  const layerDepths = layers.map((ids) => Math.max(0, ...ids.map(across)));
  const totalDepth = layerDepths.reduce((a, b) => a + b, 0) + layerGap * (layers.length - 1);

  let depth = -totalDepth / 2;
  for (const [i, ids] of layers.entries()) {
    const totalLength = ids.reduce((sum, id) => sum + along(id), 0) + nodeGap * (ids.length - 1);
    let position = -totalLength / 2;
    const center = depth + layerDepths[i] / 2;
    for (const id of ids) {
      const middle = position + along(id) / 2;
      result.set(id, direction === 'down' ? { x: middle, y: center } : { x: center, y: middle });
      position += along(id) + nodeGap;
    }
    depth += layerDepths[i] + layerGap;
  }

  return result;
}
