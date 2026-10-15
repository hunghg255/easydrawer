import { describe, expect, it } from 'vitest';

import { Vec2 } from '~/math';

import { arrowEnds, assignSides, validateDiagram } from './EditorAI';
import layoutGraph from './layoutGraph';
import parseAIJSON, { parsePartialAIJSON } from './parseJSON';
import { AIError, readTextStream } from './types';

describe('parseAIJSON', () => {
  it('reads JSON wrapped in text and code fences', () => {
    expect(parseAIJSON('Sure!\n```json\n{"a": 1}\n```\nHope this helps')).toEqual({ a: 1 });
    expect(parseAIJSON('{"nested": {"b": [1, 2]}}')).toEqual({ nested: { b: [1, 2] } });
  });

  it('throws AIError when there is no valid JSON', () => {
    expect(() => parseAIJSON('I cannot do that')).toThrow(AIError);
    expect(() => parseAIJSON('{ not json }')).toThrow(AIError);
  });
});

describe('parsePartialAIJSON', () => {
  it('reads the complete parts of an answer that is still arriving', () => {
    const answer = '```json\n{"direction": "down", "nodes": [{"id": "a", "label": "Log in"}, {"id": "b", "label": "Che';
    expect(parsePartialAIJSON(answer)).toEqual({ direction: 'down', nodes: [{ id: 'a', label: 'Log in' }] });
    expect(parsePartialAIJSON('{"nodes": [{"id": "a", "details": ["x", "y"')).toEqual({ nodes: [] });
    expect(parsePartialAIJSON('{"a": "x, y", "b": ["}"')).toEqual({ a: 'x, y', b: [] });
    expect(parsePartialAIJSON('{"a": "x\\"')).toEqual({});
    expect(parsePartialAIJSON('Thinking…')).toBeNull();
  });

  it('reads a complete answer', () => {
    const answer = '{"label": "Plan", "children": [{"label": "A", "children": [{"label": "A1"}]}]} done';
    expect(parsePartialAIJSON(answer)).toEqual(parseAIJSON(answer));
  });
});

describe('validateDiagram', () => {
  it('cleans up nodes and edges', () => {
    const diagram = validateDiagram({
      direction: 'sideways',
      nodes: [
        { id: 'a', label: 'Start', kind: 'terminal' },
        { id: 'a', label: 'Duplicate id', kind: 'unknown-kind', color: 'rainbow' },
        { label: 'No id' },
      ],
      edges: [
        { from: 'a', to: 'a_' },
        { from: 'a', to: 'missing' },
        { from: 'a', to: 'a' },
      ],
    });

    expect(diagram.direction).toBe('down');
    expect(diagram.nodes.map((n) => n.id)).toEqual(['a', 'a_', 'node-2']);
    expect(diagram.nodes[1]).toMatchObject({ kind: 'process', color: 'blue' });
    expect(diagram.edges).toEqual([{ from: 'a', to: 'a_', label: undefined }]);
  });

  it('rejects answers without nodes', () => {
    expect(() => validateDiagram({ nodes: [] })).toThrow(AIError);
  });
});

describe('layoutGraph', () => {
  const node = (id: string) => ({ id, width: 100, height: 40 });

  it('places each node below the nodes pointing to it', () => {
    const positions = layoutGraph(
      [node('a'), node('b'), node('c'), node('d')],
      [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }],
    );
    const y = (id: string) => positions.get(id)!.y;
    expect(y('a')).toBeLessThan(y('b'));
    expect(y('b')).toBe(y('c'));
    expect(y('d')).toBeGreaterThan(y('b'));
    // Nodes of the same layer don't overlap.
    expect(Math.abs(positions.get('b')!.x - positions.get('c')!.x)).toBeGreaterThanOrEqual(100);
  });

  it('handles cycles and the "right" direction', () => {
    const positions = layoutGraph(
      [node('a'), node('b'), node('c')],
      [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
      { direction: 'right' },
    );
    const x = (id: string) => positions.get(id)!.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });
});

describe('assignSides', () => {
  it('spreads branches and sends back edges around the side', () => {
    const diagram = validateDiagram({
      nodes: [
        { id: 'input', label: 'Input', kind: 'io' },
        { id: 'check', label: 'OK?', kind: 'decision' },
        { id: 'error', label: 'Error' },
        { id: 'done', label: 'Done' },
      ],
      edges: [
        { from: 'input', to: 'check' },
        { from: 'check', to: 'error', label: 'no' },
        { from: 'check', to: 'done', label: 'yes' },
        { from: 'error', to: 'input' },
      ],
    });
    const positions = new Map([
      ['input', { x: 0, y: 0 }],
      ['check', { x: 0, y: 100 }],
      ['error', { x: -100, y: 200 }],
      ['done', { x: 100, y: 200 }],
    ]);
    const sides = assignSides(diagram, positions);
    expect(sides[0]).toEqual({ start: 'bottom', end: 'top' });
    expect(sides[1]).toEqual({ start: 'left', end: 'top' });
    expect(sides[2]).toEqual({ start: 'right', end: 'top' });
    // Back edge: around the left side.
    expect(sides[3]).toEqual({ start: 'left', end: 'left' });
  });
});

describe('arrowEnds', () => {
  it('finds the head of an arrow by its arrowhead', () => {
    // A line from (0, 0) to (100, 0), with an arrowhead at (100, 0), path starting at the head.
    const points = [Vec2.of(100, 0), Vec2.of(90, -6), Vec2.of(90, 6), Vec2.of(100, 0), Vec2.of(0, 0)];
    const [tail, head] = arrowEnds(points);
    expect(tail).toMatchObject({ x: 0, y: 0 });
    expect(head).toMatchObject({ x: 100, y: 0 });
  });
});

describe('readTextStream', () => {
  const streamOf = (chunks: string[], type: string) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': type } },
    );

  it('reads the server-sent events of an OpenAI-compatible API', async () => {
    const seen: string[] = [];
    const event = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
    const response = streamOf([': processing\n\n', event('{"a"'), event(': 1}').slice(0, 10), event(': 1}').slice(10), 'data: [DONE]\n\n'], 'text/event-stream');
    expect(await readTextStream(response, (text) => seen.push(text))).toBe('{"a": 1}');
    expect(seen.at(-1)).toBe('{"a": 1}');
    expect(seen).toContain('{"a"');
  });

  it('reads plain text, and errors in events', async () => {
    expect(await readTextStream(streamOf(['Hel', 'lo'], 'text/plain'))).toBe('Hello');
    await expect(readTextStream(streamOf(['data: {"error": {"message": "rate limited"}}\n\n'], 'text/event-stream'))).rejects.toThrow(AIError);
  });
});
