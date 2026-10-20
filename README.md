# Rekap Reimburse

Website pencatatan reimburse perusahaan. Dibuat dengan Next.js, Neon Postgres, SMTP Brevo, dan export PDF.

## Fitur

- **Registrasi user** (nama, email, password) dengan **verifikasi email** via SMTP Brevo.
- **Login**. Nama user otomatis tercatat di setiap rekap.
- **Input reimburse** bertahap:
  1. Ketik nama project (ada saran dari project yang pernah diinput)
  2. Pilih kategori **Operasional** atau **Material**
  3. Isi item: nama barang, harga, foto (bisa beberapa item sekaligus, maks. 10)
- Foto dikompres otomatis di browser (maks. 1280 px, JPEG) lalu disimpan di Neon.
- **Riwayat** milik user sendiri.
- **Admin** (`admin@mekansm.com` / `Novarion1`):
  - Melihat semua data, dengan filter orang, project, kategori, dan rentang tanggal
  - **Rekap per orang**: jumlah item, subtotal Operasional/Material, dan total tiap user. Tombol *Lihat* menampilkan detail item orang tersebut, dan *Export PDF* mengekspor rekap satu orang saja.
  - Menghapus satu item atau beberapa item sekaligus melalui checkbox pada **Detail Item**. Checkbox header memilih semua item yang sedang ditampilkan; pilihan direset saat filter berubah. Penghapusan memerlukan konfirmasi dan ikut menghapus foto pada item tersebut.
  - **Export PDF**, hanya untuk admin. Isinya tabel rekap (tanggal, nama, project, kategori, item, harga), subtotal Operasional/Material dan TOTAL, lalu lampiran foto nota/bukti pembayaran di bawah tabel. Filter yang aktif ikut diterapkan.

## Struktur

```
app/
  login, register          halaman autentikasi
  dashboard                input reimburse + riwayat user
  admin                    rekap semua data + export (khusus admin)
  api/auth/*               register, verify, resend, login, logout
  api/reimburse            GET list, POST input; [id] DELETE
  api/photo/[id]           tampilkan foto (pemilik / admin)
  api/export               file .pdf (admin)
lib/                       db (Neon), schema, session (JWT), email (SMTP Brevo)
middleware.js              proteksi /dashboard & /admin
```

Tabel database dibuat **otomatis** saat request pertama. Akun admin juga dibuat otomatis.

## Menjalankan di lokal

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run db:setup             # opsional, inisialisasi tabel + admin
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

1. **Neon**: buat project di https://console.neon.tech, lalu salin *pooled connection string*.
   Atau tambahkan integrasi Neon dari Vercel Marketplace, yang akan mengisi `DATABASE_URL` otomatis.
2. **Brevo**: buka **SMTP & API → SMTP** di https://app.brevo.com.
   Salin **SMTP login** dan buat **SMTP key** (bukan API key atau password akun).
   Tambahkan dan verifikasi alamat pengirim di Brevo sebelum mengirim email.
   SMTP login hanya untuk autentikasi; jangan gunakan sebagai alamat pengirim.
3. Push project ke GitHub, lalu di Vercel pilih **Add New → Project** dan import repo-nya.
4. Di **Settings → Environment Variables**, isi:

   | Nama | Contoh |
   |---|---|
   | `DATABASE_URL` | `postgresql://...-pooler...neon.tech/neondb?sslmode=require` |
   | `SESSION_SECRET` | string acak 64 karakter |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` (STARTTLS) |
   | `SMTP_USER` | SMTP login dari Brevo |
   | `SMTP_PASSWORD` | SMTP key dari Brevo |
   | `SMTP_FROM` | `Rekap Reimburse <alamat-pengirim-terverifikasi>` |
   | `SMTP_REPLY_TO` | `arul.amir20@gmail.com` (opsional) |
   | `APP_URL` | `https://nama-project.vercel.app` |
   | `ADMIN_EMAIL` | `admin@mekansm.com` |
   | `ADMIN_PASSWORD` | `Novarion1` |

5. Deploy, lalu login sebagai admin.

Buat `SESSION_SECRET` dengan:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Catatan

- `ADMIN_PASSWORD` hanya dipakai saat akun admin pertama kali dibuat. Kalau ingin menggantinya nanti, ubah langsung di database.
- Foto disimpan di Neon, sekitar 150–300 KB per foto. Neon free tier (0,5 GB) cukup untuk kira-kira 2.000 foto. Kalau data sudah besar, pertimbangkan pindah ke Vercel Blob.
- Batas body request Vercel adalah 4,5 MB. Karena itu satu pengajuan dibatasi maks. 10 item.
- PDF memuat semua foto sesuai filter. Untuk data yang sangat banyak, gunakan filter project atau tanggal agar file tidak terlalu besar.
