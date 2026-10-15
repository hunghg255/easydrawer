# AI features

EasyDrawer can ask a language model to draw for you:

- **Text → diagram**: describe a process, a flowchart or an architecture, and get shapes with text and arrows
  that stay attached to them. Decisions get labeled branches ("yes" / "no").
- **Edit a diagram with words**: "add a step to send a confirmation email after the payment".
- **Code / SQL → diagram**: paste SQL tables (→ ER diagram), classes (→ class diagram) or a function
  (→ flowchart).
- **Mind maps**: a topic → a colored mind map; select a topic and **grow** it with more ideas.
- **Mermaid** (no AI needed): paste a Mermaid flowchart, ER or class diagram to draw it, and export any diagram
  as Mermaid for GitHub, Notion or Obsidian.
- **Charts**: "sales per quarter, 2023 vs 2024" → a bar, line or pie chart with labels and a legend.
- **Pictures**: "a cat sleeping on a laptop" → a simple illustration made of editable shapes.
- **Brainstorm**: ideas about a sticky note, as new notes around it.
- **Organize sticky notes**: after a brainstorm, sort the notes into themed, colored columns with titles.
- **Commands**: ask for anything in plain language — "color the notes about marketing in blue", "align the
  selected shapes and group them", "what is missing in this flowchart?". In the playground: <kbd>Ctrl/⌘ K</kbd>.

Everything the AI adds or moves is a single step in the undo history, and is made of normal shapes, text,
notes and connectors that you can keep editing. Diagrams, mind maps and charts are [drawn step by step while the
answer arrives](#streaming) when your server streams it. Try it in the [playground](/playground) (the ✨ **AI**
button).

## Setup

EasyDrawer doesn't call any AI service itself. You give it a function that sends chat messages to a model and
returns the answer — usually through **your own server**, which adds the API key.

::: warning Keep API keys on the server
Never put an API key in browser code: anyone can read it. Call your own endpoint, which forwards the request.
:::

```ts
const editor = new Editor(element, {
  ai: {
    request: async ({ messages, signal }) => {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data.content;
    },
  },
});

// Later, or instead of the setting:
editor.ai.setRequestHandler(myHandler);
```

The server side can use `openAICompatibleRequest`, which works with any OpenAI-compatible API (OpenAI,
OpenRouter, Groq, Ollama, LM Studio…):

```ts
// e.g. api/ai.ts (Vercel, Netlify, Express…)
import { openAICompatibleRequest } from 'easydrawer';

const request = openAICompatibleRequest({
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: process.env.OPENROUTER_MODEL!,
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  // Validate `messages` (length, roles…) before forwarding them.
  return Response.json({ content: await request({ messages, json: true }) });
}
```

The playground's own function is in [`api/ai.js`](https://github.com/hunghg255/easydrawer/blob/main/api/ai.js).

## Streaming: drawn while the answer arrives {#streaming}

Models take a few seconds (sometimes more) to write a whole diagram. If the answer is **streamed**,
`generateDiagram`, `diagramFromCode`, `generateMindMap` and `generateChart` draw it step by step: the shapes appear
as soon as they are written, then the arrows, and a mind map grows branch by branch. The preview isn't part of the
drawing or of the undo history; at the end it's replaced by the finished result (one undo step, selected).
Streaming also avoids server timeouts with slow models, since data keeps arriving.

The request handler gets an `onText` callback when the answer can be streamed: call it with **all the text so
far** each time more arrives, and still return the whole text at the end. `readTextStream(response, onText)` does
that for a `fetch` response, reading either plain text chunks or the server-sent events of an OpenAI-compatible
API:

```ts
import { readTextStream } from 'easydrawer';

const editor = new Editor(element, {
  ai: {
    request: async ({ messages, signal, onText }) => {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: !!onText }),
        signal,
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (onText && response.body) return readTextStream(response, onText);
      return (await response.json()).content;
    },
  },
});
```

On the server, ask the API for a stream (`"stream": true`) and pass its body on:

```ts
export async function POST(req: Request) {
  const { messages, stream } = await req.json();
  // Validate `messages` first.
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, messages, stream }),
  });
  if (stream && response.ok) {
    return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  const data = await response.json();
  return Response.json({ content: data.choices?.[0]?.message?.content });
}
```

`openAICompatibleRequest` streams by itself when it's given `onText`. Handlers that ignore `onText` keep working:
the result is drawn at the end. To turn the preview off for one call, pass `{ stream: false }`:
`editor.ai.generateDiagram(prompt, { stream: false })`.

## Text → diagram

```ts
const diagram = await editor.ai.generateDiagram(
  'Login: enter email and password, check them, show an error if wrong, otherwise open the dashboard',
);
```

