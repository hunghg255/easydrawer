import { Color4, type LineSegment2, Mat33, type Mat33Array, Path, Rect2, Vec2, type IVec2 } from '~/math';

import AbstractComponent, { componentSVGAttribute } from './AbstractComponent';
import { type ImageComponentLocalization } from './localization';
import type RestyleableComponent from './RestylableComponent';
import { type ComponentStyle, createRestyleComponentCommand } from './RestylableComponent';
import TextComponent from './TextComponent';
import SerializableCommand from '../commands/SerializableCommand';
import UnresolvedSerializableCommand from '../commands/UnresolvedCommand';
import type Editor from '../Editor';
import { type EditorLocalization } from '../localization';
import { pathToRenderable } from '../rendering/RenderablePathSpec';
import type AbstractRenderer from '../rendering/renderers/AbstractRenderer';
import type TextRenderingStyle from '../rendering/TextRenderingStyle';
import { assertIsString } from '../util/assertions';

const componentKind = 'sticky-note';

export interface StickyNoteOptions {
  /** Default: `''`. */
  text?: string;
  /** Background color of the note. Default: yellow. */
  color?: Color4;
  /** Default: `Color4.fromHex('#1f2937')`. */
  textColor?: Color4;
  /** Font size, in canvas units. Default: `20`. */
  fontSize?: number;
  /** Width and minimum height, in canvas units. The note grows to fit its text. Default: `200×200`. */
  size?: IVec2;
}

const defaultNoteColor = Color4.fromHex('#fde68a');
const padding = 16;
const cornerRadius = 6;
const lineHeightRatio = 1.3;

/**
 * A sticky note: a colored square with wrapped text. Created with the `'sticky'` tool.
 *
 * Its text can be changed with {@link setText}, its color with {@link updateStyle}.
 */
export default class StickyNote extends AbstractComponent implements RestyleableComponent {
  protected contentBBox: Rect2 = Rect2.empty;
  public readonly isRestylableComponent = true;

  private text: string;
  private color: Color4;
  private textColor: Color4;
  private fontSize: number;
  private size: IVec2;
  private lines: string[] = [];
  private height = 0;

  /**
   * @param transform - Maps note coordinates (`(0, 0)` is the top-left corner of the note) to
   *                    canvas coordinates.
   */
  public constructor(
    private transform: Mat33,
    options: StickyNoteOptions = {},
  ) {
    super(componentKind);
    this.text = options.text ?? '';
    this.color = options.color ?? defaultNoteColor;
    this.textColor = options.textColor ?? Color4.fromHex('#1f2937');
    this.fontSize = options.fontSize ?? 20;
    this.size = Vec2.of(options.size?.x ?? 200, options.size?.y ?? 200);
    this.layout();
  }

  /** Creates a note centered on `center` (canvas coordinates). */
  public static centeredAt(center: IVec2, options: StickyNoteOptions = {}) {
    const width = options.size?.x ?? 200;
    const height = options.size?.y ?? width;
    return new StickyNote(Mat33.translation(Vec2.of(center.x - width / 2, center.y - height / 2)), options);
  }

  private get textStyle(): TextRenderingStyle {
    return {
      size: this.fontSize,
      fontFamily: 'sans-serif',
      renderingStyle: { fill: this.textColor },
    };
  }

  private get lineHeight() {
    return this.fontSize * lineHeightRatio;
  }

  // Wraps the text to the width of the note.
  private wrapText(): string[] {
    const style = this.textStyle;
    const maxWidth = this.size.x - padding * 2;
    const measure = (text: string) => TextComponent.measureTextWidth(text, style);
    const result: string[] = [];

    for (const paragraph of this.text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate) <= maxWidth) {
          line = candidate;
          continue;
        }

        if (line) result.push(line);
        line = '';

