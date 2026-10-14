import { useEffect, useRef, useState } from 'react';

import { Editor } from 'easydrawer';

import styles from './App.module.css';
import ControlDrawer from './ControlDraw';

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const newEditor = new Editor(containerRef.current, {
      tools: {
        initial: 'pen',
        pen: { color: '#1f2937', thickness: 3 },
        highlighter: { color: 'rgba(250, 204, 21, 0.45)' },
      },
      // Palm rejection: after an Apple Pencil/stylus is used, fingers only pan & zoom.
      input: { stylusOnly: 'auto' },
    });
    setEditor(newEditor);

    return () => newEditor.remove();
  }, []);

  const saveSvg = () => {
    if (!editor) return;
    const blob = new Blob([editor.toSVGString()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download(url, 'drawing.svg');
    URL.revokeObjectURL(url);
  };

  const savePng = () => {
    if (!editor) return;
    download(editor.toDataURL('image/png'), 'drawing.png');
  };

  return (
    <div className={styles.lessonContent}>
      {editor && (
        <ControlDrawer
          editor={editor}
          onOpenSvg={() => svgInputRef.current?.click()}
          onSavePng={savePng}
          onSaveSvg={saveSvg}
          onUploadImage={() => imageInputRef.current?.click()}
        />
      )}

      <div className={styles.easyDrawer} ref={containerRef} />

      <input
        accept='image/svg+xml'
        ref={svgInputRef}
        style={{ display: 'none' }}
        type='file'
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !editor) return;

          editor.history.clearAllStack();
          await editor.loadFromSVG(await file.text());
          e.target.value = '';
        }}
      />

      <input
        accept='image/*'
        multiple
        ref={imageInputRef}
        style={{ display: 'none' }}
        type='file'
        onChange={async (e) => {
          if (!e.target.files || !editor) return;

          await editor.uploadImages([...e.target.files]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default App;
