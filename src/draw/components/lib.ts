import BackgroundComponent, { BackgroundType } from './BackgroundComponent';
import Connector, { type ConnectorArrowMode, type ConnectorEnd, type ConnectorStyle } from './Connector';
import ImageComponent from './ImageComponent';
import type RestyleableComponent from './RestylableComponent';
import {
  createRestyleComponentCommand,
  isRestylableComponent,
  type ComponentStyle as RestyleableComponentStyle,
} from './RestylableComponent';
import StickyNote, { type StickyNoteOptions } from './StickyNote';
import Stroke from './Stroke';
import TextComponent from './TextComponent';

export * from './builders/types';

export * from './builders/lib';
export { default as StrokeSmoother, type Curve as StrokeSmootherCurve } from './util/StrokeSmoother';

export * from './AbstractComponent';
export { default as AbstractComponent } from './AbstractComponent';

export {
  Stroke,
  type RestyleableComponent,
  createRestyleComponentCommand,
  isRestylableComponent,
  type RestyleableComponentStyle,
  TextComponent,

  /** @deprecated use {@link TextComponent} */
  TextComponent as Text,
  Stroke as StrokeComponent,
  BackgroundComponent,
  BackgroundType as BackgroundComponentBackgroundType,
  ImageComponent,
  StickyNote,
  Connector,
  type ConnectorArrowMode,
  type ConnectorEnd,
  type ConnectorStyle,
  type StickyNoteOptions,
};
