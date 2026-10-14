# Editor

```ts
import { Editor } from 'easydrawer';

const editor = new Editor(parentElement, settings?);
```

Creates an editor inside `parentElement`. See [Settings](./settings) for the options.

## Tools

| Member | Description |
| --- | --- |
| `tools` | Named access to the built-in tools. See [editor.tools](./tools). |

## History

| Method | Description |
| --- | --- |
| `undo()` | Undo the last action |
| `redo()` | Redo the last undone action |
| `canUndo()` / `canRedo()` | Whether there is something to undo / redo |
| `clear()` | Remove everything except the background (undoable) |
| `history` | The underlying `UndoRedoHistory` |

## Background

```ts
editor.setBackground({ type: 'grid' });           // 'none' | 'solid' | 'grid' | 'dot'
editor.setBackground({ color: '#fffbea' });       // keep the type, change the color
editor.setBackground({ type: 'dot', color: 'white' });
```

| Method | Description |
| --- | --- |
| `setBackground(options)` | Change the background type and/or color (undoable) |
| `estimateBackgroundColor()` | Current background color, as a `Color4` |

## Import & export

| Method | Returns | Description |
| --- | --- | --- |
| `toSVGString(options?)` | `string` | The drawing as SVG markup |
| `toSVG(options?)` | `SVGElement` | The drawing as an SVG element |
| `toDataURL(format?)` | `string` | The drawing as an image data URL (`'image/png'`, `'image/jpeg'`, `'image/webp'`) |
| `loadFromSVG(svg)` | `Promise<void>` | Load a drawing from SVG markup |
| `uploadImages(files)` | `Promise<void>` | Insert image files into the drawing |

## Events

```ts
const stop = editor.onChange(() => console.log('changed'));
stop(); // remove the listener
```

| Method | Description |
| --- | --- |
| `onChange(callback)` | Called after every change to the drawing (including undo/redo). Returns an unsubscribe function. |
| `tools.onChange(callback)` | Called when the active tool changes. |
| `notifier` | Low-level event dispatcher (`EditorEventType`) for everything else. |

## Other

| Member | Description |
| --- | --- |
| `setReadOnly(readOnly)` | Disable editing (panning and zooming still work) |
| `focus()` | Focus the drawing area (for keyboard shortcuts) |
| `remove()` | Remove the editor from the page and release its resources |
| `getRootElement()` | The editor's container element |
| `viewport` | Pan/zoom state and coordinate conversion |
| `image` | The document: add, find and remove components |
| `toolController` | Low-level tool management, palm rejection (`setStylusOnly`) |
