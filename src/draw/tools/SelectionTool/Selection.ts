/**
 * @internal
 * @packageDocumentation
 */

import { Color4, type LineSegment2, Mat33, Rect2, type IVec2, Vec2, type Mat33Array } from '~/math';

import SelectionHandle, { HandleAction, handleSize } from './SelectionHandle';
import SelectionMenuShortcut from './SelectionMenuShortcut';
import { cssPrefix } from './SelectionTool';
import { DragTransformer, ResizeTransformer, RotateTransformer } from './TransformMode';
import { ResizeMode, type SelectionBoxChild } from './types';
import type Command from '../../commands/Command';
import Duplicate from '../../commands/Duplicate';
import Erase from '../../commands/Erase';
import SerializableCommand from '../../commands/SerializableCommand';
import uniteCommands from '../../commands/uniteCommands';
import type AbstractComponent from '../../components/AbstractComponent';
import Connector from '../../components/Connector';
import Stroke from '../../components/Stroke';
import TextComponent from '../../components/TextComponent';
import type Editor from '../../Editor';
import EditorImage from '../../image/EditorImage';
import { type EditorLocalization } from '../../localization';
import type Pointer from '../../Pointer';
import CanvasRenderer from '../../rendering/renderers/CanvasRenderer';
import { assertIsNumberArray, assertIsStringArray } from '../../util/assertions';
import describeTransformation from '../../util/describeTransformation';
import Viewport from '../../Viewport';

const updateChunkSize = 100;
const maxPreviewElemCount = 500;
// Selections at least this slow to draw (see getProportionalRenderingTime) are moved as an image.
const minSnapshotRenderingWeight = 150;
// While transforming, connectors attached to the selection are routed again at most this often (ms).
const connectorPreviewInterval = 50;
// Largest image (in pixels) of a selection being moved.
const maxSnapshotSize = 4096;

// Distance (in screen pixels) within which a dragged selection snaps to other objects.
const snapDistance = 6;
const snapGuideColor = Color4.fromHex('#ec4899');

// @internal

/** A stand-in for a component being transformed, for routing connectors: its box. */
function boxProxy (id: string, bbox: Rect2): AbstractComponent {
  return {
    getId: () => id,
    getBBox: () => bbox,
    isSelectable: () => true,
    intersects: (segment: LineSegment2) => bbox.intersectsLineSegment(segment).length > 0,
  } as unknown as AbstractComponent;
}

/**
 * The transformation of `elem` when the selection (`all`) is transformed by `full`: the same,
 * except for the text of a shape (text grouped with a shape that contains it), which keeps its
 * size when the shape is resized and moves with the shape's center. With `undoing`, the
 * elements are where `full` moved them.
 */
function transformOfElement (elem: AbstractComponent, all: AbstractComponent[], full: Mat33, undoing: boolean): Mat33 {
  const groupId = elem.getGroupId();
  if (!(elem instanceof TextComponent) || groupId === null) return full;

  // Rotating (or flipping) turns the text with the shape.
  const x = full.transformVec3(Vec2.unitX);
  const y = full.transformVec3(Vec2.unitY);
  if (Math.abs(x.y) > 1e-9 || Math.abs(y.x) > 1e-9 || x.x <= 0 || y.y <= 0) return full;

  const textCenter = elem.getBBox().center;
  const host = all.find(
    (c) => c instanceof Stroke && c.getGroupId() === groupId && c.getMetadata().frame === undefined && c.getBBox().containsPoint(textCenter),
  );
  if (!host) return full;

  const center = host.getBBox().center;
  const before = undoing ? full.inverse().transformVec2(center) : center;
  const after = undoing ? center : full.transformVec2(center);
  return Mat33.translation(after.minus(before));
}
export default class Selection {
  // Child items (menus and selection handles)
  private childwidgets: SelectionBoxChild[];
  private originalRegion: Rect2;

  // The last-computed bounding box of selected content
  // @see getTightBoundingBox
  private selectionTightBoundingBox: Rect2 | null = null;

  private transformers;
  private transform: Mat33 = Mat33.identity;

  // invariant: sorted by increasing z-index
  private selectedElems: AbstractComponent[] = [];

  private outerContainer: HTMLElement;
  private innerContainer: HTMLElement;
  private backgroundElem: HTMLElement;

  private hasParent = true;

