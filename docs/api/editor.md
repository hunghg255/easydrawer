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
| `selection` | What is selected with the select tool. See [below](#selection). |
| `frames` | Named areas of the drawing: slides to present, pages to export. See [below](#frames). |
| `ai` | AI features: `generateDiagram(prompt)`, `editDiagram(instruction)`, `editSelection(instruction)`, `drawDiagram(diagram)`, `drawMermaid(text)`, `toMermaid()`, `generateMindMap(topic)`, `drawMindMap(tree)`, `expandMindMap()`, `diagramFromCode(code)`, `generateChart(prompt)`, `drawChart(chart)`, `generateIllustration(prompt)`, `readDiagram()`, `brainstorm()`, `organizeNotes()`, `runCommand(request)`, `describeScene()`, `requestJSON(messages)`. See [AI features](/guide/ai). |

## Selection

`editor.selection` reads and changes what is selected with the `'select'` tool. Every change can be undone.

```ts
editor.selection.items;               // selected components, bottom to top
editor.selection.set([component]);    // select (switches to the select tool)
editor.selection.selectAll();
editor.selection.clear();

const stop = editor.selection.onChange((items) => placeToolbar(editor.selection.getScreenRect()));
```

| Member | Description |
| --- | --- |
| `items` / `isEmpty` | The selected components |
| `set(components)` / `selectAll()` / `clear()` | Change the selection. Locked components are skipped. |
| `getScreenRect()` | The selection's box in CSS pixels relative to the editor's container (`Rect2`), or `null` |
| `onChange(callback)` | Called when the selection or its position on screen may have changed (selection, edits, undo/redo, zoom, scroll). Returns an unsubscribe function. |
| `setColor(color)` | Recolor the selection (strokes, shapes, text, notes, connectors) |
| `bringToFront()` / `sendToBack()` | Layering |
| `duplicate(offset?)` | Copy the selection, offset by `offset` screen pixels (default `24`), and select the copies |
| `delete()` | Delete the selection |
| `group()` / `ungroup()` / `hasGroups` | Grouped components are selected and moved together |
| `align(edge)` | Align to the selection's `'left'`, `'center'`, `'right'`, `'top'`, `'middle'` or `'bottom'` (groups move as one) |
| `distribute(direction)` | Equal gaps, `'horizontal'` or `'vertical'` (3+ items; the outermost don't move) |
| `lock()` | Lock the selection: locked components can't be selected, moved or erased |
| `unlockAll()` | Unlock everything. Returns the number of unlocked components. |
| `lockedCount` | Number of locked components |

Components also have `isLocked()` / `setLocked(locked)` and `getGroupId()` / `setGroup(groupId | null)`
(commands: `editor.dispatch(component.setLocked(true))`).

## Frames

A frame is a named rectangle (a border with a title above it, grouped and saved with the drawing). Use
frames as the slides of a presentation, or to export parts of a board. Click a frame's border or title to
select it; clicking inside it selects what is in it.

```ts
await editor.frames.add({ title: 'Intro' });         // around most of the visible area
await editor.frames.add({ rect: new Rect2(0, 0, 1600, 900), title: 'Plan' });
await editor.frames.addAroundSelection();             // around the selected items

const frames = editor.frames.list();                  // [{ id, title, rect, parts }], in the order they were added
await editor.frames.goTo(frames[0]);                  // fit the frame to the screen (or goTo(0))
editor.frames.contentsOf(frames[0]);                  // the components inside it
const png = editor.frames.toDataURL(0, { pixelRatio: 2 }); // an image of the frame
```

The [playground](/playground) presents the frames full screen (⋯ → **Present**; arrows, space or a click for the
next one, <kbd>Esc</kbd> to stop) and prints them to a PDF (⋯ → **Frames → PDF**).

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

## Zoom

```ts
editor.zoomIn();        // ×1.25
editor.zoomOut();       // ÷1.25
editor.setZoom(1);      // 100%
editor.zoomToFit();     // show everything that's drawn
editor.getZoom();       // → 1.25

const stop = editor.onZoomChange((zoom) => label.textContent = `${Math.round(zoom * 100)}%`);
```

| Method | Description |
| --- | --- |
| `getZoom()` | Current zoom level (1 = 100%) |
| `setZoom(zoom, screenCenter?)` | Set the zoom, keeping `screenCenter` (default: the middle) in place. Limited by `minZoom`/`maxZoom`. |
| `zoomIn()` / `zoomOut()` | One step in/out |
| `zoomToFit()` | Zoom and scroll so all content is visible |
| `onZoomChange(callback)` | Called when the zoom changes. Returns an unsubscribe function. |

Pinch, Ctrl/⌘ + wheel and keyboard shortcuts also zoom.

## Import & export

| Method | Returns | Description |
| --- | --- | --- |
| `toSVGString(options?)` | `string` | The drawing as SVG markup |
| `toSVG(options?)` | `SVGElement` | The drawing as an SVG element |
| `toDataURL(format?)` | `string` | The drawing as an image data URL (`'image/png'`, `'image/jpeg'`, `'image/webp'`) |
| `loadFromSVG(svg)` | `Promise<void>` | Load a drawing from SVG markup |
| `uploadImages(files)` | `Promise<void>` | Insert image files into the drawing |
| `autosave(options?)` | `Promise<() => void>` | Restore from and keep saving to `localStorage`; returns a function that stops |

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
| `setReadOnly(readOnly)` | Disable editing (panning, zooming and the laser pointer still work) |
| `isReadOnly()` | Whether the editor is read-only |
| `focus()` | Focus the drawing area (for keyboard shortcuts) |
| `remove()` | Remove the editor from the page and release its resources |
| `getRootElement()` | The editor's container element |
| `viewport` | Pan/zoom state and coordinate conversion |
| `image` | The document: add, find and remove components |
| `toolController` | Low-level tool management, palm rejection (`setStylusOnly`) |
