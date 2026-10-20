import { db, buildFilter, filtersFromUrl } from '@/lib/db';
import { getSession, json } from '@/lib/auth';

// Rekap per orang (admin): jumlah item & total per user, mengikuti filter project/kategori/tanggal.
export async function GET(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  if (session.role !== 'admin') return json({ error: 'Khusus admin.' }, 403);

  const { where, params } = buildFilter({ ...filtersFromUrl(req.url), userId: null });
  const sql = await db();
  const people = await sql.query(
    `SELECT u.id, u.name, u.email, COUNT(*)::int AS items,
            COALESCE(SUM(r.price) FILTER (WHERE r.category = 'operasional'), 0)::float8 AS operasional,
            COALESCE(SUM(r.price) FILTER (WHERE r.category = 'material'), 0)::float8 AS material,
            SUM(r.price)::float8 AS total
     FROM reimbursements r JOIN users u ON u.id = r.user_id
     ${where}
     GROUP BY u.id, u.name, u.email
     ORDER BY u.name`,
    params,
  );
  return json({ people });
}