  public constructor(
    selectedElems: AbstractComponent[],
    private editor: Editor,
    showContextMenu: (anchor: IVec2) => void,
  ) {
    selectedElems = [...selectedElems];
    this.selectedElems = selectedElems;

    this.originalRegion = Rect2.empty;

    this.transformers = {
      drag: new DragTransformer(editor, this),
      resize: new ResizeTransformer(editor, this),
      rotate: new RotateTransformer(editor, this),
    };

    // We need two containers for some CSS to apply (the outer container
    // needs zero height, the inner needs to prevent the selection background
    // from being visible outside of the editor).
    this.outerContainer = document.createElement('div');
    this.outerContainer.classList.add(`${cssPrefix}selection-outer-container`);

    this.innerContainer = document.createElement('div');
    this.innerContainer.classList.add(`${cssPrefix}selection-inner-container`);

    this.backgroundElem = document.createElement('div');
    this.backgroundElem.classList.add(`${cssPrefix}selection-background`);

    this.innerContainer.appendChild(this.backgroundElem);
    this.outerContainer.appendChild(this.innerContainer);

    const makeResizeHandle = (mode: ResizeMode, side: IVec2) => {
      const modeToAction = {
        [ResizeMode.Both]: HandleAction.ResizeXY,
        [ResizeMode.HorizontalOnly]: HandleAction.ResizeX,
        [ResizeMode.VerticalOnly]: HandleAction.ResizeY,
      };

      return new SelectionHandle(
        {
          action: modeToAction[mode],
          side,
        },
        this,
        this.editor.viewport,
        (startPoint) => this.transformers.resize.onDragStart(startPoint, mode),
        (currentPoint) => this.transformers.resize.onDragUpdate(currentPoint),
        () => this.transformers.resize.onDragEnd(),
      );
    };

    const resizeHorizontalHandles = [
      makeResizeHandle(ResizeMode.HorizontalOnly, Vec2.of(0, 0.5)),
      makeResizeHandle(ResizeMode.HorizontalOnly, Vec2.of(1, 0.5)),
    ];
    const resizeVerticalHandle = makeResizeHandle(ResizeMode.VerticalOnly, Vec2.of(0.5, 1));
    const resizeBothHandle = makeResizeHandle(ResizeMode.Both, Vec2.of(1, 1));

    const rotationHandle = new SelectionHandle(
      {
        action: HandleAction.Rotate,
        side: Vec2.of(0.5, 0),
        // Above the selection, so that it doesn't cover the selected content.
        offset: Vec2.of(0, -32),
        icon: this.editor.icons.makeRotateIcon(),
      },
      this,
      this.editor.viewport,
      (startPoint) => this.transformers.rotate.onDragStart(startPoint),
      (currentPoint) => this.transformers.rotate.onDragUpdate(currentPoint),
      () => this.transformers.rotate.onDragEnd(),
    );
    const menuToggleButton = new SelectionMenuShortcut(
      this,
      this.editor.viewport,
      this.editor.icons.makeOverflowIcon(),
      showContextMenu,
      this.editor.localization,
    );

    this.childwidgets = [
      menuToggleButton,
      resizeBothHandle,
      ...resizeHorizontalHandles,
      resizeVerticalHandle,
      rotationHandle,
    ];

    for (const widget of this.childwidgets) {
      widget.addTo(this.backgroundElem);
    }

    this.recomputeRegion();
    this.updateUI();
  }

  // @internal Intended for unit tests
  public getBackgroundElem(): HTMLElement {
    return this.backgroundElem;
  }

  public getTransform(): Mat33 {
    return this.transform;
  }

  public get preTransformRegion(): Rect2 {
    return this.originalRegion;
  }

  // The **canvas** region.
  public get region(): Rect2 {
    // TODO: This currently assumes that the region rotates about its center.
    // This may not be true.
    const rotationMatrix = Mat33.zRotation(this.regionRotation, this.originalRegion.center);
    const scaleAndTranslateMat = this.transform.rightMul(rotationMatrix.inverse());
    return this.originalRegion.transformedBoundingBox(scaleAndTranslateMat);
  }

  /**
	 * Computes and returns the bounding box of the selection without
	 * any additional padding. Computes directly from the elements that are selected.
	 * @internal
	 */
  public computeTightBoundingBox() {
    const bbox = this.selectedElems.reduce(
      (accumulator: Rect2 | null, elem: AbstractComponent): Rect2 => {
        return (accumulator ?? elem.getBBox()).union(elem.getBBox());
      },
      null,
    );

    return bbox ?? Rect2.empty;
  }

  public get regionRotation(): number {
    return this.transform.transformVec3(Vec2.unitX).angle();
  }

  public get preTransformedScreenRegion(): Rect2 {
    const toScreen = (vec: IVec2) => this.editor.viewport.canvasToScreen(vec);
    return Rect2.fromCorners(
      toScreen(this.preTransformRegion.topLeft),
      toScreen(this.preTransformRegion.bottomRight),
    );
  }

  public get preTransformedScreenRegionRotation(): number {
    return this.editor.viewport.getRotationAngle();
  }

  public getScreenRegion(): Rect2 {
    const toScreen = this.editor.viewport.canvasToScreenTransform;
    const scaleFactor = this.editor.viewport.getScaleFactor();

    const screenCenter = toScreen.transformVec2(this.region.center);

    return new Rect2(
      screenCenter.x,
      screenCenter.y,
      scaleFactor * this.region.width,
      scaleFactor * this.region.height,
    ).translatedBy(this.region.size.times(-scaleFactor / 2));
  }

  public get screenRegionRotation(): number {
    return this.regionRotation + this.editor.viewport.getRotationAngle();
  }

  // Applies, previews, but doesn't finalize the given transformation.
  public setTransform(transform: Mat33, preview = true) {
    this.transform = transform;

    if (preview && this.hasParent) {
      this.previewTransformCmds();
    }
  }

