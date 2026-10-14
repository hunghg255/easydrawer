# AI features

EasyDrawer can ask a language model to draw for you:

- **Text → diagram**: describe a process, a flowchart or an architecture, and get shapes with text and arrows
  that stay attached to them. Decisions get labeled branches ("yes" / "no").
- **Edit a diagram with words**: "add a step to send a confirmation email after the payment".
- **Brainstorm**: ideas about a sticky note, as new notes around it.
- **Organize sticky notes**: after a brainstorm, sort the notes into themed, colored columns with titles.
- **Commands**: ask for anything in plain language — "color the notes about marketing in blue", "align the
  selected shapes and group them", "what is missing in this flowchart?". In the playground: <kbd>Ctrl/⌘ K</kbd>.

Everything the AI adds or moves is a single step in the undo history, and is made of normal shapes, text,
notes and connectors that you can keep editing. Try it in the [playground](/playground) (the ✨ **AI** button).

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
the same place — one undo step. Diagram shapes remember their node kind and color in their metadata
(`component.getMetadata()`), saved in the SVG.

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

All methods accept `{ signal }` (an `AbortSignal`) to cancel, and throw `AIError` when the AI isn't
configured, fails, or gives an unusable answer.

## Choosing a model

Small and free models work for diagrams, but follow the JSON format less reliably — answers are validated
and cleaned up (unknown kinds and colors get defaults, broken edges are dropped), but a model that ignores the
format will fail with an `AIError`. Models that are good at JSON output give the best results.
