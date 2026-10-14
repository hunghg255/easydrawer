# Natural ink

The default pen style, `'natural'`, aims to look and feel like a real pen.

<ClientOnly>
  <DrawingDemo :settings="{ tools: { pen: { thickness: 4 } } }" hint="Try writing fast, then slowly" />
</ClientOnly>

## How it works

1. **Every sample counts.** A stylus such as the Apple Pencil reports positions 240 times per second, but browsers
   only fire `pointermove` once per frame. EasyDrawer reads the merged samples back with
   `getCoalescedEvents()`, and keeps sub-pixel precision.
2. **Pressure → width.** With a stylus, the width follows the real pressure. Mice and fingers have no pressure,
   so it is simulated from speed: fast movements draw thinner lines, slow ones thicker — like a fountain pen.
   Pressure is smoothed over time so the width never jumps.
3. **Smoothing without lag.** Hand jitter is removed with a *symmetric* smoothing pass. Unlike the usual
   "follow the pointer with a delay" approach, it doesn't cut or hook corners, sharp corners stay sharp, and the
   tip of the stroke stays exactly under the pointer.
4. **Low latency.** Where the browser supports it, the stroke is drawn slightly ahead to where the pen is
   predicted to go next (`getPredictedEvents()`), hiding a frame of lag. Predicted points are never saved.
5. **One outline per stroke.** The stroke is drawn as one filled shape with round caps and joins, so
   semi-transparent colors look even, with no dark spots where the stroke overlaps itself.

## Shape recognition

Draw a rough line, circle or rectangle and **keep the pen still for half a second** before lifting it: the
stroke snaps to a clean straight line, circle/ellipse or rectangle. Lift without pausing to keep it hand-drawn.

```ts
editor.tools.configure('pen', { autocorrect: false }); // turn it off
```

## Styles

| Style | Look |
| --- | --- |
| `'natural'` | Ink with pressure (default pen) |
| `'marker'` | Smooth, constant width (default highlighter) |
| `'flat-tip'` | Older pressure-sensitive pen |
| `'round-tip'` | Constant-width line |
| `'polyline'` | Straight segments between points |

```ts
editor.tools.configure('pen', { style: 'round-tip' });
```

## Custom brushes

Create your own variant with `naturalPenBuilderFactory`:

```ts
import { naturalPenBuilderFactory } from 'easydrawer';

const brushPen = naturalPenBuilderFactory({
  thinning: 0.85,         // 0 = constant width, 1 = width follows pressure strongly
  simulatedThinning: 0.6, // the same, for mouse/finger (pressure simulated from speed)
  smoothing: 0.6,         // 0 = raw input, 1 = very smooth
  taperStart: 2,          // tapered start, in stroke widths
  taperEnd: 5,            // tapered end, in stroke widths
});

editor.tools.configure('pen', { style: brushPen, thickness: 6 });
```

<ClientOnly>
  <DrawingDemo :settings="{ tools: { pen: { thickness: 7, color: '#7c3aed' } } }" hint="Brush-like settings" />
</ClientOnly>

| Option | Default | Description |
| --- | --- | --- |
| `thinning` | `0.6` | How much stylus pressure changes the width |
| `simulatedThinning` | `0.4` | How much speed changes the width (mouse, finger) |
| `simulatePressure` | `true` | Simulate pressure when the device has none |
| `smoothing` | `0.5` | Jitter removal |
| `taperStart` | `0` | Taper at the start, as a multiple of the width |
| `taperEnd` | `0` | Taper at the end, as a multiple of the width |
