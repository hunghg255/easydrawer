import { describe, expect, it } from 'vitest';

import { Color4 } from '~/math';

import { styleFromJSON, stylesEqual, styleToJSON } from './RenderingStyle';

describe('RenderingStyle', () => {
  it('should keep the texture through JSON', () => {
    const style = { fill: Color4.red, texture: 'pencil' as const };
    const restored = styleFromJSON(JSON.parse(JSON.stringify(styleToJSON(style))));

    expect(restored.texture).toBe('pencil');
    expect(stylesEqual(style, restored)).toBe(true);
  });

  it('should treat textured and plain fills as different styles', () => {
    expect(stylesEqual({ fill: Color4.red }, { fill: Color4.red, texture: 'pencil' })).toBe(false);
    expect(styleToJSON({ fill: Color4.red })).not.toHaveProperty('texture');
  });
});
