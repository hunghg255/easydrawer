import { type Point2 } from '~/math';

import getUniquePointerId from './getUniquePointerId';
import type Editor from '../Editor';
import { InputEvtType, type PointerEvtType } from '../inputEvents';
import Pointer, { PointerDevice } from '../Pointer';

/**
 * Dispatch a pen event to the currently selected tool.
 * Intended for unit tests.
 *
 * @see {@link sendTouchEvent}
 */
function sendPenEvent (editor: Editor,
  eventType: PointerEvtType,
  point: Point2,

  allPointers?: Pointer[],

  deviceType: PointerDevice = PointerDevice.Pen) {
  const id = getUniquePointerId(allPointers ?? []);

  const mainPointer = Pointer.ofCanvasPoint(
    point,
    eventType !== InputEvtType.PointerUpEvt,
    editor.viewport,
    id,
    deviceType,
  );

  editor.toolController.dispatchInputEvent({
    kind: eventType,
    allPointers: allPointers ?? [mainPointer],
    current: mainPointer,
  });

  return mainPointer;
}
export default sendPenEvent;
