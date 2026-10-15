import { Rect2, Mat33, Vec2, Color4, type IVec2 } from '~/math';

import BaseTool from './BaseTool';
import { type ToolLocalization } from './localization';
import type Command from '../commands/Command';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
import type AbstractComponent from '../components/AbstractComponent';
import Stroke from '../components/Stroke';
import TextComponent from '../components/TextComponent';
import type Editor from '../Editor';
import EditorImage from '../image/EditorImage';
import { type PointerEvt } from '../inputEvents';
import { PointerDevice } from '../Pointer';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';
import { EditorEventType } from '../types';
import { type MutableReactiveValue, ReactiveValue } from '../util/ReactiveValue';

const overlayCSSClass = 'textEditorOverlay';

type AnchorControl = { remove(): void };

// The part of a shape's width used by its text.
const shapeTextWidth = 0.85;

// Splits `line` into lines at most `maxWidth` wide (at word boundaries).
function wrapLine (line: string, style: TextRenderingStyle, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of line.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && TextComponent.measureTextWidth(candidate, style) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

/** A tool that allows users to enter and edit text. */
export default class TextTool extends BaseTool {
  private textStyleValue: MutableReactiveValue<TextRenderingStyle>;

  // A reference to the current value of `textStyleValue`.
  private textStyle: TextRenderingStyle;

  private anchorControl: AnchorControl;
  private contentTransform: MutableReactiveValue<Mat33>;

  private textEditOverlay: HTMLElement;
  private textInputElem: HTMLTextAreaElement | null = null;
  private textMeasuringCtx: CanvasRenderingContext2D | null = null;

  private removeExistingCommand: Erase | null = null;
  // The text being edited (its group and metadata are kept).
  private editedComponent: TextComponent | null = null;
  // The shape a text is typed in (see addTextIn), and the tool's style before.
  private attachTo: AbstractComponent | null = null;
  private styleBeforeShapeText: TextRenderingStyle | null = null;
  // Called once the text being edited is saved or canceled.
  private onEditingDone: (() => void) | null = null;

  public constructor(
    private editor: Editor,
    description: string,
    private localizationTable: ToolLocalization,
  ) {
    super(editor.notifier, description);
    const editorFonts = editor.getCurrentSettings().text?.fonts ?? [];
    this.textStyleValue = ReactiveValue.fromInitialValue({
      size: 20,
      fontFamily: editorFonts.length > 0 ? editorFonts[0] : 'sans-serif',
      renderingStyle: {
        fill: Color4.black,
      },
    });
    this.textStyleValue.onUpdateAndNow(() => {
      this.textStyle = this.textStyleValue.get();

      this.updateTextInput();
      this.editor.notifier.dispatch(EditorEventType.ToolUpdated, {
        kind: EditorEventType.ToolUpdated,
        tool: this,
      });
    });

    this.contentTransform = ReactiveValue.fromInitialValue(Mat33.identity);

    this.textEditOverlay = document.createElement('div');
    this.textEditOverlay.classList.add(overlayCSSClass);
    this.editor.addStyleSheet(`
			.${overlayCSSClass} textarea {
				/* No padding or border: the text stays in place when it is saved. */
				background-color: rgba(255, 255, 255, 0.85);

				white-space: pre;
				overflow: hidden;
				resize: none;

				padding: 0;
				margin: 0;

				min-width: 4em;
				min-height: 1.1em;
				border: none;
				border-radius: 2px;
				outline: 2px solid rgba(59, 130, 246, 0.6);
				outline-offset: 4px;
			}
		`);
    this.anchorControl = this.editor.anchorElementToCanvas(
      this.textEditOverlay,
      this.contentTransform,
    );
  }

  private initTextMeasuringCanvas() {
    this.textMeasuringCtx ??= document.createElement('canvas').getContext('2d');
  }

  private getTextAscent(text: string, style: TextRenderingStyle): number {
    this.initTextMeasuringCanvas();
    if (this.textMeasuringCtx) {
      this.textMeasuringCtx.textBaseline = 'alphabetic';
      TextComponent.applyTextStyles(this.textMeasuringCtx, style);
      const measurement = this.textMeasuringCtx.measureText(text);
      return measurement.fontBoundingBoxAscent ?? measurement.actualBoundingBoxAscent;
    }

    // Estimate
    return (style.size * 2) / 3;
  }

  // Take input from this' textInputElem and add it to the EditorImage.
  // If [removeInput], the HTML input element is removed. Otherwise, its value
  // is cleared.
  private flushInput(removeInput = true) {
    if (!this.textInputElem) return;

    // Determine the scroll first -- removing the input (and other DOM changes)
    // also change the scroll.
    const scrollingRegion = this.textEditOverlay.parentElement;
    const containerScroll = Vec2.of(
      scrollingRegion?.scrollLeft ?? 0,
      scrollingRegion?.scrollTop ?? 0,
    );

    const content = this.textInputElem.value.trimEnd();

    this.textInputElem.value = '';

    if (removeInput) {
      // In some browsers, .remove() triggers a .blur event (synchronously).
      // Clear this.textInputElem before removal
      const input = this.textInputElem;
      this.textInputElem = null;
      input.remove();
    }

    if (content !== '') {
      // When the text is long, it can cause its container to scroll so that the
      // editing caret is in view.
      // So that the text added to the document is in the same position as the text
      // shown in the editor, account for this scroll when computing the transform:
      const scrollCorrectionScreen = containerScroll.times(-1);
      // Uses .transformVec3 to avoid also translating the scroll correction (treating
      // it as a point):
      const scrollCorrectionCanvas =
				this.editor.viewport.screenToCanvasTransform.transformVec3(scrollCorrectionScreen);
      const scrollTransform = Mat33.translation(scrollCorrectionCanvas);

      const shape = this.attachTo;
      let lines = content.split('\n');
      if (shape) {
        // Wrapped to the width of the shape, like in the text box.
        const maxWidth = (shape.getBBox().w * shapeTextWidth) / this.contentScale();
        lines = lines.flatMap((line) => wrapLine(line, this.textStyle, maxWidth));
      }
      let textComponent = TextComponent.fromLines(
        lines,
        scrollTransform.rightMul(this.contentTransform.get()),
        this.textStyle,
      );
      const extraCommands: Command[] = [];
      if (shape) {
        // Centered in the shape.
        const offset = shape.getBBox().center.minus(textComponent.getBBox().center);
        textComponent = TextComponent.fromLines(
          lines,
          Mat33.translation(offset).rightMul(scrollTransform).rightMul(this.contentTransform.get()),
          this.textStyle,
          { align: 'center' },
        );
      }

      if (this.editedComponent) {
        textComponent.setGroupDirectly(this.editedComponent.getGroupId());
        const metadata = this.editedComponent.getMetadata();
        if (Object.keys(metadata).length > 0) textComponent.setMetadata({ ...metadata });
      } else if (shape) {
        // Grouped with the shape.
        const groupId = shape.getGroupId() ?? `group-${shape.getId()}`;
        textComponent.setGroupDirectly(groupId);
        if (shape.getGroupId() === null) extraCommands.push(shape.setGroup(groupId));
      }

      const action = extraCommands.length > 0
        ? uniteCommands([EditorImage.addComponent(textComponent), ...extraCommands])
        : EditorImage.addComponent(textComponent);
      if (this.removeExistingCommand) {
        // Unapply so that `removeExistingCommand` can be added to the undo stack.
        this.removeExistingCommand.unapply(this.editor);

        this.editor.dispatch(uniteCommands([this.removeExistingCommand, action]));
        this.removeExistingCommand = null;
      } else {
        this.editor.dispatch(action);
      }
    }
    this.editedComponent = null;
    this.stopShapeText();
    this.finishedEditing();
  }

  private finishedEditing() {
    const callback = this.onEditingDone;
    this.onEditingDone = null;
    if (callback) setTimeout(callback, 0);
  }

  /** Calls `callback` once the text being edited (or about to be) is saved or canceled. @internal */
  public whenEditingDone(callback: () => void) {
    this.onEditingDone = callback;
  }

  // The size of a unit of the text box (a CSS pixel) on the canvas.
  private contentScale() {
    return Vec2.ofXY(this.contentTransform.get().transformVec3(Vec2.unitX)).magnitude() || 1;
  }

  // Texts in shapes use their own size (see addTextIn): back to the tool's style.
  private stopShapeText() {
    this.attachTo = null;
    if (this.styleBeforeShapeText) {
      this.textStyle = this.styleBeforeShapeText;
      this.styleBeforeShapeText = null;
    }
  }

  /**
   * Starts typing a new text in `shape` (e.g. a label in a hand-drawn box). The text is
   * centered in the shape and grouped with it, like the labels of AI-made diagrams.
   */
  public addTextIn(shape: AbstractComponent) {
    this.flushInput();
    this.removeExistingCommand = null;
    const box = shape.getBBox();
    const pixel = this.editor.viewport.getSizeOfPixelOnCanvas();
    // A size that fits the shape (like the labels of AI-made diagrams), at most the tool's size.
    const size = Math.round(Math.min(Math.max((box.h / pixel) * 0.28, 12), 20, this.textStyle.size));
    this.startTextInput(box.center, '');
    // After startTextInput, which ends any other text (and restores the tool's style).
    this.styleBeforeShapeText = this.textStyle;
    this.textStyle = { ...this.textStyle, size };
    this.attachTo = shape;
    this.updateTextInput();
  }

  private updateTextInput() {
    if (!this.textInputElem) {
      return;
    }

    this.textInputElem.placeholder = this.localizationTable.enterTextToInsert;
    this.textInputElem.style.fontFamily = this.textStyle.fontFamily;
    this.textInputElem.style.fontStyle = this.textStyle.fontStyle ?? '';
    this.textInputElem.style.fontVariant = this.textStyle.fontVariant ?? '';
    this.textInputElem.style.fontWeight = this.textStyle.fontWeight ?? '';
    this.textInputElem.style.fontSize = `${this.textStyle.size}px`;
    this.textInputElem.style.color = this.textStyle.renderingStyle.fill.toHexString();

    this.textInputElem.style.margin = '0';

    this.textInputElem.style.width = `${this.textInputElem.scrollWidth}px`;
    this.textInputElem.style.height = `${this.textInputElem.scrollHeight}px`;

    // Get the ascent based on the font, using a string of characters
    // that is tall in most fonts.
    const tallText = 'Testing!';
    const ascent = this.getTextAscent(tallText, this.textStyle);
    const vertAdjust = ascent;

    this.textInputElem.style.transform = `translate(0, ${-vertAdjust}px)`;
    this.textInputElem.style.transformOrigin = 'top left';

    // Match the line height of default rendered text.
    const lineHeight = Math.floor(this.textStyle.size);
    this.textInputElem.style.lineHeight = `${lineHeight}px`;

    // In a shape: centered on it, and wrapped to its width.
    const input = this.textInputElem;
    if (this.attachTo) {
      input.style.whiteSpace = 'pre-wrap';
      input.style.textAlign = 'center';
      input.style.width = `${(this.attachTo.getBBox().w * shapeTextWidth) / this.contentScale()}px`;
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
      input.style.transform = 'translate(-50%, -50%)';
      input.style.transformOrigin = 'center';
    } else {
      input.style.whiteSpace = '';
      input.style.textAlign = '';
    }
  }

  private startTextInput(textCanvasPos: IVec2, initialText: string) {
    this.flushInput();

    this.textInputElem = document.createElement('textarea');
    this.textInputElem.value = initialText;
    this.textInputElem.style.display = 'inline-block';
    const textTargetPosition = this.editor.viewport.roundPoint(textCanvasPos);
    const textRotation = -this.editor.viewport.getRotationAngle();
    const textScale = Vec2.of(1, 1).times(this.editor.viewport.getSizeOfPixelOnCanvas());
    this.contentTransform.set(
      // Scale, then rotate, then translate:
      Mat33.translation(textTargetPosition)
        .rightMul(Mat33.zRotation(textRotation))
        .rightMul(Mat33.scaling2D(textScale)),
    );
    this.updateTextInput();

    // Update the input size/position/etc. after the placeHolder has had time to appear.
    setTimeout(() => this.updateTextInput(), 0);

    this.textInputElem.addEventListener('input', () => {
      if (this.textInputElem) {
        if (this.attachTo) {
          this.textInputElem.style.height = 'auto';
        } else {
          this.textInputElem.style.width = `${this.textInputElem.scrollWidth}px`;
        }
        this.textInputElem.style.height = `${this.textInputElem.scrollHeight}px`;
      }
    });
    this.textInputElem.addEventListener('blur', () => {
      const input = this.textInputElem;

      // Delay removing the input -- flushInput may be called within a blur()
      // event handler
      const removeInput = false;
      this.flushInput(removeInput);

      this.textInputElem = null;

      if (input) {
        input.classList.add('-hiding');
      }

      setTimeout(() => {
        input?.remove();
      }, 0);
    });
    // Enter saves (see keyup); Shift+Enter adds a line.
    this.textInputElem.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
        evt.preventDefault();
      }
    });
    this.textInputElem.addEventListener('keyup', (evt) => {
      // In certain input modes, the <enter> key is used to select characters.
      // When in this mode, prevent <enter> from submitting:
      if (evt.isComposing) return;

      if (evt.key === 'Enter' && !evt.shiftKey) {
        this.flushInput();
        this.editor.focus();
      } else if (evt.key === 'Escape') {
        // Cancel input.
        this.textInputElem?.remove();
        this.textInputElem = null;
        this.editor.focus();

        this.removeExistingCommand?.unapply(this.editor);
        this.removeExistingCommand = null;
        this.editedComponent = null;
        this.stopShapeText();
        this.finishedEditing();
      }
    });

    this.textEditOverlay.replaceChildren(this.textInputElem);
    setTimeout(() => this.textInputElem?.focus(), 0);
  }

  public override setEnabled(enabled: boolean) {
    super.setEnabled(enabled);

    if (!this.isEnabled()) {
      this.flushInput();
    }

    this.textEditOverlay.style.display = enabled ? 'block' : 'none';
  }

  public override onPointerDown({ current, allPointers }: PointerEvt): boolean {
    if (current.device === PointerDevice.Eraser) {
      return false;
    }

    if (allPointers.length === 1) {
      // Are we clicking on a text node?
      const canvasPos = current.canvasPos;
      const halfTestRegionSize = Vec2.of(4, 4).times(this.editor.viewport.getSizeOfPixelOnCanvas());
      const testRegion = Rect2.fromCorners(
        canvasPos.minus(halfTestRegionSize),
        canvasPos.plus(halfTestRegionSize),
      );
      const targetNodes = this.editor.image.getComponentsIntersecting(testRegion);
      let targetTextNodes = targetNodes.filter(
        (node): node is TextComponent => node instanceof TextComponent && !node.isLocked(),
      );

      // Don't try to edit text nodes that contain the viewport (this allows us
      // to zoom in on text nodes and add text on top of them.)
      const visibleRect = this.editor.viewport.visibleRect;
      targetTextNodes = targetTextNodes.filter((node) => !node.getBBox().containsRect(visibleRect));

      // End any TextNodes we're currently editing.
      this.flushInput();

      if (targetTextNodes.length > 0) {
        this.editText(targetTextNodes[targetTextNodes.length - 1]);
      } else {
        this.removeExistingCommand = null;
        this.startTextInput(current.canvasPos, '');
      }
      return true;
    }

    return false;
  }

  /** Shows a text box to edit an existing text component. */
  public editText(targetNode: TextComponent) {
    this.flushInput();
    this.setTextStyle(targetNode.getTextStyle());

    // Create and temporarily apply removeExistingCommand.
    // The only text of a shape (e.g. typed with addTextIn): edited centered in the shape.
    const groupId = targetNode.getGroupId();
    const group = groupId === null ? [] : this.editor.image.getAllComponents().filter((c) => c.getGroupId() === groupId);
    const host = group.find(
      (c) => c instanceof Stroke && c.getMetadata().frame === undefined && c.getBBox().containsRect(targetNode.getBBox()),
    );
    const isShapeText = !!host && group.filter((c) => c instanceof TextComponent).length === 1;

    // Create and temporarily apply removeExistingCommand.
    this.removeExistingCommand = new Erase([targetNode]);
    this.removeExistingCommand.apply(this.editor);
    this.editedComponent = targetNode;

    // In a shape, lines are wrapped automatically: edit them as one paragraph.
    const text = isShapeText ? targetNode.getText().replaceAll('\n', ' ') : targetNode.getText();
    this.startTextInput(targetNode.getBaselinePos(), text);

    const transform = targetNode.getTransform();
    if (isShapeText) {
      this.attachTo = host;
      // Same size, centered on the shape.
      const translation = transform.transformVec2(Vec2.zero);
      this.contentTransform.set(Mat33.translation(host.getBBox().center.minus(translation)).rightMul(transform));
    } else {
      this.contentTransform.set(transform);
    }
    this.updateTextInput();
  }

  public override onGestureCancel(): void {
    this.flushInput();
    this.editor.focus();
  }

  public setFontFamily(fontFamily: string) {
    if (fontFamily !== this.textStyle.fontFamily) {
      this.textStyleValue.set({
        ...this.textStyle,
        fontFamily: fontFamily,
      });
    }
  }

  public setColor(color: Color4) {
    if (!color.eq(this.textStyle.renderingStyle.fill)) {
      this.textStyleValue.set({
        ...this.textStyle,
        renderingStyle: {
          ...this.textStyle.renderingStyle,
          fill: color,
        },
      });
    }
  }

  public setFontSize(size: number) {
    if (size !== this.textStyle.size) {
      this.textStyleValue.set({
        ...this.textStyle,
        size,
      });
    }
  }

  public getTextStyle(): TextRenderingStyle {
    return this.textStyle;
  }

  public getStyleValue(): MutableReactiveValue<TextRenderingStyle> {
    return this.textStyleValue;
  }

  private setTextStyle(style: TextRenderingStyle) {
    this.textStyleValue.set(style);
  }

  // @internal
  public override onDestroy() {
    super.onDestroy();
    this.anchorControl.remove();
  }
}
