# CORE.FTI - Campus Operational Resource Environment

CORE.FTI (Campus Operational Resource Environment) adalah aplikasi web untuk mengelola peminjaman ruangan, inventaris alat, dan aktivitas praktik kerja lapang (PKL) di lingkungan Fakultas Teknologi Informasi Universitas Kristen Satya Wacana.

---

## 📋 Daftar Isi

1. [Fitur](#fitur)
2. [Teknologi](#teknologi)
3. [Struktur Proyek](#struktur-proyek)
4. [Instalasi](#instalasi)
5. [Konfigurasi](#konfigurasi)
6. [Menjalankan Aplikasi](#menjalankan-aplikasi)
7. [Database](#database)
8. [API Endpoints](#api-endpoints)
9. [Struktur Data](#struktur-data)
10. [Fitur Utama](#fitur-utama)
11. [Troubleshooting](#troubleshooting)
12. [Lisensi](#lisensi)

---

## ✨ Fitur

### 🔐 Autentikasi & Otorisasi
- Login dengan Email/Username dan Password
- Three Roles: **Admin**, **Laboran** (Teknisi), dan **User** (Mahasiswa/Dosen)
- Proteksi Route berdasarkan peran user
- Session timeout otomatis (30 menit tidak aktif)
- Mode Maintenance untuk sementara menonaktifkan akses user biasa

### 🏠 Peminjaman Ruangan
- Lihat daftar ruangan laboratorium
- Booking ruangan dengan jadwal multiple dates
- Upload proposal (PDF)
- Minta dukungan teknis (Tech Support)
- Status: Pending → Disetujui/Ditolak
- Export laporan ke Excel

### 📦 Inventaris & Peminjaman Alat
- Kelola data alat inventaris (kode UKSW, kondisi, serial number)
- Peminjaman alat dengan jaminan (KTM/KTP)
- Pengembalian alat
- Status: Dipinjam, Dikembalikan, Terlambat
- Kategori alat

### 👥 Manajemen User & Staff
- **Admin**: Kelola semua user, reset password, aktivasi/non-aktivasi akun
- **Laboran**: Kelola data staff/PIC laboratorium
- Registrasi user baru dengan persetujuan admin

### 📚 PKL Management
- Kelola data siswa PKL/magang
- Assign pembimbing dari staff
- Upload surat pengajuan (PDF max 5MB)
- Status: Aktif, Selesai, Dibatalkan

### 📊 Dashboard & Laporan
- Statistik peminjaman ruangan dan alat
- Statistik PKL aktif
- Recent activities
- Export laporan ke Excel

---

## 🚀 Instalasi

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- npm atau yarn

### 1. Clone Repository
```bash
git clone <repository-url>
cd silab-fti
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database PostgreSQL
Buat database baru di PostgreSQL:
```sql
CREATE DATABASE dbcorefti;
```

Import schema database:
```bash
psql -U your_postgres_user -d dbcorefti -f database_schema.sql
```

### 4. Konfigurasi Environment
Buat file `.env` di root folder:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dbcorefti
DB_USER=corefti
DB_PASSWORD=c0r3ft1

# Optional: Server Port (default: 5000)
PORT=5000
```

**Catatan Default**: Aplikasi sudah dikonfigurasi dengan kredensial default untuk development lokal:
- Database: `dbcorefti`
- User: `corefti`
- Password: `c0r3ft1`

---

## ▶️ Menjalankan Aplikasi (Development)

Aplikasi ini dirancang untuk dijalankan secara bersamaan (frontend dan backend) dengan satu perintah.

```bash
# Menjalankan frontend (Vite) di port 5173 dan backend (Express) di port 5000
npm run dev
```

Buka browser: `http://localhost:5173`

### Mode Production
```bash
# Build frontend
npm run build

# Preview build
npm run preview
```

---

## 🗄️ Database

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Data semua user (Admin, Laboran, User) |
| `staff` | Data staff/laboran (PIC ruangan) |
| `rooms` | Data ruangan laboratorium |
| `bookings` | Transaksi peminjaman ruangan |
| `booking_schedules` | Detail jadwal booking |
| `inventory` | Data alat inventaris |
| `transactions` | Header transaksi peminjaman alat |
| `loans` | Detail peminjaman alat |
| `notifications` | Riwayat notifikasi |
| `system_settings` | Konfigurasi global (maintenance mode, dll) |
| `room_computers` | Spesifikasi komputer per ruangan |
| `pkl_students` | Data siswa PKL/magang |

### Initial User (Default)
Setelah import schema, buat admin pertama:

```sql
-- Insert Admin User (Password: admin123)
INSERT INTO users (id, nama, email, username, password, role, identifier, status)
VALUES ('ADMIN-001', 'Administrator', 'admin@fti.uksw.ac.id', 'admin', '$2a$10$...hash...', 'Admin', 'ADMIN001', 'Aktif');
```

Untuk generate password hash, bisa gunakan script:
```bash
node scripts/generate-hash.js
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/login` | Login user |
| POST | `/api/register` | Registrasi user baru |
| POST | `/api/set-password` | Set password baru (setelah reset) |

### Users
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/:id` | Get single user |
| POST | `/api/users` | Create user (Admin) |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| PUT | `/api/users/:id/status` | Update status user |
| PUT | `/api/users/:id/reset-password` | Reset password user |

### Rooms
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/rooms` | Get all rooms |
| POST | `/api/rooms` | Create room |
| PUT | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Delete room |
| GET | `/api/rooms/:id/computers` | Get room computers |
| GET | `/api/rooms/:id/specs-summary` | Get dominant specs |

### Bookings
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/bookings` | Get all bookings |
| POST | `/api/bookings` | Create booking |
| PUT | `/api/bookings/:id/status` | Update status booking |
| GET | `/api/bookings/export` | Export to Excel |

### Inventory
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/inventory` | Get all inventory |
| POST | `/api/inventory` | Add inventory |
| PUT | `/api/inventory/:id` | Update inventory |
| DELETE | `/api/inventory/:id` | Delete inventory |

### Loans
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/loans` | Get all loans |
| POST | `/api/loans` | Create loan |
| PUT | `/api/loans/return` | Return items |
| DELETE | `/api/loans/group` | Delete loan group |

### PKL
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/pkl` | Get all PKL students |
| POST | `/api/pkl` | Add PKL student(s) |
| PUT | `/api/pkl/:id` | Update PKL student |
| DELETE | `/api/pkl/:id` | Delete PKL student |

### Staff
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/staff` | Get all staff |
| POST | `/api/staff` | Add staff |
| PUT | `/api/staff/:id` | Update staff |
| DELETE | `/api/staff/:id` | Delete staff |

### Settings
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/settings/maintenance` | Get maintenance status |
| POST | `/api/settings/maintenance` | Toggle maintenance mode |
| GET | `/api/settings/announcement` | Get announcement |
| POST | `/api/settings/announcement` | Set announcement |
| GET | `/api/settings/backup` | Download database backup |
| POST | `/api/settings/restore` | Restore database |

---

## 📊 Struktur Data (Types)

### User Roles
```typescript
enum Role {
  ADMIN = 'Admin',
  LABORAN = 'Laboran',
  USER = 'User'
}
```

### Booking Status
```typescript
enum BookingStatus {
  PENDING = 'Pending',
  APPROVED = 'Disetujui',
  REJECTED = 'Ditolak'
}
```

### Interfaces
- `Room` - Data ruangan
- `Booking` - Transaksi peminjaman ruangan
- `Equipment` / `Inventory` - Data alat
- `Loan` - Transaksi peminjaman alat
- `LabStaff` - Data staff/laboran
- `AppUser` - Data user aplikasi
- `PKLStudent` - Data siswa PKL

Lihat `types.ts` untuk detail lengkap.

---

## 🎯 Fitur Utama

### 1. Auto Approval
- User dengan role Admin/Laboran yang booking ruangan akan otomatis disetujui
- User biasa harus menunggu persetujuan

### 2. Tech Support
- Booking bisa meminta dukungan teknis
- Admin/Laboran bisa assign staff sebagai PIC teknis

### 3. File Upload
- Proposal booking: PDF max 5MB
- Foto ruangan: JPEG/PNG
- Surat PKL: PDF max 5MB
- Avatar user: JPEG/PNG

### 4. QR Code
- Generate QR Code untuk tracking peminjaman
- Scan QR untuk fitur tertentu

### 5. Export Laporan
- Export bookings ke Excel (.xlsx)
- Backup database ke SQL (.sql)

---

## ⚠️ Troubleshooting

### Error: "Database connection failed"
- Pastikan PostgreSQL running
- Cek kredensial di `.env`
- Pastikan database `dbcorefti` sudah dibuat

### Error: "Port 5000 already in use"
- Ubah port di `server.js` atau `.env`
- Kill proses yang menggunakan port tersebut

### Error: "Module not found"
- Jalankan `npm install` ulang
- Pastikan menggunakan Node.js versi 18+

### Error: "CORS policy"
- Pastikan backend dan frontend running di port yang benar
- Cek konfigurasi CORS di `server.js`

### Error: "Password hash comparison failed"
- Cek password user di database
- Gunakan script generate-hash untuk membuat hash baru

---

## 📝 Catatan Pengembangan

### Dark Mode
- Aplikasi mendukung dark mode yang mengikuti sistem OS
- Toggle manual tersedia di TopBar
- Preferensi disimpan di localStorage

### Session Management
- Session timeout 30 menit tidak aktif
- Auto logout untuk keamanan

### Maintenance Mode
- Admin bisa mengaktifkan maintenance mode
- User biasa tidak bisa login saat maintenance aktif
- Admin dan Laboran tetap bisa akses

---

## 📄 Lisensi

Copyright © {new Date().getFullYear()} FTI UKSW. All rights reserved.

---

## 👤 Kontak

Untuk pertanyaan atau masalah, hubungi:
- Admin Laboratorium: Ruang 227 atau 456
- Email: laboran@fti.uksw.ac.id

---

<div align="center">
Made with ❤️ by FTI UKSW
</div>
