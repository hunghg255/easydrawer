import { type IVec3, type IVec2 } from '~/math';

import type Pointer from './Pointer';

export type HTMLPointerEventName = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';
export type HTMLPointerEventFilter = (
  eventName: HTMLPointerEventName,
  event: PointerEvent,
) => boolean;

export interface PointerEvtListener {
  onPointerDown(event: PointerEvt): boolean;
  onPointerMove(event: PointerEvt): void;
  onPointerUp(event: PointerEvt): void;

  // Called if a pointer that has been captured by this listener (by returning
  // `true` from `onPointerDown`) is re-captured by another listener.
  //
  // When called, this method should cancel any changes being made by the current
  // gesture.
  onGestureCancel(): void;
}

export enum InputEvtType {
  PointerDownEvt,
  PointerMoveEvt,
  PointerUpEvt,
  GestureCancelEvt,

  WheelEvt,
  KeyPressEvent,
  KeyUpEvent,

  CopyEvent,
  PasteEvent,

  ContextMenu,
}

// [delta.x] is horizontal scroll,
// [delta.y] is vertical scroll,
// [delta.z] is zoom scroll (ctrl+scroll or pinch zoom)
export interface WheelEvt {
  readonly kind: InputEvtType.WheelEvt;
  readonly delta: IVec3;
  readonly screenPos: IVec2;
}

interface BaseKeyEvent {
  // key, as given by an HTML `KeyboardEvent`
  readonly key: string;
  readonly code: string;

  // If `ctrlKey` is undefined, that is equivalent to `ctrlKey = false`.
  readonly ctrlKey: boolean | undefined;

  // If falsey, the `alt` key is not pressed.
  readonly altKey: boolean | undefined;

  // If falsey, the `shift` key is not pressed.
  readonly shiftKey: boolean | undefined;
}

/**
 * Represents a keydown or auto-repeated keydown event.
 *
 * Use {@link keyPressEventFromHTMLEvent} where possible rather than
 * constructing directly (required properties may change between minor
 * releases).
 */
export interface KeyPressEvent extends BaseKeyEvent {
  readonly kind: InputEvtType.KeyPressEvent;
}

/**
 * Represents a key release or auto-repeated key releae event.
 *
 * Use {@link keyUpEventFromHTMLEvent} where possible rather than
 * constructing directly (required properties may change between minor
 * releases).
 */
export interface KeyUpEvent extends BaseKeyEvent {
  readonly kind: InputEvtType.KeyUpEvent;
}

export interface CopyEvent {
  readonly kind: InputEvtType.CopyEvent;
  setData(mime: string, data: string | Promise<Blob>): void;
}

export interface PasteEvent {
  readonly kind: InputEvtType.PasteEvent;
  readonly data: string;
  readonly mime: string;
}

// Event triggered when pointer capture is taken by a different [PointerEvtListener].
export interface GestureCancelEvt {
  readonly kind: InputEvtType.GestureCancelEvt;
}

interface PointerEvtBase {
  readonly current: Pointer;
  readonly allPointers: Pointer[];
}

export interface PointerDownEvt extends PointerEvtBase {
  readonly kind: InputEvtType.PointerDownEvt;
}

export interface PointerMoveEvt extends PointerEvtBase {
  readonly kind: InputEvtType.PointerMoveEvt;
}

export interface PointerUpEvt extends PointerEvtBase {
  readonly kind: InputEvtType.PointerUpEvt;
}

export interface ContextMenuEvt {
  readonly kind: InputEvtType.ContextMenu;
  readonly screenPos: IVec2;
  readonly canvasPos: IVec2;
}

/**
 * An internal `easydrawer` pointer event type.
 *
 * This **is not** the same as a DOM pointer event.
 */
export type PointerEvt = PointerDownEvt | PointerMoveEvt | PointerUpEvt;

/** The type of any internal {@link PointerEvt} record. */
export type PointerEvtType =
	| InputEvtType.PointerDownEvt
	| InputEvtType.PointerMoveEvt
	| InputEvtType.PointerUpEvt;

/**
 * An internal `easydrawer` input event type.
 *
 * These are not DOM events.
 */
export type InputEvt =
	| KeyPressEvent
	| KeyUpEvent
	| WheelEvt
	| GestureCancelEvt
	| PointerEvt
	| CopyEvent
	| PasteEvent
	| ContextMenuEvt;

type KeyEventType = InputEvtType.KeyPressEvent | InputEvtType.KeyUpEvent;

// Constructor
function keyEventFromHTMLEvent (kind: KeyEventType,
  event: KeyboardEvent): KeyPressEvent | KeyUpEvent {
  return {
    kind,
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey || event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  };
}

export function keyUpEventFromHTMLEvent (event: KeyboardEvent) {
  return keyEventFromHTMLEvent(InputEvtType.KeyUpEvent, event) as KeyUpEvent;
}

export function keyPressEventFromHTMLEvent (event: KeyboardEvent) {
  return keyEventFromHTMLEvent(InputEvtType.KeyPressEvent, event) as KeyPressEvent;
}

export function isPointerEvt (event: InputEvt): event is PointerEvt {
  return (
    event.kind === InputEvtType.PointerDownEvt ||
		event.kind === InputEvtType.PointerMoveEvt ||
		event.kind === InputEvtType.PointerUpEvt
  );
}
