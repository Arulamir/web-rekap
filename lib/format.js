export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

export const tanggal = (d) =>
  new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

export const kategoriLabel = (c) => (c === 'material' ? 'Material' : 'Operasional');

// Kompres foto di browser agar upload cepat dan muat di batas body Vercel (4,5 MB).
export async function compressImage(file, maxSize = 1280, quality = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('File bukan gambar yang valid'));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('Gagal memproses gambar');
    return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
