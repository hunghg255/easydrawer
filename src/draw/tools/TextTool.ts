import { Rect2, Mat33, Vec2, Color4, type IVec2 } from '~/math';

import BaseTool from './BaseTool';
import { type ToolLocalization } from './localization';
import Erase from '../commands/Erase';
import uniteCommands from '../commands/uniteCommands';
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

  public constructor(
    private editor: Editor,
    description: string,
    private localizationTable: ToolLocalization,
  ) {
    super(editor.notifier, description);
    const editorFonts = editor.getCurrentSettings().text?.fonts ?? [];
    this.textStyleValue = ReactiveValue.fromInitialValue({
      size: 32,
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
				background-color: rgba(0, 0, 0, 0.1);

				white-space: pre;
				overflow: hidden;

				padding: 8px;
				margin: 0;

				min-width: 100px;
				min-height: 1.1em;
        border: 1px solid black;
        border-radius: 6px;
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

      const textComponent = TextComponent.fromLines(
        content.split('\n'),
        scrollTransform.rightMul(this.contentTransform.get()),
        this.textStyle,
      );

      const action = EditorImage.addComponent(textComponent);
      if (this.removeExistingCommand) {
        // Unapply so that `removeExistingCommand` can be added to the undo stack.
        this.removeExistingCommand.unapply(this.editor);

        this.editor.dispatch(uniteCommands([this.removeExistingCommand, action]));
        this.removeExistingCommand = null;
      } else {
        this.editor.dispatch(action);
      }
    }
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
        this.textInputElem.style.width = `${this.textInputElem.scrollWidth}px`;
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
      let targetTextNodes = targetNodes.filter((node) => node instanceof TextComponent);

      // Don't try to edit text nodes that contain the viewport (this allows us
      // to zoom in on text nodes and add text on top of them.)
      const visibleRect = this.editor.viewport.visibleRect;
      targetTextNodes = targetTextNodes.filter((node) => !node.getBBox().containsRect(visibleRect));

      // End any TextNodes we're currently editing.
      this.flushInput();

      if (targetTextNodes.length > 0) {
        const targetNode = targetTextNodes[targetTextNodes.length - 1];
        this.setTextStyle(targetNode.getTextStyle());

        // Create and temporarily apply removeExistingCommand.
        this.removeExistingCommand = new Erase([targetNode]);
        this.removeExistingCommand.apply(this.editor);

        this.startTextInput(targetNode.getBaselinePos(), targetNode.getText());

        this.contentTransform.set(targetNode.getTransform());
        this.updateTextInput();
      } else {
        this.removeExistingCommand = null;
        this.startTextInput(current.canvasPos, '');
      }
      return true;
    }

    return false;
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
