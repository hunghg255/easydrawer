import { Mat33 } from '~/math';

import type { RenderableImage } from '../../../rendering/renderers/AbstractRenderer';
import fileToBase64Url from '../../../util/fileToBase64Url';

async function fileToImages (imageFile: File): Promise<RenderableImage[]> {
  const result: RenderableImage[] = [];

  const imageElement = new Image();

  const base64Url = await fileToBase64Url(imageFile);
  if (base64Url) {
    result.push({
      image: imageElement,
      base64Url: base64Url,
      transform: Mat33.identity,
    });
  }

  return result;
}

export default fileToImages;