        // Break words that don't fit on a line on their own.
        let rest = word;
        while (measure(rest) > maxWidth && rest.length > 1) {
          let end = rest.length - 1;
          while (end > 1 && measure(rest.slice(0, end)) > maxWidth) end--;
          result.push(rest.slice(0, end));
          rest = rest.slice(end);
        }
        line = rest;
      }
      result.push(line);
    }

    return result;
  }

  private layout() {
    this.lines = this.text ? this.wrapText() : [];
    this.height = Math.max(this.size.y, padding * 2 + this.lines.length * this.lineHeight);
    this.contentBBox = this.localRect.transformedBoundingBox(this.transform);
  }

  private get localRect() {
    return new Rect2(0, 0, this.size.x, this.height);
  }

  private notePath(offset: IVec2 = Vec2.zero) {
    const { w, h } = this.localRect;
    const r = cornerRadius;
    const x = offset.x;
    const y = offset.y;
    return Path.fromString(
      `M${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} ` +
				`L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} ` +
				`L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} ` +
				`L${x},${y + r} Q${x},${y} ${x + r},${y} Z`,
    ).transformedBy(this.transform);
  }

  public override render(canvas: AbstractRenderer, _visibleRect?: Rect2): void {
    canvas.startObject(this.contentBBox);

    // A soft shadow below the note
    canvas.drawPath(
      pathToRenderable(this.notePath(Vec2.of(0, 3)), { fill: Color4.ofRGBA(0, 0, 0, 0.12) }),
    );
    canvas.drawPath(pathToRenderable(this.notePath(), { fill: this.color }));

    // pushTransform also draws the paths above, so they stay below the text.
    canvas.pushTransform(this.transform);
    const style = this.textStyle;
    for (const [i, line] of this.lines.entries()) {
      if (!line) continue;
      const baseline = padding + (i + 1) * this.lineHeight - (this.lineHeight - this.fontSize) / 2 - this.fontSize * 0.2;
      canvas.drawText(line, Mat33.translation(Vec2.of(padding, baseline)), style);
    }
    canvas.popTransform();

    canvas.endObject(this.getLoadSaveData());
  }

  public override intersects(lineSegment: LineSegment2): boolean {
    const toLocal = this.transform.inverse();
    const p1 = toLocal.transformVec2(lineSegment.p1);
    const p2 = toLocal.transformVec2(lineSegment.p2);
    const rect = this.localRect;
    if (rect.containsPoint(p1) || rect.containsPoint(p2)) {
      return true;
    }

    const notePath = this.notePath();
    return notePath.intersection(lineSegment).length > 0;
  }

  public override keyPoints() {
    return this.localRect.corners.map((corner) => this.transform.transformVec2(corner));
  }

  protected applyTransformation(affineTransfm: Mat33): void {
    this.transform = affineTransfm.rightMul(this.transform);
    this.layout();
  }

  public getText() {
    return this.text;
  }

  /** The note's rectangle in canvas coordinates (before rotation). */
  public getTransform() {
    return this.transform;
  }

  /** Width and height of the note, in note coordinates. */
  public getSize() {
    return Vec2.of(this.size.x, this.height);
  }

  public getFontSize() {
    return this.fontSize;
  }

  public getColor() {
    return this.color;
  }

  public getTextColor() {
    return this.textColor;
  }

  /** Returns a command that changes the note's text. */
  public setText(text: string): SerializableCommand {
    return new StickyNote.SetTextCommand(this.getId(), this.text, text, this);
  }

  private static setTextCommandId = 'sticky-note-set-text';
  private static SetTextCommand = class extends UnresolvedSerializableCommand {
    public constructor(
      componentID: string,
      private oldText: string,
      private newText: string,
      component?: AbstractComponent,
    ) {
      super(StickyNote.setTextCommandId, componentID, component);
    }

    private setText(editor: Editor, text: string) {
      this.resolveComponent(editor.image);
      const note = this.component as StickyNote;
      note.text = text;
      note.layout();
      editor.image.queueRerenderOf(note);
      editor.queueRerender();
    }

    public apply(editor: Editor) {
      this.setText(editor, this.newText);
    }

    public unapply(editor: Editor) {
      this.setText(editor, this.oldText);
    }

    public description(_editor: Editor, localizationTable: EditorLocalization) {
      return localizationTable.editedNoteText;
    }

    protected serializeToJSON() {
      return { id: this.componentID, oldText: this.oldText, newText: this.newText };
    }

    static {
      SerializableCommand.register(StickyNote.setTextCommandId, (json: any, editor: Editor) => {
        assertIsString(json.id);
        assertIsString(json.oldText);
        assertIsString(json.newText);
        const elem = editor.image.lookupElement(json.id) ?? undefined;
        return new StickyNote.SetTextCommand(json.id, json.oldText, json.newText, elem);
      });
    }
  };

  public getStyle(): ComponentStyle {
    return { color: this.color };
  }

  public updateStyle(style: ComponentStyle): SerializableCommand {
    return createRestyleComponentCommand(this.getStyle(), style, this);
  }

  public forceStyle(style: ComponentStyle, editor: Editor | null): void {
    if (!style.color) return;
    this.color = style.color;

    if (editor) {
      editor.image.queueRerenderOf(this);
      editor.queueRerender();
    }
  }

  protected override getEasydrawerSVGAttributes(): Array<[string, string]> {
    // Saved as JSON so the note can be loaded back as a note (rather than a path and a text).
    const json = { name: componentKind, id: this.getId(), zIndex: this.getZIndex(), data: this.serializeToJSON() };
    return [...super.getEasydrawerSVGAttributes(), [componentSVGAttribute, JSON.stringify(json)]];
  }

  public description(localizationTable: ImageComponentLocalization): string {
    return localizationTable.stickyNote(this.text);
  }

  protected createClone(): AbstractComponent {
    return new StickyNote(this.transform, this.getOptions());
  }

  private getOptions(): StickyNoteOptions {
    return {
      text: this.text,
      color: this.color,
      textColor: this.textColor,
      fontSize: this.fontSize,
      size: this.size,
    };
  }

  protected serializeToJSON() {
    return {
      text: this.text,
      color: this.color.toHexString(),
      textColor: this.textColor.toHexString(),
      fontSize: this.fontSize,
      size: [this.size.x, this.size.y],
      transform: this.transform.toArray(),
    };
  }

  public static deserializeFromJSON(json: any): StickyNote {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    const transform = (json.transform ?? []).filter((n: unknown) => typeof n === 'number');
    if (transform.length !== 9) {
      throw new Error(`Invalid sticky note transform: ${json.transform}`);
    }

    const number = (value: unknown, fallback: number) =>
      typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;

    return new StickyNote(new Mat33(...(transform as Mat33Array)), {
      text: typeof json.text === 'string' ? json.text : '',
      color: typeof json.color === 'string' ? Color4.fromString(json.color) : undefined,
      textColor: typeof json.textColor === 'string' ? Color4.fromString(json.textColor) : undefined,
      fontSize: number(json.fontSize, 20),
      size: Vec2.of(number(json.size?.[0], 200), number(json.size?.[1], 200)),
    });
  }
}

AbstractComponent.registerComponent(componentKind, StickyNote.deserializeFromJSON);
