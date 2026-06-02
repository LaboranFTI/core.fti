# CORE.FTI

CORE.FTI (Campus Operational Resource Environment) adalah aplikasi web operasional Fakultas Teknologi Informasi UKSW untuk pengelolaan ruangan, inventaris, peminjaman alat, layanan tata usaha, pengguna, jadwal, dan pelaporan internal.

Dokumen ini hanya berisi informasi teknis. Kredensial, token, password, app password, client secret, dan akun awal tidak boleh disimpan di README atau repository.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, lucide-react
- Backend: Node.js, Express, PostgreSQL
- Auth: JWT, bcrypt
- File/PDF/Export: multer, puppeteer, exceljs, jspdf, html-to-image
- Email: nodemailer
- Integrasi: Google SSO, Google Calendar, SIASAT routes

## Struktur Proyek

| Path | Fungsi |
| --- | --- |
| `App.tsx` | Routing utama frontend dan layout aplikasi |
| `components/` | Komponen UI dan komponen fitur umum |
| `pages/` | Halaman utama aplikasi |
| `pages_tu/` | Modul layanan tata usaha |
| `hooks/` | React hooks untuk data dan state |
| `services/api.ts` | Wrapper API frontend |
| `backend/routes/` | Route Express per domain fitur |
| `backend/middleware/` | Middleware backend, termasuk auth dan RBAC |
| `backend/config/` | Konfigurasi database dan CORS |
| `backend/utils/` | Helper backend, mailer, logger, generator surat |
| `backend/lettersTU/` | Template surat TU |
| `scripts/` | Script utilitas dan migrasi tambahan |
| `database_schema.sql` | Schema awal database |
| `dist/` | Output build frontend, tidak untuk diedit manual |

## Prasyarat

- Node.js 18 atau lebih baru
- npm
- PostgreSQL 14 atau lebih baru
- Akses SMTP bila fitur email digunakan
- Google Cloud OAuth/API configuration bila SSO atau Calendar digunakan

## Instalasi Lokal

```bash
npm install
```

Buat database PostgreSQL sesuai environment target, lalu import schema:

```bash
psql -U <db_user> -d <db_name> -f database_schema.sql
```

Jika ada migrasi tambahan di `scripts/`, jalankan sesuai urutan rilis yang berlaku untuk environment tersebut.

## Konfigurasi Environment

Buat file `.env` di root project berdasarkan `.env.example`, lalu isi nilainya dari secret manager atau konfigurasi environment yang aman. Jangan commit file `.env`.

Variable utama:

| Variable | Keterangan |
| --- | --- |
| `DB_USER` | User database PostgreSQL |
| `DB_PASSWORD` | Password database PostgreSQL |
| `DB_HOST` | Host database |
| `DB_NAME` | Nama database |
| `DB_PORT` | Port database |
| `DB_SSL` | Mode SSL database |
| `JWT_SECRET` | Secret untuk signing JWT |
| `PORT` | Port backend Express |
| `VITE_API_BASE_URL` | Base URL API untuk frontend |
| `VITE_INSTITUTION_URL` | URL institusi |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID yang memang aman untuk client |
| `VITE_GOOGLE_API_KEY` | Google API key public yang sudah dibatasi referrer |
| `EMAIL_USER` | Akun pengirim email |
| `EMAIL_PASS` | Secret SMTP/app password dari secret manager |
| `EMAIL_FROM_NAME` | Nama pengirim email |
| `EMAIL_HOST` | Host SMTP |
| `EMAIL_PORT` | Port SMTP |
| `EMAIL_TLS` | Mode TLS SMTP |

Catatan keamanan:

- Nilai secret tidak boleh ditulis di README, commit, screenshot, issue, atau log publik.
- Secret production harus dibuat unik per environment.
- Key yang dipakai browser wajib dibatasi dengan HTTP referrer restriction.
- Secret server-side tidak boleh diekspos melalui Vite bundle.

## Menjalankan Development

Backend:

```bash
npm run server
```

Frontend:

```bash
npm run dev
```

Default development Vite berjalan di port `5173`, sedangkan backend mengikuti `PORT` atau konfigurasi runtime backend.

## Build Production

```bash
npm run build
```

Preview build frontend:

```bash
npm run preview
```

Untuk production backend, jalankan `server.js` melalui process manager yang sesuai dengan environment deployment, misalnya systemd, PM2, Docker, atau platform runtime lain. Pastikan `NODE_ENV=production` dan semua environment variable production sudah tersedia.

## Database

Tabel utama:

