// Inisialisasi tabel & akun admin secara manual: npm run db:setup
// (Opsional — aplikasi juga melakukannya otomatis saat request pertama.)
import { neon } from '@neondatabase/serverless';
import { initDb, ADMIN_EMAIL } from '../lib/schema.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diset di .env.local');
  process.exit(1);
}

await initDb(neon(process.env.DATABASE_URL));
console.log(`Database siap. Akun admin: ${ADMIN_EMAIL}`);
