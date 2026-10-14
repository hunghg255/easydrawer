import { describe, expect, it } from 'vitest';

import { Mat33, Vec2 } from '~/math';

import AbstractComponent, { easydrawerSVGAttributesKey, groupSVGAttribute } from './AbstractComponent';
import StickyNote from './StickyNote';

function note () {
  return new StickyNote(Mat33.translation(Vec2.of(0, 0)), { text: 'x' });
}

describe('groups', () => {
  it('are stored in JSON and SVG attributes', () => {
    const a = note();
    a.setGroupDirectly('group-1');

    const attrs = a.getLoadSaveData()[easydrawerSVGAttributesKey] as Array<[string, string]>;
    expect(attrs).toContainEqual([groupSVGAttribute, 'group-1']);
    expect(AbstractComponent.deserialize(a.serialize()).getGroupId()).toBe('group-1');
  });

  it('copies of a group form a new group', () => {
    const a = note();
    const b = note();
    const c = note();
    a.setGroupDirectly('group-1');
    b.setGroupDirectly('group-1');

    const originals = [a, b, c];
    const copies = originals.map((item) => item.clone());
    AbstractComponent.regroupCopies(originals, copies);

    expect(copies[0].getGroupId()).not.toBeNull();
    expect(copies[0].getGroupId()).not.toBe('group-1');
    expect(copies[1].getGroupId()).toBe(copies[0].getGroupId());
    expect(copies[2].getGroupId()).toBeNull();
  });

  it('previews keep the ID and apply the transform', () => {
    const a = note();
    const preview = a.transformedPreview(Mat33.translation(Vec2.of(50, 0)));
    expect(preview.getId()).toBe(a.getId());
    expect(preview.getBBox().x).toBeCloseTo(a.getBBox().x + 50);
    // The original doesn't move.
    expect(a.getBBox().x).toBeCloseTo(0);
  });
});