| Tabel | Deskripsi |
| --- | --- |
| `users` | Data pengguna aplikasi |
| `user_tokens` | Sesi dan refresh token pengguna |
| `staff` | Data staff/laboran |
| `rooms` | Data ruangan |
| `room_computers` | Spesifikasi komputer per ruangan |
| `bookings` | Header pemesanan ruangan |
| `booking_schedules` | Jadwal pemesanan ruangan |
| `inventory` | Data inventaris |
| `transactions` | Header transaksi peminjaman alat |
| `loans` | Detail peminjaman alat |
| `item_movements` | Riwayat perpindahan inventaris |
| `notifications` | Notifikasi aplikasi |
| `system_settings` | Pengaturan global aplikasi |
| `pkl_students` | Data PKL/magang |
| `active_student_requests` | Pengajuan surat aktif kuliah |
| `observation_requests` | Pengajuan surat observasi |
| `tu_letter_number_counters` | Counter nomor surat TU |

Akun awal untuk production harus dibuat melalui prosedur bootstrap internal yang aman. Jangan menanam akun default atau kredensial statis di schema, dokumentasi, atau source code.

## Command Yang Tersedia

| Command | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan frontend Vite |
| `npm run server` | Menjalankan backend Express dalam mode watch |
| `npm run build` | Type check dan build frontend production |
| `npm run preview` | Preview hasil build frontend |
| `npm run lint` | Menjalankan ESLint bila konfigurasi lint tersedia |

## API Surface

Semua endpoint backend berada di bawah prefix `/api`, kecuali root health text endpoint.

Domain route utama:

| Domain | Contoh Endpoint | Fungsi |
| --- | --- | --- |
| Auth | `/api/login`, `/api/auth/refresh`, `/api/auth/verify` | Login, refresh session, verifikasi auth |
| Users | `/api/users` | Manajemen user |
| Rooms | `/api/rooms` | Manajemen ruangan |
| Bookings | `/api/bookings` | Pemesanan ruangan |
| Inventory | `/api/inventory`, `/api/item-movements` | Inventaris dan perpindahan barang |
| Loans | `/api/loans` | Peminjaman alat |
| Staff/PKL | `/api/staff`, `/api/pkl` | Data staff dan PKL |
| Settings | `/api/settings/*` | Maintenance, announcement, SSO config, backup/restore |
| TU | `/api/active-student`, `/api/observation-requests`, `/api/tu/*` | Layanan tata usaha |
| SIASAT | `/api/siasat/*` | Integrasi data SIASAT |
| Lecturer/Study Program | `/api/lecturers`, `/api/study-programs` | Data dosen dan program studi |

Detail payload dan authorization policy mengikuti implementasi route masing-masing.

## Checklist Deployment

Sebelum deploy:

1. Pastikan semua secret disediakan melalui secret manager atau environment runtime.
2. Pastikan `.env`, credential JSON, dump database, dan file privat lain tidak ikut artifact deployment.
3. Jalankan build dan test gate yang berlaku untuk environment tersebut.
4. Jalankan migrasi database secara eksplisit dan terkontrol.
5. Pastikan CORS hanya mengizinkan domain resmi.
6. Pastikan TLS aktif untuk trafik publik dan koneksi database production.
7. Pastikan process manager memiliki restart policy dan log retention.
8. Pastikan backup database berjalan dari pipeline operasional yang aman.
9. Pastikan akun awal dan role production dibuat melalui prosedur bootstrap internal.

## Troubleshooting

Database tidak tersambung:

- Pastikan PostgreSQL berjalan dan dapat diakses dari host aplikasi.
- Pastikan environment variable database sudah benar.
- Pastikan firewall, SSL mode, dan network policy sesuai target deployment.

Frontend tidak bisa memanggil API:

- Pastikan `VITE_API_BASE_URL` sesuai domain backend.
- Pastikan backend berjalan.
- Pastikan CORS mengizinkan origin frontend yang benar.

Email gagal terkirim:

- Pastikan konfigurasi SMTP tersedia di environment runtime.
- Pastikan akun pengirim mengizinkan metode autentikasi yang digunakan.
- Cek log backend untuk status koneksi mailer.

Build gagal:

- Jalankan `npm install` ulang.
- Pastikan versi Node.js sesuai prasyarat.
- Hapus cache build lokal bila diperlukan, lalu ulangi `npm run build`.

## Catatan Operasional

- Jangan menulis secret di log aplikasi.
- Jangan mengirim credential melalui chat, issue tracker, atau dokumentasi publik.
- Gunakan akun dan role sesuai prinsip least privilege.
- Review ulang route authorization sebelum membuka aplikasi ke jaringan publik.
- Simpan backup dan artifact deployment di lokasi yang memiliki access control.

## Lisensi

Copyright FTI UKSW. All rights reserved.
