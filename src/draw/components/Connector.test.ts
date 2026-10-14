import { describe, expect, it } from 'vitest';

import { Mat33, Vec2 } from '~/math';

import AbstractComponent from './AbstractComponent';
import Connector from './Connector';
import StickyNote from './StickyNote';
import type EditorImage from '../image/EditorImage';

// The connector only needs `lookupElement` from the image.
function fakeImage (...components: AbstractComponent[]) {
  return {
    lookupElement: (id: string) => components.find((c) => c.getId() === id) ?? null,
  } as unknown as EditorImage;
}

function note (x: number, y: number) {
  return new StickyNote(Mat33.translation(Vec2.of(x, y)), { size: Vec2.of(100, 100) });
}

describe('Connector', () => {
  it('attaches its ends to the edges of components', () => {
    const a = note(0, 0);
    const b = note(300, 0);
    const connector = new Connector(
      { point: Vec2.zero, targetId: a.getId() },
      { point: Vec2.zero, targetId: b.getId() },
    );
    connector.updateEnds(fakeImage(a, b));

    const start = connector.getStart().point;
    const end = connector.getEnd().point;
    // Right edge of `a` and left edge of `b`, plus a small gap.
    expect(start.x).toBeGreaterThan(100);
    expect(start.x).toBeLessThan(110);
    expect(end.x).toBeLessThan(300);
    expect(end.x).toBeGreaterThan(290);
    expect(start.y).toBeCloseTo(50);
    expect(end.y).toBeCloseTo(50);
  });

  it('follows components when they move', () => {
    const a = note(0, 0);
    const b = note(300, 0);
    const connector = new Connector(
      { point: Vec2.zero, targetId: a.getId() },
      { point: Vec2.zero, targetId: b.getId() },
    );
    const image = fakeImage(a, b);
    connector.updateEnds(image);

    (b as any).applyTransformation(Mat33.translation(Vec2.of(0, 400)));
    expect(connector.updateEnds(image)).toBe(true);
    // Now pointing down: the end is on the top edge of `b`.
    expect(connector.getEnd().point.y).toBeLessThan(400);
    expect(connector.getEnd().point.y).toBeGreaterThan(380);
    expect(connector.updateEnds(image)).toBe(false);
  });

  it('keeps the last position of an end when its component is removed', () => {
    const a = note(0, 0);
    const connector = new Connector({ point: Vec2.zero, targetId: a.getId() }, { point: Vec2.of(500, 50) });
    connector.updateEnds(fakeImage(a));
    const start = connector.getStart().point;

    connector.updateEnds(fakeImage());
    expect(connector.getStart().point).toEqual(start);
  });

  it('survives serialization and remaps IDs', () => {
    const connector = new Connector(
      { point: Vec2.of(1, 2), targetId: 'old-a' },
      { point: Vec2.of(3, 4), targetId: 'unknown' },
      { arrow: 'both', thickness: 3 },
    );
    const copy = AbstractComponent.deserialize(connector.serialize()) as Connector;
    expect(copy.getConnectorStyle()).toMatchObject({ arrow: 'both', thickness: 3 });
    expect(copy.getStart()).toMatchObject({ targetId: 'old-a' });

    copy.remapReferences(new Map([['old-a', 'new-a']]));
    expect(copy.getStart().targetId).toBe('new-a');
    // IDs that weren't loaded are dropped.
    expect(copy.getEnd().targetId).toBeUndefined();
  });

  it('rejects invalid data', () => {
    expect(() => Connector.deserializeFromJSON({ start: { point: ['a'] }, end: {} })).toThrow();
  });
});