  private getDeltaZIndexToMoveSelectionToTop() {
    if (this.selectedElems.length === 0) {
      return 0;
    }

    const selectedBottommostZIndex = this.selectedElems[0].getZIndex();

    const visibleObjects = this.editor.image.getComponentsIntersecting(this.region);
    const topMostVisibleZIndex =
			visibleObjects[visibleObjects.length - 1]?.getZIndex() ?? selectedBottommostZIndex;
    const deltaZIndex = topMostVisibleZIndex + 1 - selectedBottommostZIndex;

    return deltaZIndex;
  }

  // Applies the current transformation to the selection
  public finalizeTransform() {
    const fullTransform = this.transform;
    const selectedElems = this.selectedElems;

    // Reset for the next drag
    this.originalRegion = this.originalRegion.transformedBoundingBox(this.transform);
    this.transform = Mat33.identity;

    this.scrollTo();

    let transformPromise: void | Promise<void> = undefined;

    // Make the commands undo-able.
    // Don't check for non-empty transforms because this breaks changing the
    // z-index of the just-transformed commands.
    if (this.selectedElems.length > 0) {
      const deltaZIndex = this.getDeltaZIndexToMoveSelectionToTop();
      transformPromise = this.editor.dispatch(
        new Selection.ApplyTransformationCommand(
          this,
          selectedElems,
          this.originalRegion.center,
          fullTransform,
          deltaZIndex,
        ),
      );
    }

    return transformPromise;
  }

  /** Sends all selected elements to the bottom of the visible image. */
  public sendToBack() {
    const visibleObjects = this.editor.image.getComponentsIntersecting(
      this.editor.viewport.visibleRect,
    );

    // VisibleObjects and selectedElems should both be sorted by z-index
    const lowestVisibleZIndex = visibleObjects[0]?.getZIndex() ?? 0;
    const highestSelectedZIndex =
			this.selectedElems[this.selectedElems.length - 1]?.getZIndex() ?? 0;

    const targetHighestZIndex = lowestVisibleZIndex - 1;
    const deltaZIndex = targetHighestZIndex - highestSelectedZIndex;

    if (deltaZIndex !== 0) {
      const commands = this.selectedElems.map((elem) => {
        return elem.setZIndex(elem.getZIndex() + deltaZIndex);
      });
      return uniteCommands(commands, updateChunkSize);
    }
    return null;
  }

  static {
    SerializableCommand.register('selection-tool-transform', (json: any, _editor) => {
      const rawTransformArray: unknown = json.transform;
      const rawCenterArray: unknown = json.selectionCenter ?? [0, 0];
      const rawElementIds: unknown = json.elems ?? [];
      assertIsNumberArray(rawTransformArray);
      assertIsNumberArray(rawCenterArray);
      assertIsStringArray(rawElementIds);

      // The selection box is lost when serializing/deserializing. No need to store box rotation
      const fullTransform: Mat33 = new Mat33(...(rawTransformArray as Mat33Array));
      const elemIds: string[] = rawElementIds;
      const deltaZIndex = Number.parseInt(json.deltaZIndex ?? 0);
      const center = Vec2.of(rawCenterArray[0] ?? 0, rawCenterArray[1] ?? 0);

      return new this.ApplyTransformationCommand(null, elemIds, center, fullTransform, deltaZIndex);
    });
  }

  private static ApplyTransformationCommand = class extends SerializableCommand {
    private transformCommands: Command[];
    private selectedElemIds: string[];

    public constructor(
      private selection: Selection | null,

      // If a `string[]`, selectedElems is a list of element IDs.
      selectedElems: AbstractComponent[] | string[],

      // Information used to describe the transformation
      private selectionCenter: IVec2,

      // Full transformation used to transform elements.
      private fullTransform: Mat33,
      private deltaZIndex: number,
    ) {
      super('selection-tool-transform');

      const isIDList = (arr: AbstractComponent[] | string[]): arr is string[] => {
        return typeof arr[0] === 'string';
      };

      // If a list of element IDs,
      if (isIDList(selectedElems)) {
        this.selectedElemIds = selectedElems;
      } else {
        this.selectedElemIds = selectedElems.map((elem) => elem.getId());
        this.transformCommands = selectedElems.map((elem) => {
          const transform = transformOfElement(elem, selectedElems, this.fullTransform, false);
          return elem.setZIndexAndTransformBy(transform, elem.getZIndex() + deltaZIndex);
        });
      }
    }

    private resolveToElems(editor: Editor, isUndoing: boolean) {
      if (this.transformCommands) {
        return;
      }

      const elems = this.selectedElemIds
        .map((id) => editor.image.lookupElement(id))
        .filter((elem) => elem !== null);
      this.transformCommands = this.selectedElemIds
        .map((id) => {
          const elem = editor.image.lookupElement(id);

          if (!elem) {
            // There may be valid reasons for an element lookup to fail:
            // For example, if the element was deleted remotely and the remote deletion
            // hasn't been undone.
            console.warn(`Unable to find element with ID, ${id}.`);
            return null;
          }

          let originalZIndex = elem.getZIndex();
          let targetZIndex = elem.getZIndex() + this.deltaZIndex;

          // If the command has already been applied, the element should currently
          // have the target z-index.
          if (isUndoing) {
            targetZIndex = elem.getZIndex();
            originalZIndex = elem.getZIndex() - this.deltaZIndex;
          }

          const transform = transformOfElement(elem, elems, this.fullTransform, isUndoing);
          return elem.setZIndexAndTransformBy(transform, targetZIndex, originalZIndex);
        })
        .filter(
          // Remove all null commands
          (command) => command !== null,
        );
    }

    public async apply(editor: Editor) {
      this.resolveToElems(editor, false);

      this.selection?.setTransform(this.fullTransform, false);
      this.selection?.updateUI();
      await editor.asyncApplyCommands(this.transformCommands, updateChunkSize);
      this.selection?.setTransform(Mat33.identity, false);
      this.selection?.recomputeRegion();
      this.selection?.updateUI();
    }

    public async unapply(editor: Editor) {
      this.resolveToElems(editor, true);

      this.selection?.setTransform(this.fullTransform.inverse(), false);
      this.selection?.updateUI();

      await editor.asyncUnapplyCommands(this.transformCommands, updateChunkSize, true);
      this.selection?.setTransform(Mat33.identity, false);
      this.selection?.recomputeRegion();
      this.selection?.updateUI();
    }

    protected serializeToJSON() {
      return {
        elems: this.selectedElemIds,
        transform: this.fullTransform.toArray(),
        deltaZIndex: this.deltaZIndex,
        selectionCenter: this.selectionCenter.asArray(),
      };
    }

    public description(_editor: Editor, localizationTable: EditorLocalization) {
      return localizationTable.transformedElements(
        this.selectedElemIds.length,
        describeTransformation(this.selectionCenter, this.fullTransform, false, localizationTable),
      );
    }
  };

