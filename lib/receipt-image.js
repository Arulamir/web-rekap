export async function prepareReceiptImage(file, rotation = 0, maxSize = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Foto tidak dapat dibaca. Gunakan JPEG atau PNG.'));
      img.src = url;
    });
    const rotated = rotation % 180 !== 0;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = rotated ? h : w;
    canvas.height = rotated ? w : h;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.drawImage(image, -w / 2, -h / 2, w, h);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], 'nota.jpg', { type: 'image/jpeg' })) : reject(new Error('Gagal memproses foto.')), 'image/jpeg', 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}
