async function waitForImageLoad (image: HTMLImageElement) {
  if (!image.complete) {
    await new Promise((resolve, reject) => {
      image.addEventListener('load', (event) => resolve(event));

      // TODO(v2): Return a `new Error(event.message)`

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      image.onerror = (event) => reject(event);

      image.addEventListener('abort', (event) => reject(event));
    });
  }
}

export default waitForImageLoad;
