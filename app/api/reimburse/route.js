import { db, buildFilter, filtersFromUrl } from '@/lib/db';
import { getSession, json } from '@/lib/auth';
import { normalizeItem } from '@/lib/reimburse-item';
import { purchaseDateToIso } from '@/lib/purchase-date';

const MAX_ITEMS = 10;
const MAX_PHOTO = 3 * 1024 * 1024;

export async function GET(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);

  const all = session.role === 'admin' && new URL(req.url).searchParams.get('scope') === 'all';
  const filters = filtersFromUrl(req.url);
  const { where, params } = buildFilter({ ...filters, userId: all ? filters.user : session.id });
  const sql = await db();
  const rows = await sql.query(
    `SELECT r.id, r.user_name, u.email, r.project, r.category, r.item, r.price::float8 AS price,
            r.quantity::float8 AS quantity, COALESCE(r.unit_price, r.price)::float8 AS unit_price,
            r.purchase_date::text AS purchase_date, r.created_at
     FROM reimbursements r JOIN users u ON u.id = r.user_id
     ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT 2000`,
    params,
  );
  return json({ rows });
}

export async function POST(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);

  const fd = await req.formData();
  const project = String(fd.get('project') || '').trim();
  const category = String(fd.get('category') || '');
  const photoMode = String(fd.get('photo_mode') || 'per-item');
  if (!['per-item', 'shared'].includes(photoMode)) return json({ error: 'Mode foto tidak valid.' }, 400);
  let items;
  try {
    items = JSON.parse(String(fd.get('items') || '[]'));
  } catch {
    return json({ error: 'Data item tidak valid.' }, 400);
  }

  if (!project || project.length > 150) return json({ error: 'Nama project wajib diisi (maks. 150 karakter).' }, 400);
  if (!['operasional', 'material'].includes(category)) return json({ error: 'Pilih kategori Operasional atau Material.' }, 400);
  if (!Array.isArray(items) || items.length === 0) return json({ error: 'Minimal 1 item.' }, 400);
  if (items.length > MAX_ITEMS) return json({ error: `Maksimal ${MAX_ITEMS} item per pengajuan.` }, 400);

  const sql = await db();
  const inserts = [];
  const sharedPhoto = photoMode === 'shared' ? fd.get('photo_shared') : null;
  let sharedData;
  for (let i = 0; i < items.length; i++) {
    let normalized;
    let purchaseDate = null;
    try {
      normalized = normalizeItem(items[i]);
      // Historical clients can omit this field; explicit dates must be valid.
      if (items[i]?.purchase_date !== undefined && items[i]?.purchase_date !== null) purchaseDate = purchaseDateToIso(items[i].purchase_date);
    } catch (err) {
      return json({ error: `Item #${i + 1}: ${err.message}` }, 400);
    }
    const { item, quantity, unitPrice, price } = normalized;
    const photo = photoMode === 'shared' ? sharedPhoto : fd.get(`photo_${i}`);
    const n = i + 1;
    if (!photo || typeof photo === 'string' || photo.size === 0) return json({ error: `Item #${n}: foto wajib diunggah.` }, 400);
    if (!photo.type.startsWith('image/')) return json({ error: `Item #${n}: file harus berupa gambar.` }, 400);
    if (photo.size > MAX_PHOTO) return json({ error: `Item #${n}: ukuran foto maksimal 3 MB.` }, 400);

    const data = sharedData ?? Buffer.from(await photo.arrayBuffer()).toString('base64');
    if (photoMode === 'shared') sharedData = data;
    inserts.push(sql`
      INSERT INTO reimbursements (user_id, user_name, project, category, item, quantity, unit_price, price, purchase_date, photo_data, photo_type)
      VALUES (${session.id}, ${session.name}, ${project}, ${category}, ${item}, ${quantity}, ${unitPrice}, ${price}, ${purchaseDate}, ${data}, ${photo.type})`);
  }
  await sql.transaction(inserts);
  return json({ ok: true, count: inserts.length });
}
