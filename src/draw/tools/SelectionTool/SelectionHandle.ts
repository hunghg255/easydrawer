import { type IVec2, Rect2, Vec2 } from '~/math';

import type Selection from './Selection';
import { cssPrefix } from './SelectionTool';
import { type SelectionBoxChild } from './types';
import type Pointer from '../../Pointer';
import { assertUnreachable } from '../../util/assertions';
import type Viewport from '../../Viewport';

enum HandleShape {
  Circle,
  Square,
}

export enum HandleAction {
  ResizeXY = 'resize-xy',
  Rotate = 'rotate',
  ResizeX = 'resize-x',
  ResizeY = 'resize-y',
}

export interface HandlePresentation {
  // (1,1) corresponds to the bottom right of the parent,
  // (1, 0) corresponds to the top left.
  side: IVec2;

  // An icon to optionally display within the handle
  icon?: Element;

  // Determines the handle's shape/style
  action: HandleAction;
}

// The *interactable* handle size. The visual size will be slightly smaller.
export const handleSize = 30;

// `startPoint` is in screen coordinates
export type DragStartCallback = (startPoint: IVec2) => void;
export type DragUpdateCallback = (canvasPoint: IVec2) => void;
export type DragEndCallback = () => Promise<void> | void;

export default class SelectionHandle implements SelectionBoxChild {
  private element: HTMLElement;
  private snapToGrid: boolean;
  private shape: HandleShape;
  private parentSide: IVec2;

  public constructor(
    readonly presentation: HandlePresentation,
    private readonly parent: Selection,
    private readonly viewport: Viewport,

    private readonly onDragStart: DragStartCallback,
    private readonly onDragUpdate: DragUpdateCallback,
    private readonly onDragEnd: DragEndCallback,
  ) {
    this.element = document.createElement('div');
    this.element.classList.add(`${cssPrefix}handle`, `${cssPrefix}${presentation.action}`);

    // Create a slightly smaller content/background element.
    const visibleContent = document.createElement('div');
    visibleContent.classList.add(`${cssPrefix}content`);
    this.element.appendChild(visibleContent);

    this.parentSide = presentation.side;

    const icon = presentation.icon;
    if (icon) {
      visibleContent.appendChild(icon);
      icon.classList.add('icon');
    }

    if (presentation.action === HandleAction.Rotate) {
      this.shape = HandleShape.Circle;
    } else {
      this.shape = HandleShape.Square;
    }

    switch (this.shape) {
      case HandleShape.Circle:
        this.element.classList.add(`${cssPrefix}circle`);
        break;
      case HandleShape.Square:
        this.element.classList.add(`${cssPrefix}square`);
        break;
      default:
        assertUnreachable(this.shape);
    }

    this.updatePosition();
  }

  /**
	 * Adds this to `container`, where `conatiner` should be the background/selection
	 * element visible on the screen.
	 */
  public addTo(container: HTMLElement) {
    container.appendChild(this.element);
  }

  /**
	 * Removes this element from its container. Should only be called
	 * after {@link addTo}.
	 */
  public remove() {
    this.element.remove();
  }

  /**
	 * Returns this handle's bounding box relative to the top left of the
	 * selection box.
	 */
  private getBBoxParentCoords() {
    const parentRect = this.parent.getScreenRegion();
    const size = Vec2.of(handleSize, handleSize);
    const topLeft = parentRect.size
      .scale(this.parentSide)
    // Center
      .minus(size.times(1 / 2));

    return new Rect2(topLeft.x, topLeft.y, size.x, size.y);
  }

  /** @returns this handle's bounding box relative to the canvas. */
  private getBBoxCanvasCoords() {
    const parentRect = this.parent.region;
    const size = Vec2.of(handleSize, handleSize).times(1 / this.viewport.getScaleFactor());

    const topLeftFromParent = parentRect.size.scale(this.parentSide).minus(size.times(0.5));

    return new Rect2(topLeftFromParent.x, topLeftFromParent.y, size.x, size.y).translatedBy(
      parentRect.topLeft,
    );
  }

  /**
	 * Moves the HTML representation of this to the location matching its internal representation.
	 */
  public updatePosition() {
    const bbox = this.getBBoxParentCoords();

    // Position within the selection box.
    this.element.style.marginLeft = `${bbox.topLeft.x}px`;
    this.element.style.marginTop = `${bbox.topLeft.y}px`;
    this.element.style.width = `${bbox.w}px`;
    this.element.style.height = `${bbox.h}px`;
  }

  /** @returns true iff `point` (in editor **canvas** coordinates) is in this. */
  public containsPoint(point: IVec2) {
    const bbox = this.getBBoxCanvasCoords();
    const delta = point.minus(bbox.center);

    // Should have same x and y radius
    const radius = bbox.size.x / 2;

    let result;
    if (this.shape === HandleShape.Circle) {
      result = delta.magnitude() <= radius;
    } else {
      result = Math.abs(delta.x) <= radius && Math.abs(delta.y) <= radius;
    }

    return result;
  }

  private dragLastPos: IVec2 | null = null;
  public handleDragStart(pointer: Pointer) {
    this.onDragStart(pointer.canvasPos);
    this.dragLastPos = pointer.canvasPos;
    return true;
  }

  public handleDragUpdate(pointer: Pointer) {
    if (!this.dragLastPos) {
      return;
    }

    this.onDragUpdate(pointer.canvasPos);
  }

  public handleDragEnd() {
    if (!this.dragLastPos) {
      return;
    }
    return this.onDragEnd();
  }

  public setSnapToGrid(snap: boolean) {
    this.snapToGrid = snap;
  }

  public isSnappingToGrid() {
    return this.snapToGrid;
  }
}
