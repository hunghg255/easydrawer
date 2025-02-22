import { type Point2 } from '~/math';

/** Swipes `element` using HTML pointer events. */
async function sendHtmlSwipe (element: HTMLElement,
  start: Point2,
  end: Point2,
  timeMs = 300) {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { isPrimary: true, clientX: start.x, clientY: start.y }),
  );

  const step = 0.1;
  for (let i = 0; i < 1; i += step) {
    await jest.advanceTimersByTimeAsync(timeMs * step);

    const currentPoint = start.lerp(end, i);
    element.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: currentPoint.x,
        clientY: currentPoint.y,
      }),
    );
  }

  element.dispatchEvent(
    new PointerEvent('pointerup', { isPrimary: true, clientX: end.x, clientY: end.y }),
  );
}

export default sendHtmlSwipe;
