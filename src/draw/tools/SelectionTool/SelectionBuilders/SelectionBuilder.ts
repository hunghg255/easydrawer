import { type Color4, type Path, type IVec2 } from '~/math';

import type AbstractComponent from '../../../components/AbstractComponent';
import type EditorImage from '../../../image/EditorImage';
import { pathToRenderable } from '../../../rendering/RenderablePathSpec';
import type AbstractRenderer from '../../../rendering/renderers/AbstractRenderer';
import type Viewport from '../../../Viewport';

export default abstract class SelectionBuilder {
  public abstract onPointerMove(canvasPoint: IVec2): void;
  public abstract previewPath(): Path;

  /** Returns the components currently in the selection bounds. Used by {@link resolve}. */
  protected abstract resolveInternal(image: EditorImage): AbstractComponent[];

  /** Renders a preview of the selection bounds */
  public render(renderer: AbstractRenderer, color: Color4) {
    renderer.drawPath(pathToRenderable(this.previewPath(), { fill: color }));
  }

  /** Converts the selection preview into a set of selected elements */
  public resolve(image: EditorImage, viewport: Viewport) {
    const path = this.previewPath();

    const filterComponents = (components: AbstractComponent[]) => {
      return components.filter((component) => {
        return component.isSelectable();
      });
    };

    let components;

    // If the bounding box is very small, search for items **near** the bounding box,
    // rather than in the bounding box.
    const clickSize = viewport.getSizeOfPixelOnCanvas() * 3;
    const isClick = path.bbox.maxDimension <= clickSize;

    if (isClick) {
      const searchRegionSize = viewport.visibleRect.maxDimension / 200;
      const minSizeBox = path.bbox.grownBy(searchRegionSize);

      components = image.getComponentsIntersecting(minSizeBox).filter((component) => {
        // return minSizeBox.containsRect(component.getBBox()) || component.intersectsRect(minSizeBox);
        return !!component;
      });

      components = filterComponents(components);

      if (components.length > 1) {
        components = [components[0]];
      }
    } else {
      components = filterComponents(this.resolveInternal(image));
    }

    return components;
  }
}
