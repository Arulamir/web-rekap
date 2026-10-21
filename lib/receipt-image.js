import { receiptCrop, enhanceReceiptPixels } from './receipt-preprocess.js';

export async function prepareReceiptImage(file, rotation = 0, maxSize = 2400, options = {}) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Foto tidak dapat dibaca. Gunakan JPEG atau PNG.'));
      img.src = url;
    });
    const crop = receiptCrop(image.width, image.height, options.crop);
    const radians = rotation * Math.PI / 180;
    const rotatedWidth = Math.abs(crop.width * Math.cos(radians)) + Math.abs(crop.height * Math.sin(radians));
    const rotatedHeight = Math.abs(crop.width * Math.sin(radians)) + Math.abs(crop.height * Math.cos(radians));
    const scale = Math.min(options.upscale ? 2 : 1, maxSize / Math.max(rotatedWidth, rotatedHeight));
    const w = crop.width * scale, h = crop.height * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
    canvas.height = Math.max(1, Math.round(rotatedHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(radians);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, -w / 2, -h / 2, w, h);
    if (options.mode && options.mode !== 'original') {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      pixels.data.set(enhanceReceiptPixels(pixels.data, canvas.width, canvas.height, options.mode));
      context.putImageData(pixels, 0, 0);
    }
    const type = options.lossless ? 'image/png' : 'image/jpeg';
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], options.lossless ? 'nota-ocr.png' : 'nota.jpg', { type })) : reject(new Error('Gagal memproses foto.')), type, 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}
