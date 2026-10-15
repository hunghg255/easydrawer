import { describe, expect, it } from 'vitest';

import { Color4, Path } from '~/math';

import { pathFromRenderable, pathToRenderable } from './RenderablePathSpec';
import { sketchParts, sketchPath, sketchSeedOf } from './sketch';
import TextComponent from '../components/TextComponent';

const square = Path.fromString('M0,0 L100,0 L100,60 L0,60 Z');

describe('sketchPath', () => {
  it('draws a wobbly outline close to the path', () => {
    const parts = sketchPath(square, { fill: Color4.transparent, stroke: { color: Color4.black, width: 2 } }, { seed: 1 });
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(part.style.stroke?.color).toEqual(Color4.black);
      const box = part.path.bbox;
      expect(box.x).toBeGreaterThan(-10);
      expect(box.x + box.w).toBeLessThan(110);
    }
    const bbox = parts.map((part) => part.path.bbox).reduce((a, b) => a.union(b));
    expect(bbox.w).toBeGreaterThan(90);
    expect(bbox.h).toBeGreaterThan(50);
  });

  it('is the same with the same seed', () => {
    const style = { fill: Color4.transparent, stroke: { color: Color4.black, width: 2 } };
    const a = sketchPath(square, style, { seed: 42 }).map((part) => part.path.toString());
    const b = sketchPath(square, style, { seed: 42 }).map((part) => part.path.toString());
    const c = sketchPath(square, style, { seed: 43 }).map((part) => part.path.toString());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('fills with lines (hachure) or solid', () => {
    const style = { fill: Color4.fromHex('#fde68a'), stroke: { color: Color4.black, width: 2 } };
    const hachure = sketchPath(square, style, { seed: 1 });
    // Fill lines are strokes in the fill color.
    expect(hachure.some((part) => part.style.stroke?.color.eq(style.fill))).toBe(true);

    const solid = sketchPath(square, style, { seed: 1, fillStyle: 'solid' });
    expect(solid.some((part) => part.style.fill.eq(style.fill))).toBe(true);
  });

  it('works at any zoom (scale)', () => {
    const scaled = Path.fromString('M0,0 L10,0 L10,6 L0,6 Z');
    const parts = sketchPath(scaled, { fill: Color4.transparent, stroke: { color: Color4.black, width: 0.2 } }, { seed: 1, scale: 0.1 });
    const bbox = parts.map((part) => part.path.bbox).reduce((a, b) => a.union(b));
    // As wobbly as the big square, but 10× smaller.
    expect(bbox.w).toBeGreaterThan(9);
    expect(bbox.w).toBeLessThan(11);
  });

  it('sketches every part of a stroke', () => {
    const parts = sketchParts(
      [
        pathToRenderable(square, { fill: Color4.transparent, stroke: { color: Color4.red, width: 2 } }),
        pathToRenderable(Path.fromString('M0,100 L100,100'), { fill: Color4.transparent, stroke: { color: Color4.blue, width: 2 } }),
      ],
      { seed: 5 },
    );
    expect(parts.some((part) => part.style.stroke?.color.eq(Color4.red))).toBe(true);
    expect(parts.some((part) => part.style.stroke?.color.eq(Color4.blue))).toBe(true);
    expect(pathFromRenderable(parts[0]).bbox.w).toBeGreaterThan(0);
  });

  it('gives a stable seed for a string', () => {
    expect(sketchSeedOf('abc')).toBe(sketchSeedOf('abc'));
    expect(sketchSeedOf('abc')).not.toBe(sketchSeedOf('abd'));
    expect(sketchSeedOf('')).toBeGreaterThan(0);
  });
});

describe('TextComponent.applyTextStyles', () => {
  it('quotes each font family of a list', () => {
    const ctx = { font: '', textAlign: '' } as unknown as CanvasRenderingContext2D;
    TextComponent.applyTextStyles(ctx, {
      size: 20,
      fontFamily: '"Patrick Hand", Comic Sans MS, sans-serif',
      renderingStyle: { fill: Color4.black },
    });
    expect(ctx.font.trim()).toBe('20px "Patrick Hand", "Comic Sans MS", sans-serif');

    TextComponent.applyTextStyles(ctx, { size: 12, fontFamily: 'Times New Roman', renderingStyle: { fill: Color4.black } });
    expect(ctx.font.trim()).toBe('12px "Times New Roman"');
  });
});
