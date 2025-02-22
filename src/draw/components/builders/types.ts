import { type Rect2 } from '~/math';

import type AbstractRenderer from '../../rendering/renderers/AbstractRenderer';
import { type StrokeDataPoint } from '../../types';
import type Viewport from '../../Viewport';
import type AbstractComponent from '../AbstractComponent';

export interface ComponentBuilder {
  getBBox(): Rect2;
  build(): AbstractComponent;
  preview(renderer: AbstractRenderer): void;

  /**
	 * Called when the pen is stationary (or the user otherwise
	 * activates autocomplete). This might attempt to fit the user's
	 * drawing to a particular shape.
	 *
	 * The shape returned by this function may be ignored if it has
	 * an empty bounding box.
	 *
	 * Although this returns a Promise, it should return *as fast as
	 * possible*.
	 */
  autocorrectShape?: () => Promise<AbstractComponent | null>;

  addPoint(point: StrokeDataPoint): void;
}

export type ComponentBuilderFactory = (
  startPoint: StrokeDataPoint,
  viewport: Viewport,
) => ComponentBuilder;
