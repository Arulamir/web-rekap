import { getSession, json } from '@/lib/auth';
import { db } from '@/lib/db';
import { claimOcrQuota } from '@/lib/ocr-quota';
import { readReceiptAi, ReceiptAiError } from '@/lib/receipt-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  const origin = req.headers.get('origin');
  // Next can reconstruct req.url with an internal hostname behind a proxy.
  // Host/protocol describe the browser-facing origin on Vercel and localhost.
  const requestUrl = new URL(req.url);
  const expectedOrigin = `${req.headers.get('x-forwarded-proto') || requestUrl.protocol.slice(0, -1)}://${req.headers.get('host') || requestUrl.host}`;
  if (origin && origin !== expectedOrigin) return json({ error: 'Asal permintaan tidak diizinkan.' }, 403);
  if (!process.env.GROQ_API_KEY) return json({ error: 'GROQ_API_KEY belum diset di server. Gunakan OCR browser sementara.' }, 503);
  const length = Number(req.headers.get('content-length'));
  if (length > 3.3 * 1024 * 1024) return json({ error: 'Foto OCR maksimal 3 MB. Perkecil atau batasi area foto.' }, 413);
  let photo;
  try { photo = (await req.formData()).get('photo'); }
  catch { return json({ error: 'Unggah foto dalam format formulir.' }, 400); }
  if (!(photo instanceof File) || !['image/jpeg', 'image/png'].includes(photo.type) || !photo.size || photo.size > 3 * 1024 * 1024) return json({ error: 'Foto OCR harus JPEG/PNG, maksimal 3 MB.' }, 400);
  try {
    const bytes = Buffer.from(await photo.arrayBuffer());
    const valid = photo.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!valid) return json({ error: 'Isi file bukan foto JPEG/PNG yang valid.' }, 400);
    const sql = await db();
    if (!await claimOcrQuota(sql, `user:${session.id}`, 2, 20)) return json({ error: 'Batas AI akun ini tercapai (2 kali/menit, 20 kali/hari). Gunakan OCR browser atau coba lagi nanti.' }, 429);
    if (!await claimOcrQuota(sql, 'global', 5, 100)) return json({ error: 'Batas AI website tercapai (5 kali/menit, 100 kali/hari). Gunakan OCR browser atau coba lagi nanti.' }, 429);
    const result = await readReceiptAi({ bytes, mimeType: photo.type, signal: req.signal });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return json({ error: error instanceof ReceiptAiError ? error.message : 'Pemrosesan AI gagal. Coba lagi atau gunakan OCR browser.' }, error instanceof ReceiptAiError ? error.status : 500);
  }
}
