import bcrypt from 'bcryptjs';

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mekansm.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Novarion1';

// Membuat tabel (jika belum ada) dan memastikan akun admin tersedia.
export async function initDb(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verify_token TEXT,
      verify_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS reimbursements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      project TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('operasional', 'material')),
      item TEXT NOT NULL,
      price BIGINT NOT NULL CHECK (price >= 0),
      photo_data TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS reimbursements_user_idx ON reimbursements (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS reimbursements_created_idx ON reimbursements (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS users_verify_token_idx ON users (verify_token)`;
  // Additive migration: historical price is still the total, with a quantity of 1.
  await sql`ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS unit_price BIGINT`;
  await sql`ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS purchase_date DATE`;
  await sql`CREATE TABLE IF NOT EXISTS ocr_usage (
    scope TEXT PRIMARY KEY,
    minute_start TIMESTAMPTZ NOT NULL,
    minute_count INTEGER NOT NULL,
    day_start DATE NOT NULL,
    day_count INTEGER NOT NULL
  )`;

  const existing = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL}`;
  if (existing.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await sql`
      INSERT INTO users (name, email, password_hash, role, email_verified)
      VALUES ('Admin', ${ADMIN_EMAIL}, ${hash}, 'admin', TRUE)
      ON CONFLICT (email) DO NOTHING`;
  }
}
