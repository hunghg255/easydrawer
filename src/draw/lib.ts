/**
 * The main entrypoint for the NPM package. Everything exported by this file
 * is available through the [`easydrawer` package](https://www.npmjs.com/package/easydrawer).
 *
 * ## Example
 *
 * [[include:doc-pages/inline-examples/main-easydrawer-example.md]]
 *
 * @see
 * - {@link Editor}
 * - {@link Editor.loadFromSVG}
 * - {@link AbstractToolbar.addActionButton }
 * - {@link EditorSettings}
 *
 * @packageDocumentation
 */

import Editor, { EditorSettings } from './Editor';
import AbstractToolbar from './toolbar/AbstractToolbar';

export * from './image/lib';
export * from './types';
export * from './inputEvents';
export {
  default as getLocalizationTable,
  matchingLocalizationTable,
} from './localizations/getLocalizationTable';
export * from './localization';

export { default as SVGLoader, SVGLoaderPlugin } from './SVGLoader/SVGLoader';
export { default as Viewport } from './Viewport';
export * from '~/math';
export * from './components/lib';
export * from './commands/lib';
export * from './tools/lib';
export * from './toolbar/lib';
export * from './rendering/lib';
export * from './testing/lib';
export * from './shortcuts/lib';
export { default as EventDispatcher } from './EventDispatcher';
export { default as Pointer, PointerDevice } from './Pointer';
export { default as UndoRedoHistory } from './UndoRedoHistory';

export * from './util/lib';

// @internal
export { default as __easy_draw__version } from './version';

export { Editor, EditorSettings, AbstractToolbar };

/**
 * Using the HTMLToolbar alias is deprecated. Use
 * `AbstractToolbar` instead
 * @deprecated
 */
export { AbstractToolbar as HTMLToolbar };
export default Editor;
