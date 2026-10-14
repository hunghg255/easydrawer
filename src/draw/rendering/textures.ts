import { type Color4 } from '~/math';

// Size (in texels) of the repeating texture tile.
const tileSize = 128;

let pencilGrain: Uint8ClampedArray | null = null;

// A tileable grain mask (alpha values in 0–255): mostly opaque, with lighter
// specks and streaks, like graphite on paper.
function getPencilGrain(): Uint8ClampedArray {
  if (pencilGrain) return pencilGrain;

  // Small deterministic PRNG, so the texture is the same on every load.
  let seed = 1234567;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  // Tileable value noise on a coarse grid
  const cells = 32;
  const grid = Array.from({ length: cells * cells }, random);
  const coarse = (x: number, y: number) => {
    const gx = (x / tileSize) * cells;
    const gy = (y / tileSize) * cells;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const at = (cx: number, cy: number) => grid[(cy % cells) * cells + (cx % cells)];
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  const alpha = new Uint8ClampedArray(tileSize * tileSize);
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const fine = random();
      const value = 0.35 * coarse(x, y) + 0.65 * fine;
      // Map to mostly-opaque grain with some light specks
      const opacity = Math.min(1, Math.max(0.15, 1.35 - value * 0.95));
      alpha[y * tileSize + x] = Math.round(opacity * 255);
    }
  }

  pencilGrain = alpha;
  return alpha;
}

const patternCache = new Map<string, CanvasPattern>();
const maxCachedPatterns = 32;

/**
 * Returns a repeating pattern of `color` with pencil grain, or `null` if patterns
 * aren't supported (e.g. no canvas available).
 */
export function getPencilPattern(ctx: CanvasRenderingContext2D, color: Color4): CanvasPattern | null {
  const key = color.toHexString();
  const cached = patternCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return null;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;

  const grain = getPencilGrain();
  const image = tileCtx.createImageData(tileSize, tileSize);
  const [r, g, b] = [color.r, color.g, color.b].map((c) => Math.round(c * 255));
  for (const [i, alpha] of grain.entries()) {
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = alpha * color.a;
  }
  tileCtx.putImageData(image, 0, 0);

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return null;

  if (patternCache.size >= maxCachedPatterns) {
    patternCache.delete(patternCache.keys().next().value!);
  }
  patternCache.set(key, pattern);
  return pattern;
}

/** SVG `<filter>` id used for pencil textures in exported SVGs. */
export const pencilFilterId = 'easydrawer-pencil-texture';

/** Creates the SVG `<filter>` that gives fills a pencil grain. */
export function createPencilFilter(svgNamespace: string): Element {
  const filter = document.createElementNS(svgNamespace, 'filter');
  filter.setAttribute('id', pencilFilterId);
  filter.setAttribute('x', '-2%');
  filter.setAttribute('y', '-2%');
  filter.setAttribute('width', '104%');
  filter.setAttribute('height', '104%');

  const turbulence = document.createElementNS(svgNamespace, 'feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.9');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', '7');
  turbulence.setAttribute('result', 'noise');

  // Turn the noise into an alpha mask: mostly opaque, with lighter specks.
  const toAlpha = document.createElementNS(svgNamespace, 'feColorMatrix');
  toAlpha.setAttribute('in', 'noise');
  toAlpha.setAttribute('type', 'matrix');
  toAlpha.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.4 0 0 0 1.6');
  toAlpha.setAttribute('result', 'grain');

  const apply = document.createElementNS(svgNamespace, 'feComposite');
  apply.setAttribute('in', 'SourceGraphic');
  apply.setAttribute('in2', 'grain');
  apply.setAttribute('operator', 'in');

  filter.append(turbulence, toAlpha, apply);
  return filter;
}
