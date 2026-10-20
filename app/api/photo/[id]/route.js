import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return Response.redirect(new URL('/login', req.url), 303);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response('ID tidak valid', { status: 400 });

  const sql = await db();
  const [row] = await sql`SELECT user_id, photo_data, photo_type FROM reimbursements WHERE id = ${id}`;
  if (!row || (session.role !== 'admin' && row.user_id !== session.id)) {
    return new Response('Foto tidak ditemukan', { status: 404 });
  }
  return new Response(Buffer.from(row.photo_data, 'base64'), {
    headers: { 'Content-Type': row.photo_type, 'Cache-Control': 'private, max-age=86400' },
  });
}
