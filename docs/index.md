---
layout: home

hero:
  name: EasyDrawer
  text: Drawing that feels like ink
  tagline: A drawing & whiteboard library for the web. Pressure-sensitive ink, shapes, notes, diagrams and AI — with Apple Pencil and palm rejection built in.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the playground
      link: /playground
    - theme: alt
      text: AI Skills
      link: /skills
    - theme: alt
      text: GitHub
      link: https://github.com/hunghg255/easydrawer

features:
  - icon: ✒️
    title: Natural ink
    details: Width follows stylus pressure — or drawing speed for mouse and fingers. Smooth curves, crisp corners, no lag.
  - icon: 📱
    title: Made for tablets
    details: Reads every Apple Pencil sample (240 Hz), palm rejection, pinch-zoom, no page bounce or long-press menus.
  - icon: 🧩
    title: Simple API
    details: "editor.tools.use('pen'), configure tools with plain objects and CSS colors, undo/redo/clear in one call."
  - icon: 🖼️
    title: Shapes, notes & arrows
    details: 12 shapes, text, sticky notes, arrows that stay attached to shapes, selection with lock and layering, images and grid/dot backgrounds.
  - icon: ✨
    title: AI that draws
    details: Text → diagrams, mind maps, charts and pictures; SQL and code → ER, class and flow diagrams; edit a selected diagram with words. Works with free models.
    link: /guide/ai
  - icon: 🧜
    title: Mermaid in, Mermaid out
    details: Paste a Mermaid flowchart, ER or class diagram to get editable shapes, and export any diagram back to Mermaid.
    link: /guide/ai#mermaid-no-ai-needed
  - icon: ▶️
    title: Frames & presenting
    details: Turn parts of a board into slides, present them full screen, and export them as images or a PDF.
    link: /guide/frames
  - icon: 💾
    title: SVG in, SVG out
    details: Save drawings as SVG or PNG and load them back for editing — notes, arrows, groups and frames included.
  - icon: 🪶
    title: Framework-free
    details: Plain TypeScript, works with React, Vue, Svelte or no framework at all.
---

## Try it

<ClientOnly>
  <DrawingDemo :settings="{ tools: { pen: { thickness: 3 } } }" />
</ClientOnly>

```ts
import { Editor } from 'easydrawer';
import 'easydrawer/styles.css';

const editor = new Editor(document.getElementById('drawing')!);
```
