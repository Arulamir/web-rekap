import { neon } from '@neondatabase/serverless';
import { initDb } from './schema.js';

let sqlClient;
let ready;

// Mengembalikan client Neon; skema dibuat otomatis sekali per instance server.
export async function db() {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diset');
    sqlClient = neon(process.env.DATABASE_URL);
  }
  if (!ready) {
    ready = initDb(sqlClient).catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  return sqlClient;
}

// Membangun klausa WHERE untuk filter rekap (dipakai list & export).
export function buildFilter({ userId, project, category, from, to }) {
  const where = [];
  const params = [];
  const add = (clause, value) => {
    params.push(value);
    where.push(clause.replace('?', `$${params.length}`));
  };
  if (userId) add('r.user_id = ?', userId);
  if (project) add('r.project ILIKE ?', `%${project}%`);
  if (category === 'operasional' || category === 'material') add('r.category = ?', category);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) add("(r.created_at AT TIME ZONE 'Asia/Jakarta')::date >= ?::date", from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) add("(r.created_at AT TIME ZONE 'Asia/Jakarta')::date <= ?::date", to);
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function filtersFromUrl(url) {
  const sp = new URL(url).searchParams;
  return {
    project: (sp.get('project') || '').trim(),
    category: sp.get('category') || '',
    from: sp.get('from') || '',
    to: sp.get('to') || '',
    user: Number(sp.get('user')) || null,
  };
}
