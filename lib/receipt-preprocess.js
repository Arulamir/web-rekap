// Percent bounds are shared by the crop overlay and the actual pixel crop.
export const FULL_RECEIPT = { left: 0, top: 0, right: 100, bottom: 100 };

export function receiptCrop(width, height, bounds = FULL_RECEIPT) {
  const values = ['left', 'top', 'right', 'bottom'].map((key) => Number(bounds[key]));
  if (!values.every(Number.isFinite)) throw new Error('Area baca tidak valid.');
  const [left, top, right, bottom] = values;
  if (left < 0 || top < 0 || right > 100 || bottom > 100 || right - left < 2 || bottom - top < 2) throw new Error('Area baca terlalu kecil atau di luar foto.');
  const x = Math.floor(width * left / 100), y = Math.floor(height * top / 100);
  return { x, y, width: Math.max(1, Math.ceil(width * right / 100) - x), height: Math.max(1, Math.ceil(height * bottom / 100) - y) };
}

// Local illumination normalization retains gray strokes; binary is an optional
// alternative for uneven paper. Never infer, redraw, or replace characters.
export function enhanceReceiptPixels(data, width, height, mode = 'contrast') {
  if (!['original', 'contrast', 'binary'].includes(mode)) throw new Error('Mode gambar tidak valid.');
  if (data.length !== width * height * 4) throw new Error('Ukuran piksel tidak valid.');
  const output = new Uint8ClampedArray(data);
  if (mode === 'original') return output;
  const gray = new Uint8Array(width * height);
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4, alpha = data[p + 3] / 255;
      gray[i] = Math.round((data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114) * alpha + 255 * (1 - alpha));
      row += gray[i];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const radius = Math.max(16, Math.min(80, Math.round(Math.min(width, height) / 30)));
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1);
      const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
      const i = y * width + x;
      const normalized = Math.min(255, (gray[i] + 16) * 255 / (mean + 16));
      const value = mode === 'binary' ? (normalized < 210 ? 0 : 255) : Math.max(0, Math.round(255 - (255 - normalized) * 1.7));
      output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = value;
      output[i * 4 + 3] = 255;
    }
  }
  return output;
}
