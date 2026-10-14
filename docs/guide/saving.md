# Saving & loading

Drawings are stored as SVG: a standard format that browsers, design tools and EasyDrawer itself can read.

## Save

```ts
// SVG string (recommended for saving: it can be loaded back for editing)
const svg = editor.toSVGString();
localStorage.setItem('drawing', svg);

// Image
const png = editor.toDataURL('image/png');
const jpeg = editor.toDataURL('image/jpeg');
```

### Download a file

```ts
function download(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

const blob = new Blob([editor.toSVGString()], { type: 'image/svg+xml' });
const url = URL.createObjectURL(blob);
download(url, 'drawing.svg');
URL.revokeObjectURL(url);
```

## Load

```ts
const svg = localStorage.getItem('drawing');
if (svg) {
  await editor.loadFromSVG(svg);
}
```

## Autosave

`onChange` is called after every change (draw, erase, undo, redo…):

```ts
let timeout: ReturnType<typeof setTimeout>;

editor.onChange(() => {
  clearTimeout(timeout);
  timeout = setTimeout(() => localStorage.setItem('drawing', editor.toSVGString()), 500);
});
```

## Images

```ts
fileInput.addEventListener('change', async () => {
  await editor.uploadImages([...fileInput.files!]);
});
```

## Undo, redo, clear

```ts
editor.undo();
editor.redo();
editor.canUndo(); // → boolean
editor.clear();   // removes everything except the background; can be undone
```
