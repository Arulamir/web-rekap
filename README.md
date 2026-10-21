# Rekap Reimburse

Website pencatatan reimburse perusahaan. Dibuat dengan Next.js, Neon Postgres, SMTP Brevo, dan export PDF.

## Fitur

- **Registrasi user** (nama, email, password) dengan **verifikasi email** via SMTP Brevo.
- **Login**. Nama user otomatis tercatat di setiap rekap.
- **Input reimburse** bertahap:
  1. Ketik nama project (ada saran dari project yang pernah diinput)
  2. Pilih kategori **Operasional** atau **Material**
  3. Isi item: nama barang dan harga (maks. 10 item). Pilih foto berbeda untuk tiap item, atau **satu foto nota untuk semua item**, lalu unggah nota sekali.
- Foto dikompres otomatis di browser (maks. 1280 px, JPEG) lalu disimpan di Neon.
- **Baca nota (OCR)** tanpa API key, dijalankan di browser dengan Tesseract.js bahasa Indonesia/Inggris. Pada mode satu foto bersama, unggah nota, putar jika perlu, lalu klik **Baca item & harga (OCR)**. Edit teks atau calon item, pilih hasil yang sesuai, dan tambahkan ke formulir. Tidak ada penyimpanan otomatis atau penimpaan item manual. Maksimal 10 item per pengajuan tetap berlaku.
- **Qty, harga satuan, dan total**: total dihitung ulang di server. Data lama tetap memakai total aslinya dengan Qty 1. Qty baru mendukung hingga 3 angka desimal; Rupiah dibulatkan ke bilangan bulat.
- **Tanggal beli di nota (DD/MM/YY)**: OCR mengisi kolom tanggal yang masih kosong, tetap dapat diedit atau diisi manual. Pada satu foto bersama, tanggal berlaku untuk seluruh item; pada foto per item, isi tanggal masing-masing. Tahun dua digit berarti 2000–2099. Kalender divalidasi di server. Tanggal beli disimpan terpisah dari waktu input, tampil di riwayat/admin/PDF; data lama tanpa tanggal diberi keterangan belum dicatat. Filter rentang tanggal admin tetap berdasarkan tanggal input.
- **Riwayat** milik user sendiri.
- **Admin** (`admin@mekansm.com` / `Novarion1`):
  - Melihat semua data, dengan filter orang, project, kategori, dan rentang tanggal
  - **Rekap per orang**: jumlah item, subtotal Operasional/Material, dan total tiap user. Tombol *Lihat* menampilkan detail item orang tersebut, dan *Export PDF* mengekspor rekap satu orang saja.
  - Menghapus satu item atau beberapa item sekaligus melalui checkbox pada **Detail Item**. Checkbox header memilih semua item yang sedang ditampilkan; pilihan direset saat filter berubah. Penghapusan memerlukan konfirmasi dan ikut menghapus foto pada item tersebut.
  - **Export PDF**, hanya untuk admin. Isinya tabel rekap, subtotal Operasional/Material dan TOTAL, lalu lampiran foto nota/bukti pembayaran. Filter yang aktif ikut diterapkan.
  - Format **FORM REIMBURSEMENT**: No, Uraian, Qty, Harga satuan, Total, Kategori. Nama/project/tanggal tetap dicantumkan pada uraian. Foto nota yang sama untuk beberapa item ditampilkan sekali per pengguna/project, satu foto per halaman, dengan rujukan nomor item.

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

- OCR bukan jaminan ketepatan. Tulisan tangan, tabel bergaris, bayangan, dan foto buram/miring sering tidak terbaca dengan baik. Periksa seluruh draf; baris yang tidak terbaca perlu ditambahkan manual. Nominal yang ambigu tidak ditebak, dan total nota dibandingkan dengan total draf jika terbaca.
- Setelah unggah foto bersama, buka **Atur area & kejernihan OCR**: geser empat batas untuk menghindari meja atau fokus ke tabel item, luruskan sudut kecil, lalu pilih warna asli, kontras dengan normalisasi pencahayaan lokal, atau hitam-putih adaptif. Pilih susunan otomatis/baris/teks tersebar dan lihat **Pratinjau hasil pemrosesan** sebelum membaca. Tidak ada mode yang selalu terbaik untuk tulisan tangan. Crop dilakukan dari sumber resolusi asli sebelum resize (maks. sisi 3000 piksel, pembesaran maks. 2×), lalu PNG tanpa kompresi JPEG tambahan digunakan untuk OCR. Foto bukti yang disimpan tetap memakai alur kompresi semula; crop dan filter OCR tidak memotong foto bukti. Jika tanggal di luar area baca, isi manual. Nominal dengan pemisah ambigu seperti `140-000` perlu dikoreksi pengguna sebelum disusun menjadi draf.
- Worker, WASM, dan model OCR disalin dari dependensi ke `public/ocr/` oleh `predev`/`prebuild`. Vercel cukup memakai `npm run build`; tidak ada environment variable OCR tambahan. Foto diproses di perangkat untuk OCR, lalu baru dikirim ke website ketika pengguna menyimpan reimburse.
- `ADMIN_PASSWORD` hanya dipakai saat akun admin pertama kali dibuat. Kalau ingin menggantinya nanti, ubah langsung di database.
- Foto disimpan di Neon, sekitar 150–300 KB per foto. Neon free tier (0,5 GB) cukup untuk kira-kira 2.000 foto. Kalau data sudah besar, pertimbangkan pindah ke Vercel Blob.
- Batas body request Vercel adalah 4,5 MB. Karena itu satu pengajuan dibatasi maks. 10 item.
- PDF memuat semua foto sesuai filter. Untuk data yang sangat banyak, gunakan filter project atau tanggal agar file tidak terlalu besar.
