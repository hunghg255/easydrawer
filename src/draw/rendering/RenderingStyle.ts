import { Color4 } from '~/math';

export interface StrokeStyle {
  readonly color: Color4;

  /** Note: The stroke `width` is twice the stroke radius. */
  readonly width: number;
}

/** A texture applied to a path's fill. */
export type FillTexture = 'pencil';

export interface RenderingStyle {
  readonly fill: Color4;
  readonly stroke?: StrokeStyle;
  /** Optional texture for the fill (e.g. pencil grain). */
  readonly texture?: FillTexture;
}

export default RenderingStyle;

export function cloneStyle (style: RenderingStyle) {
  return {
    fill: style.fill,
    texture: style.texture,
    stroke: style.stroke
      ? {
        ...style.stroke,
      }
      : undefined,
  };
}

export function stylesEqual (a: RenderingStyle, b: RenderingStyle): boolean {
  const result =
		a === b ||
		(a.fill.eq(b.fill) &&
			(a.stroke == undefined) === (b.stroke == undefined) &&
			(a.stroke?.color?.eq(b.stroke?.color) ?? true) &&
			a.stroke?.width === b.stroke?.width &&
			a.texture === b.texture);

  // Map undefined/null -> false
  return result ?? false;
}

// Returns an object that can be converted to a JSON string with
// JSON.stringify.
export function styleToJSON (style: RenderingStyle) {
  const stroke = !style.stroke
    ? undefined
    : {
      color: style.stroke.color.toHexString(),
      width: style.stroke.width,
    };

  return {
    fill: style.fill.toHexString(),
    stroke,
    ...(style.texture ? { texture: style.texture } : {}),
  };
}

export function styleFromJSON (json: Record<string, any>) {
  const stroke = json.stroke
    ? {
      color: Color4.fromHex(json.stroke.color),
      width: json.stroke.width,
    }
    : undefined;
  return {
    fill: Color4.fromHex(json.fill),
    stroke,
    ...(json.texture === 'pencil' ? { texture: 'pencil' as const } : {}),
  };
}
