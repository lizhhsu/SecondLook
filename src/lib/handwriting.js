// CoMER takes light ink on black, with a top-left-aligned expression.
function prepareEquation(video, region) {
  const canvas = document.createElement('canvas');
  const sourceWidth = region.width * video.videoWidth;
  const sourceHeight = region.height * video.videoHeight;
  const scale = Math.min(1, 1400 / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const { width, height } = canvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, region.x * video.videoWidth, region.y * video.videoHeight,
    sourceWidth, sourceHeight, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  const gray = index => (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
  const edges = [];
  for (let x = 0; x < width; x += 1) {
    edges.push(gray(x * 4), gray(((height - 1) * width + x) * 4));
  }
  for (let y = 0; y < height; y += 1) {
    edges.push(gray(y * width * 4), gray((y * width + width - 1) * 4));
  }
  edges.sort((a, b) => a - b);
  const background = edges[Math.floor(edges.length / 2)];
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const contrast = Math.abs(gray(index) - background);
      const ink = contrast < 24 ? 0 : Math.min(255, contrast * 1.4);
      data[index] = data[index + 1] = data[index + 2] = ink;
      if (ink > 80) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right - left < 8 || bottom - top < 6) return null;
  context.putImageData(image, 0, 0);

  const inkWidth = right - left + 1;
  const inkHeight = bottom - top + 1;
  const ratio = Math.min(96 / inkHeight, 992 / inkWidth);
  const contentWidth = Math.round(inkWidth * ratio) + 32;
  const contentHeight = Math.round(inkHeight * ratio) + 32;
  const output = document.createElement('canvas');
  output.width = Math.max(128, Math.ceil(contentWidth / 64) * 64);
  output.height = 256;
  const target = output.getContext('2d');
  target.drawImage(canvas, left, top, inkWidth, inkHeight, 16, 16, contentWidth - 32, contentHeight - 32);
  const pixels = target.getImageData(0, 0, output.width, output.height).data;
  const tensor = new Float32Array(output.width * output.height);
  const mask = new Uint8Array(tensor.length);
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const index = y * output.width + x;
      tensor[index] = pixels[index * 4] / 255;
      mask[index] = x >= contentWidth || y >= contentHeight ? 1 : 0;
    }
  }
  return { tensor, mask, width: output.width, height: output.height, maskWidth: output.width, maskHeight: output.height };
}

export function createHandwritingReader() {
  const worker = new Worker(new URL('./handwriting.worker.js', import.meta.url), { type: 'module' });
  let cancel;
  return {
    read(video, region) {
      const input = prepareEquation(video, region);
      if (!input) return Promise.resolve('');
      return new Promise((resolve, reject) => {
        const finish = (error, latex) => {
          clearTimeout(timeout);
          cancel = null;
          worker.onmessage = null;
          worker.onerror = null;
          if (error) reject(new Error('Handwriting recognition could not finish.'));
          else resolve(latex);
        };
        const timeout = setTimeout(() => finish(true), 45000);
        cancel = () => finish(true);
        worker.onerror = () => finish(true);
        worker.onmessage = ({ data }) => finish(data.error, data.latex);
        const baseUrl = new URL(import.meta.env.BASE_URL, document.baseURI).href;
        worker.postMessage({ input, baseUrl }, [input.tensor.buffer, input.mask.buffer]);
      });
    },
    stop() {
      cancel?.();
      worker.terminate();
    },
  };
}
