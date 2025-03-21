import BackgroundComponent, { BackgroundType } from './BackgroundComponent';
import ImageComponent from './ImageComponent';
import RestyleableComponent from './RestylableComponent';
import {
  createRestyleComponentCommand,
  isRestylableComponent,
  ComponentStyle as RestyleableComponentStyle,
} from './RestylableComponent';
import Stroke from './Stroke';
import TextComponent from './TextComponent';

export * from './builders/types';

export * from './builders/lib';
export { default as StrokeSmoother, Curve as StrokeSmootherCurve } from './util/StrokeSmoother';

export * from './AbstractComponent';
export { default as AbstractComponent } from './AbstractComponent';

export {
  Stroke,
  RestyleableComponent,
  createRestyleComponentCommand,
  isRestylableComponent,
  RestyleableComponentStyle,
  TextComponent,

  /** @deprecated use {@link TextComponent} */
  TextComponent as Text,
  Stroke as StrokeComponent,
  BackgroundComponent,
  BackgroundType as BackgroundComponentBackgroundType,
  ImageComponent,
};
