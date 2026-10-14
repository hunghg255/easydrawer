import { describe, expect, it } from 'vitest';

import { Color4, Mat33, Vec2 } from '~/math';

import AbstractComponent, { componentSVGAttribute, easydrawerSVGAttributesKey, lockedSVGAttribute } from './AbstractComponent';
import StickyNote from './StickyNote';

describe('StickyNote', () => {
  it('survives serialization', () => {
    const note = new StickyNote(Mat33.translation(Vec2.of(10, 20)), {
      text: 'Hello',
      color: Color4.fromHex('#bbf7d0'),
      size: Vec2.of(150, 120),
    });

    const copy = AbstractComponent.deserialize(JSON.stringify(note.serialize())) as StickyNote;
    expect(copy).toBeInstanceOf(StickyNote);
    expect(copy.getText()).toBe('Hello');
    expect(copy.getColor().toHexString()).toBe(note.getColor().toHexString());
    expect(copy.getBBox().topLeft).toMatchObject({ x: 10, y: 20 });
    expect(copy.getSize()).toMatchObject({ x: 150, y: 120 });
  });

  it('grows to fit long text', () => {
    const short = new StickyNote(Mat33.identity, { text: 'Hi' });
    const long = new StickyNote(Mat33.identity, { text: 'word '.repeat(80) });
    expect(short.getSize().y).toBe(200);
    expect(long.getSize().y).toBeGreaterThan(200);
    // The width stays the same: the text wraps.
    expect(long.getSize().x).toBe(200);
  });

  it('saves itself as JSON in its SVG attributes', () => {
    const note = new StickyNote(Mat33.identity, { text: 'Saved' });
    const attrs = note.getLoadSaveData()[easydrawerSVGAttributesKey] as Array<[string, string]>;
    const json = attrs.find(([name]) => name === componentSVGAttribute)![1];
    const loaded = AbstractComponent.deserialize(json) as StickyNote;
    expect(loaded.getText()).toBe('Saved');
  });

  it('rejects invalid data', () => {
    expect(() => StickyNote.deserializeFromJSON({ text: 'x', transform: [1, 2] })).toThrow();
  });
});

describe('locking', () => {
  it('is stored in JSON and SVG attributes', () => {
    const note = new StickyNote(Mat33.identity, { text: 'Locked' });
    expect(note.isEditable()).toBe(true);

    note.setLockedDirectly(true);
    expect(note.isLocked()).toBe(true);
    expect(note.isEditable()).toBe(false);

    const attrs = note.getLoadSaveData()[easydrawerSVGAttributesKey] as Array<[string, string]>;
    expect(attrs).toContainEqual([lockedSVGAttribute, 'true']);

    const copy = AbstractComponent.deserialize(note.serialize());
    expect(copy.isLocked()).toBe(true);
  });
});
