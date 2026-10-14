# Settings

The second argument of `new Editor(element, settings)`. Every setting is optional.

```ts
const editor = new Editor(element, {
  tools: {
    initial: 'pen',
    pen: { color: '#1f2937', thickness: 3 },
    highlighter: { color: 'rgba(250, 204, 21, 0.45)' },
    shape: { shape: 'rectangle', color: 'transparent', borderColor: '#1f2937', thickness: 2 },
    eraser: { mode: 'partial-stroke' },
    text: { fontSize: 20 },
  },
  input: { stylusOnly: 'auto' },
  background: { type: 'grid', color: '#fffbea' },
  minZoom: 0.1,
  maxZoom: 10,
});
```

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `tools.initial` | `ToolName \| null` | `'pen'` | Tool active at start |
| `tools.pen`, `tools.highlighter`, `tools.shape`, `tools.eraser`, `tools.text` | tool options | | Initial [tool options](./tools#configure-name-options) |
| `input.stylusOnly` | `boolean \| 'auto'` | `'auto'` | [Palm rejection](/guide/tablets#palm-rejection) |
| `background` | `{ type?, color? }` | none | Initial background |
| `minZoom` / `maxZoom` | `number` | `2e-10` / `1e12` | Zoom limits |
| `disableZoom` | `boolean` | `false` | Disable panning and zooming |
| `wheelEventsEnabled` | `boolean \| 'only-if-focused'` | `true` | Whether the mouse wheel scrolls the drawing |
| `localization` | `Partial<EditorLocalization>` | browser language | Translated strings |
| `keyboardShortcutOverrides` | `Record<string, KeyBinding[]>` | | Change keyboard shortcuts |
| `text.fonts` | `string[]` | | Fonts offered for text |
| `clipboardApi` | `{ read, write }` | browser clipboard | Custom clipboard access |
| `svg.loaderPlugins` | `SVGLoaderPlugin[]` | | Custom components when loading SVG |
