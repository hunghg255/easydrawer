import { AIError } from './types';

/** A topic of a mind map, and its sub-topics. */
export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
  /** For the branches of the central topic: the side it is on. Default: chosen to balance both sides. */
  side?: 'left' | 'right';
}

/** A node of a mind map placed by {@link layoutMindMap}. */
export interface PlacedMindMapNode {
  node: MindMapNode;
  /** 0 for the central topic. */
  depth: number;
  /** Index of the parent in the result, `-1` for the central topic. */
  parent: number;
  /** Which side of the central topic the node is on (`0` for the central topic). */
  side: -1 | 0 | 1;
  /** Index of the main branch the node is in (`-1` for the central topic). */
  branch: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindMapLayoutOptions {
  /** Horizontal space between a node and its children. */
  levelGap: number;
  /** Vertical space between sibling subtrees. */
  siblingGap: number;
}

const maxDepth = 3;
const maxChildren = 8;
const maxNodes = 60;

/** Checks and cleans up a mind map returned by an AI. @internal */
export function validateMindMap (json: any): MindMapNode {
  let count = 0;
  const clean = (raw: any, depth: number): MindMapNode | null => {
    const label = String((typeof raw === 'string' ? raw : (raw?.label ?? raw?.topic ?? raw?.root ?? raw?.text)) ?? '')
      .trim()
      .slice(0, 80);
    if (!label || count >= maxNodes) return null;
    count++;
    const rawChildren: unknown[] = Array.isArray(raw?.children) ? raw.children : [];
    const children =
      depth < maxDepth
        ? rawChildren
          .slice(0, maxChildren)
          .map((child) => clean(child, depth + 1))
          .filter((child): child is MindMapNode => child !== null)
        : [];
    return children.length > 0 ? { label, children } : { label };
  };

  const root = clean(json?.mindMap ?? json?.mindmap ?? json, 0);
  if (!root?.children?.length) {
    throw new AIError('The AI did not return a mind map.');
  }
  return root;
}

/**
 * Lays out a mind map: the central topic at (0, 0), its branches split between the right and
 * the left, and each level of sub-topics in a column further out.
 *
 * @param size the size of a node's box.
 */
export default function layoutMindMap (
  root: MindMapNode,
  size: (node: MindMapNode, depth: number) => { width: number; height: number },
  options: MindMapLayoutOptions,
): PlacedMindMapNode[] {
  const sizes = new Map<MindMapNode, { width: number; height: number }>();
  const sizeOf = (node: MindMapNode, depth: number) => {
    let result = sizes.get(node);
    if (!result) {
      result = size(node, depth);
      sizes.set(node, result);
    }
    return result;
  };

  // Height of a node and everything under it.
  const heights = new Map<MindMapNode, number>();
  const subtreeHeight = (node: MindMapNode, depth: number): number => {
    const children = node.children ?? [];
    const childrenHeight =
      children.reduce((total, child) => total + subtreeHeight(child, depth + 1), 0) +
      Math.max(0, children.length - 1) * options.siblingGap;
    const height = Math.max(sizeOf(node, depth).height, childrenHeight);
    heights.set(node, height);
    return height;
  };

  const rootSize = sizeOf(root, 0);
  const result: PlacedMindMapNode[] = [
    { node: root, depth: 0, parent: -1, side: 0, branch: -1, x: 0, y: 0, ...rootSize },
  ];

  // Split the branches between the right and left, with about the same height on each side.
  const branches = root.children ?? [];
  const branchHeights = branches.map((branch) => subtreeHeight(branch, 1));
  const total = branchHeights.reduce((a, b) => a + b, 0);
  let rightCount = 0;
  let rightHeight = 0;
  while (rightCount < branches.length && (rightCount === 0 || rightHeight + branchHeights[rightCount] / 2 <= total / 2)) {
    rightHeight += branchHeights[rightCount];
    rightCount++;
  }

  const place = (node: MindMapNode, depth: number, parent: number, side: -1 | 1, branch: number, edge: number, centerY: number) => {
    const { width, height } = sizeOf(node, depth);
    const x = edge + side * (options.levelGap + width / 2);
    const index = result.length;
    result.push({ node, depth, parent, side, branch, x, y: centerY, width, height });
    placeChildren(node.children ?? [], depth + 1, index, side, branch, x + (side * width) / 2, centerY);
  };
  const placeChildren = (children: MindMapNode[], depth: number, parent: number, side: -1 | 1, branch: number, edge: number, centerY: number) => {
    const heightOf = (child: MindMapNode) => heights.get(child) ?? subtreeHeight(child, depth);
    const childrenHeight =
      children.reduce((sum, child) => sum + heightOf(child), 0) + Math.max(0, children.length - 1) * options.siblingGap;
    let top = centerY - childrenHeight / 2;
    for (const child of children) {
      const height = heightOf(child);
      place(child, depth, parent, side, branch === -1 ? children.indexOf(child) + (side === -1 ? rightCount : 0) : branch, edge, top + height / 2);
      top += height + options.siblingGap;
    }
  };

  // Branches with a side stay on it.
  const fixedSides = branches.every((branch) => branch.side);
  const right = fixedSides ? branches.filter((b) => b.side === 'right') : branches.slice(0, rightCount);
  const left = fixedSides ? branches.filter((b) => b.side === 'left') : branches.slice(rightCount);
  rightCount = right.length;
  placeChildren(right, 1, 0, 1, -1, rootSize.width / 2, 0);
  // Left branches from top to bottom too.
  placeChildren(left, 1, 0, -1, -1, -rootSize.width / 2, 0);
  return result;
}
