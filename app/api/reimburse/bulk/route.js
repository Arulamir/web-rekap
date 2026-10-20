import { db } from '@/lib/db';
import { getSession, json } from '@/lib/auth';

export async function DELETE(req) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  if (session.role !== 'admin') return json({ error: 'Khusus admin.' }, 403);

  const body = await req.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 2000 ||
      ids.some((id) => !Number.isInteger(id) || id <= 0 || id > 2147483647)) {
    return json({ error: 'Pilih 1 hingga 2.000 item dengan ID yang valid.' }, 400);
  }

  const sql = await db();
  const deleted = await sql`
    DELETE FROM reimbursements WHERE id = ANY(${[...new Set(ids)]}::int[]) RETURNING id`;
  return json({ ok: true, count: deleted.length });
}
