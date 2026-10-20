import { db, buildFilter, filtersFromUrl } from '@/lib/db';
import { getSession, json } from '@/lib/auth';
import { buildRekapPdf } from '@/lib/pdf';

export const maxDuration = 60;

function describeFilters(f) {
  const parts = [];
  if (f.project) parts.push(`Project "${f.project}"`);
  if (f.category) parts.push(f.category === 'material' ? 'Material' : 'Operasional');
  if (f.from || f.to) parts.push(`Tanggal ${f.from || '...'} s/d ${f.to || '...'}`);
  return parts.length ? parts.join(', ') : 'Semua data';
}

// Hanya admin yang boleh mengekspor rekap ke PDF.
export async function GET(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  if (session.role !== 'admin') return json({ error: 'Hanya admin yang dapat mengekspor data.' }, 403);

  const filters = filtersFromUrl(req.url);
  const { where, params } = buildFilter({ ...filters, userId: filters.user });
  const sql = await db();
  let person = null;
  if (filters.user) {
    [person] = await sql`SELECT name, email FROM users WHERE id = ${filters.user}`;
    if (!person) return json({ error: 'User tidak ditemukan.' }, 404);
  }
  const rows = await sql.query(
    `SELECT r.id, r.user_name, r.project, r.category, r.item, r.price::float8 AS price,
            r.photo_data, r.photo_type, r.created_at
     FROM reimbursements r
     ${where} ORDER BY r.created_at ASC, r.id ASC`,
    params,
  );

  const pdf = await buildRekapPdf({
    rows,
    filterText: describeFilters(filters),
    generatedBy: session.name,
    person: person ? `${person.name} (${person.email})` : null,
  });
  const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const slug = person ? '-' + person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rekap-reimburse${slug}-${stamp}.pdf"`,
    },
  });
}
