# Tablets & stylus

EasyDrawer is designed to be used on iPad and Android tablets, with or without a stylus.

## Palm rejection

When you write with a stylus, your palm touches the screen too. The `input.stylusOnly` setting decides what
fingers do:

| Value | Fingers |
| --- | --- |
| `'auto'` (default) | Draw — until a stylus is used. From then on, they only pan and zoom. |
| `true` | Never draw; only pan and zoom. |
| `false` | Always draw. |

```ts
const editor = new Editor(element, { input: { stylusOnly: 'auto' } });

// Change it at runtime, e.g. from a "Draw with finger" toggle
editor.toolController.setStylusOnly(false);
editor.toolController.isStylusOnly();
```

A stroke drawn with a stylus is never interrupted by an accidental touch.

## Gestures

| Gesture | Action |
| --- | --- |
| Two-finger drag | Pan |
| Pinch | Zoom (and rotate, snapping to 90°) |
| One-finger drag | Draw, or pan when `stylusOnly` is active |
| Stylus eraser end | Erase |

On the drawing area, EasyDrawer turns off the browser behaviors that get in the way of drawing: Safari's
page pinch-zoom, text selection, the long-press menu and the magnifier, the tap highlight, and scroll bounce.

## Page setup

For a full-screen drawing app, also lock the page zoom and use the whole screen:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

```css
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
}
```

## Touch-friendly toolbars

Apple recommends touch targets of at least 44×44 pt. Make your buttons bigger on touch screens only:

```css
.tool-button { width: 36px; height: 36px; }

@media (pointer: coarse) {
  .tool-button { width: 44px; height: 44px; }
}
```

Use `touch-action: manipulation` on buttons to remove the double-tap delay.

The [playground](/playground) follows all of these recommendations — open it on a tablet to try it.
