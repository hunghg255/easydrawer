import Editor, { type EditorSettings } from '../Editor';
import getLocalizationTable from '../localizations/getLocalizationTable';
import { RenderingMode } from '../rendering/Display';

/** Creates an editor. Should only be used in test files. */
export default (settings?: Partial<EditorSettings>) => {
  if (jest === undefined) {
    throw new Error('Files in the testing/ folder should only be used in tests!');
  }

  return new Editor(document.body, {
    renderingMode: RenderingMode.DummyRenderer,
    localization: getLocalizationTable(['en']),
    ...settings,
  });
};
