import { db } from '@/lib/db';
import { getSession, json } from '@/lib/auth';

export async function DELETE(req, { params }) {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: 'ID tidak valid.' }, 400);

  const sql = await db();
  const rows =
    session.role === 'admin'
      ? await sql`DELETE FROM reimbursements WHERE id = ${id} RETURNING id`
      : await sql`DELETE FROM reimbursements WHERE id = ${id} AND user_id = ${session.id} RETURNING id`;
  if (!rows.length) return json({ error: 'Data tidak ditemukan.' }, 404);
  return json({ ok: true });
}
