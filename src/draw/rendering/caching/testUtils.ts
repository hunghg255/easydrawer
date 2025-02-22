import { Vec2 } from '~/math';

import RenderingCache from './RenderingCache';
import { type CacheProps } from './types';
import createEditor from '../../testing/createEditor';
import type AbstractRenderer from '../renderers/AbstractRenderer';
import DummyRenderer from '../renderers/DummyRenderer';

type RenderAllocCallback = (renderer: DummyRenderer) => void;

// Override any default test options with [cacheOptions]
export function createCache (onRenderAlloc?: RenderAllocCallback,
  cacheOptions?: Partial<CacheProps>) {
  const editor = createEditor();

  const cache = new RenderingCache({
    createRenderer() {
      const renderer = new DummyRenderer(editor.viewport);
      onRenderAlloc?.(renderer);
      return renderer;
    },
    isOfCorrectType(renderer: AbstractRenderer) {
      return renderer instanceof DummyRenderer;
    },
    blockResolution: Vec2.of(500, 500),
    cacheSize: 500 * 10 * 4,
    maxScale: 2,
    minProportionalRenderTimePerCache: 0,
    minProportionalRenderTimeToUseCache: 0,
    ...cacheOptions,
  });

  return {
    cache,
    editor,
  };
}