The diagram is drawn in the middle of the screen and selected, so it can be moved right away. Each node is a
group (shape + text); arrows are [connectors](./tools#connector) with `'elbow'` routing, laid out like a
hand-made flowchart: branches of a decision leave from different sides, arrows going back go around the side,
and no arrow crosses a shape.

The model answers with JSON that you can also produce yourself and draw with `drawDiagram`:

```ts
await editor.ai.drawDiagram({
  direction: 'down', // or 'right'
  nodes: [
    { id: 'a', label: 'Start', kind: 'terminal' },   // kinds: terminal, process, decision, io
    { id: 'b', label: 'Valid?', kind: 'decision', color: 'yellow' },
    { id: 'c', label: 'Done', kind: 'terminal' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c', label: 'yes' },
  ],
});
```

Colors: `blue`, `green`, `yellow`, `pink`, `purple`, `gray`. Nodes are placed in layers with `layoutGraph`,
which is exported too.

## Edit a diagram

```ts
// With a diagram (or part of it) selected:
await editor.ai.editDiagram('Add a step to send a confirmation email after the payment');
```

The AI gets the current diagram (`editor.ai.readDiagram()`) and returns the updated one, which replaces it in
the same place — one undo step. This works with diagrams made by the AI **and hand-made ones**: shapes with text
inside (or grouped with them), sticky notes, connectors, and arrows or lines drawn between two shapes. Diagram
shapes made by the AI remember their node kind and color in their metadata (`component.getMetadata()`), saved in
the SVG.

`editor.ai.editSelection(instruction)` does the right thing for the selection: it edits a selected diagram, and
runs anything else as a [command](#commands). In the playground, it's the ✨ button of the floating toolbar next
to the selection.

New diagrams are placed next to what is already drawn, never on top of it.

## Mind maps

```ts
await editor.ai.generateMindMap('Launching a mobile app');

// With a topic of the mind map selected: 4 sub-topics, and the mind map is laid out again
await editor.ai.expandMindMap({ count: 4 });

// Or without AI:
await editor.ai.drawMindMap({
  label: 'Trip',
  children: [{ label: 'Food', children: [{ label: 'Street food' }] }, { label: 'Places' }],
});
```

The central topic is in the middle, with the branches split between both sides, one color per branch. Topics
are normal shapes with text, linked by connectors: move them, recolor them, or edit their text.

## Mermaid (no AI needed)

```ts
await editor.ai.drawMermaid(`flowchart TD
  A([Start]) --> B{Logged in?}
  B -->|yes| C[Dashboard]
  B -->|no| D[/Login form/] --> B`);

const text = editor.ai.toMermaid(); // the selected diagram (or the whole drawing), or null
```

`drawMermaid` reads `flowchart`/`graph` (all node shapes, `-->`, `---`, `-.->`, `==>`, labels, `A & B` and
chains), `erDiagram` (entities with their attributes, and relationships) and `classDiagram` (classes, members,
annotations and relations). Subgraphs and styles are ignored. `toMermaid` writes an `erDiagram` for tables, a
`classDiagram` for other boxes with details, and a `flowchart` otherwise (with the colors). `parseMermaid(text)` and
`diagramToMermaid(diagram)` are also exported, to convert without drawing.

## Code / SQL → diagram

```ts
await editor.ai.diagramFromCode(`
CREATE TABLE users (id INT PRIMARY KEY, email TEXT);
CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));
`);
```

SQL tables become **entity** boxes (a bold title and one line per column) linked by their foreign keys;
classes and interfaces become a class diagram; other code becomes a flowchart of its logic. The result is
a normal diagram: select it and use `editDiagram()` to change it. You can also draw entity boxes yourself
with `drawDiagram()`: `{ id: 'users', label: 'users', kind: 'entity', details: ['id INT PK', 'email TEXT'] }`.

## Charts

```ts
await editor.ai.generateChart('Revenue per quarter in k$, 2023 vs 2024');

// Or without AI:
editor.ai.drawChart({
  type: 'bar', // 'bar' | 'line' | 'pie'
  title: 'Revenue',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: '2024', values: [120, 150, 170, 210] }],
  unit: 'k$',
});
```

The chart is placed in free space, grouped, and made of shapes and text. Its data is saved in the group's
metadata (`getMetadata().chart`). `buildChart(chart, origin, scale)` returns the components without adding
them.

## Pictures

```ts
await editor.ai.generateIllustration('A lighthouse at sunset', { size: 260 });
```

The model writes a small SVG, which is converted to editable strokes (`svgToStrokes(svg)` is exported too):
paths, rectangles, circles, ellipses, lines, polygons and transforms are supported. Free models draw simple
pictures; bigger models draw better ones.

## Brainstorm

```ts
// With a sticky note (or text) selected:
const notes = await editor.ai.brainstorm({ count: 6 });
```

The ideas become notes in a ring around the topic, linked to it.

## Commands

```ts
const result = await editor.ai.runCommand('Color the notes about marketing in blue');
result.message; // the AI's reply, e.g. the answer to a question
result.actions; // what was done, e.g. ['select', 'setColor']
```

The AI sees a description of the board (with the selection) and answers with actions that use the editor's
API: select items, change their color, align, distribute, layering, group, lock, duplicate, delete, add notes,
generate or edit diagrams, brainstorm and organize notes. Questions are answered in `message`.

## Organize sticky notes

```ts
const groups = await editor.ai.organizeNotes(); // the selected notes, or all of them
// → [{ title: 'Marketing', color: 'blue', notes: [StickyNote, …] }, …]
```

Each group becomes a column under a bold title, with its own note color. The notes and title of a column
are grouped.

## Your own AI features

`editor.ai.describeScene()` returns a compact description of the drawing (notes, texts, arrows with what
they connect, images, positions) to include in your prompts, and `editor.ai.requestJSON(messages)` sends
messages and parses the JSON object in the answer (even when wrapped in Markdown or text):

```ts
const scene = editor.ai.describeScene();
const answer = await editor.ai.requestJSON([
  { role: 'system', content: 'Answer with JSON: {"summary": "..."}' },
  { role: 'user', content: `Summarize this board: ${JSON.stringify(scene)}` },
]);
```

All methods accept `{ signal }` (an `AbortSignal`) to cancel (a preview being drawn is removed), and throw
`AIError` when the AI isn't configured, fails, or gives an unusable answer. For your own streamed features,
`parsePartialAIJSON(text)` reads the complete part of a JSON answer that is still arriving.

## Choosing a model

Small and free models work for diagrams, but follow the JSON format less reliably — answers are validated
and cleaned up (unknown kinds and colors get defaults, broken edges are dropped), but a model that ignores the
format will fail with an `AIError`. Models that are good at JSON output give the best results.
