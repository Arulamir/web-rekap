import { db } from '@/lib/db';
import { getSession, json } from '@/lib/auth';

// Daftar project yang pernah diinput, untuk saran saat mengetik.
export async function GET() {
  const session = await getSession();
  if (!session) return json({ error: 'Silakan login.' }, 401);
  const sql = await db();
  const rows = await sql`
    SELECT project FROM reimbursements GROUP BY project ORDER BY MAX(created_at) DESC LIMIT 100`;
  return json({ projects: rows.map((r) => r.project) });
}
