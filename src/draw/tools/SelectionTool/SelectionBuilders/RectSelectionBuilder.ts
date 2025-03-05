import { Path, type IVec2, Rect2 } from '~/math';

import SelectionBuilder from './SelectionBuilder';
import type EditorImage from '../../../image/EditorImage';

/**
 * Creates rectangle selections
 */
export default class RectSelectionBuilder extends SelectionBuilder {
  private rect: Rect2;

  public constructor(startPoint: IVec2) {
    super();

    this.rect = Rect2.fromCorners(startPoint, startPoint);
  }

  public onPointerMove(canvasPoint: IVec2) {
    this.rect = this.rect.grownToPoint(canvasPoint);
  }

  public previewPath() {
    return Path.fromRect(this.rect);
  }

  public resolveInternal(image: EditorImage) {
    return image.getComponentsIntersecting(this.rect).filter((element) => {
      // Filter out the case where the selection rectangle is completely contained
      // within the element (and does not intersect it).
      // This is useful, for example, if a very large stroke is used as the background
      // for another drawing. This prevents the very large stroke from being selected
      // unless the selection touches one of its edges.
      return element.intersectsRect(this.rect);
    });
  }
}