  // Preview the effects of the current transformation on the selection
  private previewTransformCmds() {
    if (this.selectedElems.length === 0) {
      return;
    }

    // Don't render what we're moving if it's likely to be slow.
    if (this.selectedElems.length > maxPreviewElemCount) {
      this.updateUI();
      return;
    }

    const wetInkRenderer = this.editor.display.getWetInkRenderer();
    wetInkRenderer.clear();
    wetInkRenderer.pushTransform(this.transform);

    const snapshot = this.getDragSnapshot();
    const viewportVisibleRect = this.editor.viewport.visibleRect.union(this.region);
    const visibleRect = viewportVisibleRect.transformedBoundingBox(this.transform.inverse());
    // The text of shapes keeps its size when they're resized (see transformOfElement).
    const ownTransform: AbstractComponent[] = [];
    if (snapshot) {
      // An image of the selection, moved instead of drawn again.
      wetInkRenderer.drawImage({
        image: snapshot.canvas,
        base64Url: '',
        transform: Mat33.translation(snapshot.rect.topLeft).rightMul(Mat33.scaling2D(1 / snapshot.pixelsPerUnit)),
      });
      ownTransform.push(...snapshot.notIncluded);
    } else {
      for (const elem of this.drawnWhileDragging()) {
        if (elem instanceof TextComponent && elem.getGroupId() !== null) {
          ownTransform.push(elem);
        } else {
          elem.render(wetInkRenderer, visibleRect);
        }
      }
    }

    wetInkRenderer.popTransform();

    for (const elem of ownTransform) {
      wetInkRenderer.pushTransform(transformOfElement(elem, this.selectedElems, this.transform, false));
      elem.render(wetInkRenderer, viewportVisibleRect);
      wetInkRenderer.popTransform();
    }

    this.renderAttachedConnectors();
    this.renderSnapGuides();

    this.updateUI();
  }

  // The last previews of connectors routed while transforming (see renderAttachedConnectors).
  private connectorPreviews = new Map<Connector, { time: number; preview: Connector }>();

  // Connectors (attached to the selection) whose ends all move with it: when it is only
  // moved, they move with it (no need to route them again).
  private connectorsMovingWithSelection(): Connector[] {
    const selectedIds = new Set(this.selectedElems.map((elem) => elem.getId()));
    const selectedConnectors = this.selectedElems.filter((elem): elem is Connector => elem instanceof Connector && elem.isAttached());
    return [...this.attachedConnectors, ...selectedConnectors].filter((connector) => {
      const ends = [connector.getStart(), connector.getEnd()];
      const allAttachedEndsMove = ends.every((end) => !end.targetId || selectedIds.has(end.targetId));
      const freeEndsMove = selectedConnectors.includes(connector) || ends.every((end) => end.targetId);
      return allAttachedEndsMove && freeEndsMove;
    });
  }

  // What is drawn with the selection while it's transformed. Attached connectors are drawn
  // separately (see renderAttachedConnectors).
  private drawnWhileDragging() {
    return this.selectedElems.filter((elem) => !(elem instanceof Connector && elem.isAttached()));
  }

  // While a selection that is slow to draw is transformed, an image of it is moved instead of
  // drawing everything again for each frame (made at the start, and again if the zoom changes).
  private dragSnapshot: {
    canvas: HTMLCanvasElement;
    rect: Rect2;
    pixelsPerUnit: number;
    connectors: Set<Connector>;
    notIncluded: AbstractComponent[];
  } | null = null;

  private getDragSnapshot() {
    // The connectors that move with the selection are in the image too.
    const connectors = this.connectorsMovingWithSelection();
    // When resizing, the text of shapes is drawn on its own (it keeps its size).
    const notIncluded = this.backgroundDragging
      ? []
      : this.drawnWhileDragging().filter((elem) => elem instanceof TextComponent && elem.getGroupId() !== null);
    const elems = [...this.drawnWhileDragging().filter((elem) => !notIncluded.includes(elem)), ...connectors];
    const weight = elems.reduce((total, elem) => total + elem.getProportionalRenderingTime(), 0);
    if (elems.length === 0 || weight < minSnapshotRenderingWeight) {
      return null;
    }

    const pixelsPerUnit = this.editor.viewport.getScaleFactor() * this.editor.display.getDevicePixelRatio();
    if (this.dragSnapshot?.pixelsPerUnit === pixelsPerUnit) {
      return this.dragSnapshot;
    }

    // A few pixels around, for antialiasing and thick lines.
    const rect = Rect2.union(...elems.map((elem) => elem.getBBox())).grownBy(4 / this.editor.viewport.getScaleFactor());
    const size = rect.size.times(pixelsPerUnit);
    if (size.x < 1 || size.y < 1 || size.x > maxSnapshotSize || size.y > maxSnapshotSize) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size.x);
    canvas.height = Math.ceil(size.y);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const viewport = new Viewport(() => {});
    viewport.updateScreenSize(Vec2.of(canvas.width, canvas.height));
    viewport.resetTransform(Mat33.scaling2D(pixelsPerUnit).rightMul(Mat33.translation(rect.topLeft.times(-1))));
    const renderer = new CanvasRenderer(ctx, viewport);
    for (const elem of elems) {
      elem.render(renderer, rect);
    }

    this.dragSnapshot = { canvas, rect, pixelsPerUnit, connectors: new Set(connectors), notIncluded };
    return this.dragSnapshot;
  }

  // Recompute this' region from the selected elements.
  // Returns false if the selection is empty.
  public recomputeRegion(): boolean {
    const newRegion = this.computeTightBoundingBox();
    this.selectionTightBoundingBox = newRegion;

    if (!newRegion) {
      this.cancelSelection();
      return false;
    }

    this.originalRegion = newRegion;
    this.padRegion();

    return true;
  }

  // Applies padding to the current region if it is too small.
  // @internal
  public padRegion() {
    const sourceRegion = this.selectionTightBoundingBox ?? this.originalRegion;

    const minSize = this.getMinCanvasSize();
    if (sourceRegion.w < minSize || sourceRegion.h < minSize) {
      // Add padding
      const padding = minSize / 2;
      this.originalRegion = Rect2.bboxOf(sourceRegion.corners, padding);

      this.updateUI();
    }
  }

  public getMinCanvasSize(): number {
    const canvasHandleSize = handleSize / this.editor.viewport.getScaleFactor();
    return canvasHandleSize * 2;
  }

  public getSelectedItemCount() {
    return this.selectedElems.length;
  }

  // @internal
  public updateUI() {
    // Don't update old selections.
    if (!this.hasParent) {
      return;
    }

    const screenRegion = this.getScreenRegion();

    // marginLeft, marginTop: Display relative to the top left of the selection overlay.
    // left, top don't work for this.
    this.backgroundElem.style.marginLeft = `${screenRegion.topLeft.x}px`;
    this.backgroundElem.style.marginTop = `${screenRegion.topLeft.y}px`;

    this.backgroundElem.style.width = `${screenRegion.width}px`;
    this.backgroundElem.style.height = `${screenRegion.height}px`;

    const rotationDeg = (this.screenRegionRotation * 180) / Math.PI;
    this.backgroundElem.style.transform = `rotate(${rotationDeg}deg)`;
    this.backgroundElem.style.transformOrigin = 'center';

    // If closer to perpendicular, apply different CSS
    const perpendicularClassName = `${cssPrefix}rotated-near-perpendicular`;
    if (Math.abs(Math.sin(this.screenRegionRotation)) > 0.5) {
      this.innerContainer.classList.add(perpendicularClassName);
    } else {
      this.innerContainer.classList.remove(perpendicularClassName);
    }

    // Hide handles when empty
    if (screenRegion.width === 0 && screenRegion.height === 0) {
      this.innerContainer.classList.add('-empty');
    } else {
      this.innerContainer.classList.remove('-empty');
    }

    for (const widget of this.childwidgets) {
      widget.updatePosition(this.getScreenRegion());
    }
  }

  // Maps IDs to whether we removed the component from the image
  private removedFromImage: Record<string, boolean> = {};

  // Connectors attached to selected items (but not selected): hidden while dragging
  // and drawn following the selection instead.
  private attachedConnectors: Connector[] = [];

  private renderAttachedConnectors() {
    const selectedConnectors = this.selectedElems.filter(
      (elem): elem is Connector => elem instanceof Connector && elem.isAttached(),
    );
    const connectors = [...this.attachedConnectors, ...selectedConnectors];
    if (connectors.length === 0) return;

    const transform = this.transform;
    const renderer = this.editor.display.getWetInkRenderer();

    // When dragging, connectors with all their ends in the selection just move with it:
    // no need to route them again (which is slow with many connectors).
    // Connectors whose ends all move with the selection are transformed with it while it's
    // being transformed (routed again when it's dropped, e.g. after rotating).
    const selectedIds = new Set(this.selectedElems.map((elem) => elem.getId()));
    const rigid = new Set(this.connectorsMovingWithSelection());
    const toRoute: Connector[] = [];
    for (const connector of connectors) {
      if (this.dragSnapshot?.connectors.has(connector)) {
        // Drawn in the image of the selection.
      } else if (rigid.has(connector)) {
        // Drawn transformed (rather than transforming a copy), so its cached drawing is used.
        renderer.pushTransform(transform);
        connector.render(renderer);
        renderer.popTransform();
      } else {
        toRoute.push(connector);
      }
    }
    if (toRoute.length === 0) return;

    // Components the connectors are attached to, where they're being dragged to. Only their
    // boxes are used (copying them can be slow, e.g. hand-drawn shapes are drawn again).
    const moved = new Map<string, AbstractComponent>();
    for (const elem of this.selectedElems) {
      if (toRoute.some((c) => c.isAttachedTo(elem.getId()))) {
        moved.set(elem.getId(), boxProxy(elem.getId(), elem.getBBox().transformedBoundingBox(transform)));
      }
    }
    // Other selected components are only obstacles for elbow routes: their boxes are enough.
    const movedObstacles = this.selectedElems
      .filter((elem) => !(elem instanceof Connector) && !moved.has(elem.getId()) && elem.isSelectable())
      .map((elem) => boxProxy(elem.getId(), elem.getBBox().transformedBoundingBox(transform)));

    const image = this.editor.image;
    const lookup = {
      lookupElement: (id: string) => moved.get(id) ?? image.lookupElement(id),
      // For elbow routes: other components, with the selection where it's being dragged to.
      getComponentsIntersecting: (region: Rect2) => [
        ...image.getComponentsIntersecting(region).filter((c) => !selectedIds.has(c.getId())),
        ...[...moved.values(), ...movedObstacles].filter((elem) => elem.getBBox().intersects(region)),
      ],
    };
    // Routing is slow: each connector is routed again at most every few frames (e.g. while
    // resizing many shapes), drawn as it was in between.
    const now = performance.now();
    for (const connector of toRoute) {
      const last = this.connectorPreviews.get(connector);
      if (last && now - last.time < connectorPreviewInterval) {
        last.preview.render(renderer);
        continue;
      }
      // Free ends of selected connectors move with the selection. Attached ends follow
      // their components.
      const preview = (
        selectedConnectors.includes(connector) ? connector.transformedPreview(transform) : connector.clone()
      ) as Connector;
      preview.updateEnds(lookup);
      preview.render(renderer);
      this.connectorPreviews.set(connector, { time: now, preview });
    }
  }

  // Shows/hides connectors attached to the selection (see attachedConnectors).
  private addRemoveAttachedConnectors(inImage: boolean) {
    if (!inImage) {
      const selectedIds = new Set(this.selectedElems.map((elem) => elem.getId()));
      this.attachedConnectors = this.editor.image
        .getAllComponents()
        .filter(
          (c): c is Connector =>
            c instanceof Connector &&
            !selectedIds.has(c.getId()) &&
            [...selectedIds].some((id) => c.isAttachedTo(id)),
        );
      for (const connector of this.attachedConnectors) {
        this.editor.image.findParent(connector)?.remove();
      }
    } else {
      for (const connector of this.attachedConnectors) {
        if (!this.editor.image.findParent(connector)) {
          EditorImage.addComponent(connector).apply(this.editor);
        }
      }
      this.attachedConnectors = [];
    }
  }

  // Edges and centers of nearby objects that a dragged selection can snap to.
  private snapTargets: Rect2[] = [];
  private snapBox: Rect2 = Rect2.empty;
  private snapGuides: Array<[IVec2, IVec2]> = [];

  private collectSnapTargets() {
    this.snapBox = this.computeTightBoundingBox();
    const selected = new Set(this.selectedElems);
    const attached = new Set<AbstractComponent>(this.attachedConnectors);
    this.snapTargets = this.editor.image
      .getComponentsIntersecting(this.editor.viewport.visibleRect)
      .filter((c) => !selected.has(c) && !attached.has(c) && !(c instanceof Connector) && c.isSelectable())
      .map((c) => c.getBBox())
      .slice(-300);
  }

  /**
   * Adjusts the translation of a dragged selection so its edges or center line up with
   * those of nearby objects, and remembers guide lines to show. @internal
   */
  public snapDragDelta(delta: IVec2): IVec2 {
    this.snapGuides = [];
    if (this.snapTargets.length === 0) return delta;

    const moved = this.snapBox.translatedBy(delta);
    const maxDistance = snapDistance * this.editor.viewport.getSizeOfPixelOnCanvas();
    const xsOf = (r: Rect2) => [r.x, r.center.x, r.x + r.w];
    const ysOf = (r: Rect2) => [r.y, r.center.y, r.y + r.h];

    const findSnap = (values: number[], targetValues: (r: Rect2) => number[]) => {
      let best: { offset: number; value: number; target: Rect2 } | null = null;
      for (const target of this.snapTargets) {
        for (const targetValue of targetValues(target)) {
          for (const value of values) {
            const offset = targetValue - value;
            if (Math.abs(offset) <= maxDistance && (!best || Math.abs(offset) < Math.abs(best.offset))) {
              best = { offset, value: targetValue, target };
            }
          }
        }
      }
      return best;
    };

    const snapX = findSnap(xsOf(moved), xsOf);
    const snapY = findSnap(ysOf(moved), ysOf);
    const snapped = Vec2.of(delta.x + (snapX?.offset ?? 0), delta.y + (snapY?.offset ?? 0));
    const box = this.snapBox.translatedBy(snapped);

    if (snapX) {
      const top = Math.min(box.y, snapX.target.y);
      const bottom = Math.max(box.y + box.h, snapX.target.y + snapX.target.h);
      this.snapGuides.push([Vec2.of(snapX.value, top), Vec2.of(snapX.value, bottom)]);
    }
    if (snapY) {
      const left = Math.min(box.x, snapY.target.x);
      const right = Math.max(box.x + box.w, snapY.target.x + snapY.target.w);
      this.snapGuides.push([Vec2.of(left, snapY.value), Vec2.of(right, snapY.value)]);
    }
    return snapped;
  }

  private renderSnapGuides() {
    if (this.snapGuides.length === 0) return;

    const renderer = this.editor.display.getWetInkRenderer();
    const width = this.editor.viewport.getSizeOfPixelOnCanvas();
    for (const [from, to] of this.snapGuides) {
      renderer.fillRect(Rect2.bboxOf([from, to]).grownBy(width / 2), snapGuideColor);
    }
  }

  // Add/remove the contents of this seleciton from the editor.
  // Used to prevent previewed content from looking like duplicate content
  // while dragging.
  //
  // Does nothing if a large number of elements are selected (and so modifying
  // the editor image is likely to be slow.)
  //
  // If removed from the image, selected elements are drawn as wet ink.
  //
  // [inImage] should be `true` if the selected elements should be added to the
  // main image, `false` if they should be removed.
  private addRemoveSelectionFromImage(inImage: boolean) {
    // Don't hide elements if doing so will be slow.
    if (!inImage && this.selectedElems.length > maxPreviewElemCount) {
      return;
    }

    this.addRemoveAttachedConnectors(inImage);
    if (inImage) {
      this.snapGuides = [];
      this.snapTargets = [];
    }

    for (const elem of this.selectedElems) {
      const parent = this.editor.image.findParent(elem);

      if (!inImage && parent) {
        this.removedFromImage[elem.getId()] = true;
        parent.remove();
      } else if (!parent && this.removedFromImage[elem.getId()]) {
        // If we're making things visible and the selected object wasn't previously visible
        EditorImage.addComponent(elem).apply(this.editor);

        this.removedFromImage[elem.getId()] = false;
        delete this.removedFromImage[elem.getId()];
      }
    }

    // Don't await queueRerender. If we're running in a test, the re-render might never
    // happen.
    this.editor.queueRerender().then(() => {
      if (!inImage) {
        this.previewTransformCmds();
      } else {
        // Clear renderings of any in-progress transformations
        const wetInkRenderer = this.editor.display.getWetInkRenderer();
        wetInkRenderer.clear();
      }
    });
  }

  private removeDeletedElemsFromSelection() {
    // Remove any deleted elements from the selection.
    this.selectedElems = this.selectedElems.filter((elem) => {
      const hasParent = !!this.editor.image.findParent(elem);

      // If we removed the element and haven't added it back yet, don't remove it
      // from the selection.
      const weRemoved = this.removedFromImage[elem.getId()];
      return hasParent || weRemoved;
    });
  }

  private activeHandle: SelectionBoxChild | null = null;
  private backgroundDragging = false;
  public onDragStart(pointer: Pointer): boolean {
    // If empty, it isn't possible to drag
    if (this.selectedElems.length === 0) {
      return false;
    }

    // Clear the HTML selection (prevent HTML drag and drop being triggered by this drag)
    document.getSelection()?.removeAllRanges();

    this.activeHandle = null;

    let result = false;

    this.backgroundDragging = false;
    if (this.region.containsPoint(pointer.canvasPos)) {
      this.backgroundDragging = true;
      result = true;
    }

    for (const widget of this.childwidgets) {
      if (widget.containsPoint(pointer.canvasPos)) {
        this.activeHandle = widget;
        this.backgroundDragging = false;
        result = true;
      }
    }

    if (result) {
      this.removeDeletedElemsFromSelection();
      this.addRemoveSelectionFromImage(false);
    }

    if (this.activeHandle) {
      this.activeHandle.handleDragStart(pointer);
    }

    if (this.backgroundDragging) {
      this.collectSnapTargets();
      this.transformers.drag.onDragStart(pointer.canvasPos);
    }

    return result;
  }

  public onDragUpdate(pointer: Pointer) {
    if (this.backgroundDragging) {
      this.transformers.drag.onDragUpdate(pointer.canvasPos);
    }

    if (this.activeHandle) {
      this.activeHandle.handleDragUpdate(pointer);
    }
  }

  public onDragEnd() {
    this.dragSnapshot = null;
    this.connectorPreviews.clear();
    if (this.backgroundDragging) {
      this.transformers.drag.onDragEnd();
    } else if (this.activeHandle) {
      this.activeHandle.handleDragEnd();
    }

    this.addRemoveSelectionFromImage(true);

    this.backgroundDragging = false;
    this.activeHandle = null;
    this.updateUI();
  }

  public onDragCancel() {
    this.dragSnapshot = null;
    this.connectorPreviews.clear();
    this.backgroundDragging = false;
    this.activeHandle = null;
    this.setTransform(Mat33.identity);

    this.addRemoveSelectionFromImage(true);
    this.updateUI();
  }

  // Scroll the viewport to this. Does not zoom
  public scrollTo() {
    if (this.selectedElems.length === 0) {
      return false;
    }

    const screenSize = this.editor.viewport.getScreenRectSize();
    const screenRect = new Rect2(0, 0, screenSize.x, screenSize.y);

    const selectionScreenRegion = this.getScreenRegion();

    if (!screenRect.containsPoint(selectionScreenRegion.center)) {
      const targetPointScreen = selectionScreenRegion.center;
      const closestPointScreen = screenRect.getClosestPointOnBoundaryTo(targetPointScreen);
      const closestPointCanvas = this.editor.viewport.screenToCanvas(closestPointScreen);

      const targetPointCanvas = this.region.center;
      const delta = closestPointCanvas.minus(targetPointCanvas);

      this.editor.dispatchNoAnnounce(
        Viewport.transformBy(Mat33.translation(delta.times(0.5))),
        false,
      );

      this.editor.queueRerender().then(() => {
        this.previewTransformCmds();
      });

      return true;
    }

    return false;
  }

  public deleteSelectedObjects(): Command {
    if (this.backgroundDragging || this.activeHandle) {
      this.onDragEnd();
    }

    return new Erase(this.selectedElems);
  }

  private selectionDuplicatedAnimationTimeout: ReturnType<typeof setTimeout> | null = null;
  private runSelectionDuplicatedAnimation() {
    if (this.selectionDuplicatedAnimationTimeout) {
      clearTimeout(this.selectionDuplicatedAnimationTimeout);
    }

    const animationDuration = 400; // ms
    this.backgroundElem.style.animation = `${animationDuration}ms ease selection-duplicated-animation`;

    this.selectionDuplicatedAnimationTimeout = setTimeout(() => {
      this.backgroundElem.style.animation = '';
      this.selectionDuplicatedAnimationTimeout = null;
    }, animationDuration);
  }

  public async duplicateSelectedObjects(): Promise<Command> {
    const wasTransforming = this.backgroundDragging || this.activeHandle;
    let tmpApplyCommand: Command | null = null;

    if (!wasTransforming) {
      this.runSelectionDuplicatedAnimation();
    }

    let command;
    if (wasTransforming) {
      // Don't update the selection's focus when redoing/undoing
      const selectionToUpdate: Selection | null = null;
      const deltaZIndex = this.getDeltaZIndexToMoveSelectionToTop();
      tmpApplyCommand = new Selection.ApplyTransformationCommand(
        selectionToUpdate,
        this.selectedElems,
        this.region.center,
        this.transform,
        deltaZIndex,
      );

      // Transform to ensure that the duplicates are in the correct location
      await tmpApplyCommand.apply(this.editor);

      // Show items again
      this.addRemoveSelectionFromImage(true);

      // With the transformation applied, create the duplicates
      command = uniteCommands(
        this.selectedElems.map((elem) => {
          return EditorImage.addComponent(elem.clone());
        }),
      );

      // Move the selected objects back to the correct location.
      await tmpApplyCommand?.unapply(this.editor);
      this.addRemoveSelectionFromImage(false);

      this.previewTransformCmds();
      this.updateUI();
    } else {
      command = new Duplicate(this.selectedElems);
    }

    return command;
  }

  public snapSelectedObjectsToGrid() {
    const viewport = this.editor.viewport;

    // Snap the top left corner of what we have selected.
    const topLeftOfBBox = this.computeTightBoundingBox().topLeft;
    const snappedTopLeft = viewport.snapToGrid(topLeftOfBBox);
    const snapDelta = snappedTopLeft.minus(topLeftOfBBox);

    const oldTransform = this.getTransform();
    this.setTransform(oldTransform.rightMul(Mat33.translation(snapDelta)));
    this.finalizeTransform();
  }

  public setHandlesVisible(showHandles: boolean) {
    if (!showHandles) {
      this.innerContainer.classList.add('-hide-handles');
    } else {
      this.innerContainer.classList.remove('-hide-handles');
    }
  }

  public addTo(elem: HTMLElement) {
    if (this.outerContainer.parentElement) {
      this.outerContainer.remove();
    }

    elem.appendChild(this.outerContainer);
    this.hasParent = true;
  }

  public setToPoint(point: IVec2) {
    this.originalRegion = this.originalRegion.grownToPoint(point);
    this.selectionTightBoundingBox = null;

    this.updateUI();
  }

  public cancelSelection() {
    if (this.outerContainer.parentElement) {
      this.outerContainer.remove();
    }
    this.originalRegion = Rect2.empty;
    this.selectionTightBoundingBox = null;
    this.hasParent = false;
  }

  public getSelectedObjects(): AbstractComponent[] {
    return [...this.selectedElems];
  }
}
