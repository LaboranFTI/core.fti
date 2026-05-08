-- ==========================================
-- SKEMA DATABASE CORE.FTI (PostgreSQL)
-- ==========================================

-- Fungsi Trigger untuk update kolom 'updated_at' secara otomatis
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Definisi Tipe Data ENUM untuk Status
CREATE TYPE user_status_enum AS ENUM ('Aktif', 'Non-Aktif', 'Reset');
CREATE TYPE booking_status_enum AS ENUM ('Pending', 'Disetujui', 'Ditolak', 'Dibatalkan');
CREATE TYPE loan_status_enum AS ENUM ('Dipinjam', 'Dikembalikan', 'Terlambat');
CREATE TYPE pkl_status_enum AS ENUM ('Aktif', 'Selesai', 'Dibatalkan');

-- Catatan: Jika tabel sudah ada dan berisi data, Anda mungkin perlu menjalankan:
-- ALTER TABLE users ALTER COLUMN status TYPE user_status_enum USING status::user_status_enum;
-- ALTER TABLE staff ALTER COLUMN status TYPE user_status_enum USING status::user_status_enum;
-- ALTER TABLE bookings ALTER COLUMN status TYPE booking_status_enum USING status::booking_status_enum;
-- ALTER TABLE loans ALTER COLUMN status TYPE loan_status_enum USING status::loan_status_enum;
-- ALTER TABLE pkl_students ALTER COLUMN status TYPE pkl_status_enum USING status::pkl_status_enum;

-- Tabel Users
-- Menyimpan data semua pengguna (Mahasiswa, Dosen, Admin, Teknisi)
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    identifier VARCHAR(50),
    telepon VARCHAR(20),
    avatar_image BYTEA,
    status user_status_enum DEFAULT 'Aktif',
    last_login TIMESTAMP,
    password_changed_at TIMESTAMP,
    password_reset_token_hash VARCHAR(255),
    password_reset_expires_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contoh penerapan trigger pada tabel users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO users (id, nama, email, username, password, role, identifier, telepon, status)
VALUES 
('ADMIN-001', 'Administrator', 'admin.noc@core.fti', 'admin', '$2a$12$JOgQfS7L8RV4QOMnLpPQdeWeJgFaquVRouBIXml.EM0Lu54InxRAG', 'Admin', 'ADMIN001', '00000000000', 'Aktif');


-- Tabel Staff
-- Menyimpan data staff/laboran yang bisa menjadi PIC ruangan
CREATE TABLE staff (
    id VARCHAR(50) PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    identifier VARCHAR(50),
    email VARCHAR(100),
    telepon VARCHAR(20),
    jabatan VARCHAR(50),
    user_id VARCHAR(50),
    status user_status_enum DEFAULT 'Aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Rooms
-- Menyimpan data ruangan laboratorium
CREATE TABLE rooms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    deskripsi TEXT,
    kapasitas INT NOT NULL,
    pic_id VARCHAR(50),
    image_data BYTEA,
    fasilitas TEXT[],
    google_calendar_url TEXT,
    lantai VARCHAR(50) DEFAULT 'FTI Lt. 4',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_room_staff FOREIGN KEY (pic_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Bookings
-- Transaksi peminjaman ruangan
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    penanggung_jawab VARCHAR(100) NOT NULL,
    contact_person VARCHAR(50) NOT NULL,
    keperluan TEXT NOT NULL,
    status booking_status_enum DEFAULT 'Pending',
    file_proposal BYTEA,
    tech_support_pic TEXT[],
    tech_support_needs TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Booking Schedules (Detail Jadwal)
CREATE TABLE booking_schedules (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT fk_schedule_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Tabel Equipment
-- Data barang inventaris
CREATE TABLE inventory (
    id VARCHAR(50) PRIMARY KEY,
    uksw_code VARCHAR(50),
    nama VARCHAR(100) NOT NULL,
    kategori VARCHAR(50),
    kondisi VARCHAR(20) DEFAULT 'Baik', -- Bisa juga jadi ENUM jika nilainya tetap
    is_available BOOLEAN DEFAULT TRUE,
    serial_number VARCHAR(100),
    lokasi VARCHAR(100), -- Lokasi/Rak/Ruangan barang saat ini
    vendor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Transactions
-- Header peminjaman (Satu transaksi bisa memuat banyak barang)
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    peminjam_identifier VARCHAR(50) NOT NULL,
    nama_peminjam VARCHAR(100) NOT NULL,
    petugas_pinjam VARCHAR(100),
    jaminan VARCHAR(50),
    tgl_pinjam DATE NOT NULL,
    waktu_pinjam TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Loans (Detail Barang)
-- Detail barang dalam satu transaksi
CREATE TABLE loans (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL,
    inventory_id VARCHAR(50) NOT NULL,
    actual_return_date DATE,
    actual_return_time TIME,
    status loan_status_enum DEFAULT 'Dipinjam',
    petugas_pengembalian VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loan_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_loan_inventory FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT
);

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Item Movements (Tracking Perpindahan Barang)
-- Mencatat perpindahan barang (baik dari peminjaman maupun input manual)
CREATE TABLE item_movements (
    id VARCHAR(50) PRIMARY KEY,
    inventory_id VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    movement_type VARCHAR(20) NOT NULL, -- 'Peminjaman' atau 'Manual'
    from_person VARCHAR(100), -- Siapa yang menyerahkan
    to_person VARCHAR(100), -- Siapa yang menerima
    moved_by VARCHAR(100), -- Staff yang memproses
    quantity INT DEFAULT 1,
    from_location VARCHAR(100), -- Lokasi SEBELUM perpindahan
    to_location VARCHAR(100), -- Lokasi SESUDAH perpindahan
    notes TEXT,
    loan_id VARCHAR(50), -- Reference ke loans (nullable untuk manual)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movement_inventory FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- Indexing untuk Item Movements
CREATE INDEX idx_movements_inventory ON item_movements(inventory_id);
CREATE INDEX idx_movements_date ON item_movements(movement_date);
CREATE INDEX idx_movements_type ON item_movements(movement_type);

-- Tabel Notifications
-- Menyimpan riwayat notifikasi untuk dashboard
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexing untuk performa pencarian
CREATE INDEX idx_booking_schedules_date ON booking_schedules(schedule_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_inventory_uksw_code ON inventory(uksw_code);
CREATE INDEX idx_inventory_category ON inventory(kategori);
CREATE INDEX idx_inventory_available ON inventory(is_available);
CREATE INDEX idx_inventory_location ON inventory(lokasi);
CREATE INDEX idx_rooms_name ON rooms(name);
-- Indexing untuk Foreign Keys (Mempercepat JOIN)
CREATE INDEX idx_bookings_room_id ON bookings(room_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_loans_inventory_id ON loans(inventory_id);
CREATE INDEX idx_loans_transaction_id ON loans(transaction_id);
CREATE INDEX idx_rooms_pic_id ON rooms(pic_id);
CREATE INDEX idx_transactions_peminjam ON transactions(peminjam_identifier);
CREATE INDEX idx_transactions_tgl ON transactions(tgl_pinjam);

-- Tabel System Settings
-- Menyimpan konfigurasi global aplikasi
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default value (Maintenance Mode: OFF)
INSERT INTO system_settings (key, value) VALUES ('maintenance_mode', 'false');
INSERT INTO system_settings (key, value) VALUES ('global_announcement', '{"active": false, "message": "", "type": "info"}');

-- Tabel Room Computers (Spesifikasi Komputer per Ruangan)
CREATE TABLE room_computers (
    id VARCHAR(50) PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL,
    pc_number VARCHAR(50),
    cpu VARCHAR(100),
    gpu_type VARCHAR(50),
    gpu_model VARCHAR(100),
    vram VARCHAR(50),
    ram VARCHAR(50),
    storage VARCHAR(100),
    os VARCHAR(100),
    keyboard VARCHAR(100),
    mouse VARCHAR(100),
    monitor VARCHAR(100),
    condition VARCHAR(50) DEFAULT 'Baik',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_computer_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Tabel PKL Students (Orang Magang/PKL)
CREATE TABLE pkl_students (
    id VARCHAR(50) PRIMARY KEY,
    nama_siswa VARCHAR(100) NOT NULL,
    sekolah VARCHAR(100) NOT NULL,
    Jurusan VARCHAR(100),
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    status pkl_status_enum DEFAULT 'Aktif',
    surat_pengajuan BYTEA,
    pembimbing_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pkl_staff FOREIGN KEY (pembimbing_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE TRIGGER update_pkl_students_updated_at BEFORE UPDATE ON pkl_students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexing untuk PKL
CREATE INDEX idx_pkl_sekolah ON pkl_students(sekolah);
CREATE INDEX idx_pkl_status ON pkl_students(status);
CREATE INDEX idx_pkl_pembimbing ON pkl_students(pembimbing_id);

-- Tabel Class Schedules (Jadwal Kuliah)
-- Menyimpan jadwal kelas per semester
CREATE TABLE class_schedules (
    id VARCHAR(50) PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,       -- Kode Matakuliah (misal: TI401)
    course_name VARCHAR(100) NOT NULL,      -- Nama Matakuliah (misal: Jaringan Komputer)
    class_group VARCHAR(10) NOT NULL,       -- Kelompok Kelas (misal: A, B, C)
    day_of_week VARCHAR(10) NOT NULL,      -- Hari (Senin, Selasa, etc.)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    semester VARCHAR(20) NOT NULL,          -- Semester (misal: Ganjil 2024/2025)
    academic_year VARCHAR(20) NOT NULL,     -- Tahun Akademik (2024/2025)
    room_id VARCHAR(50),
    lecturer_name VARCHAR(100),             -- Nama Dosen Pengampu
    start_date DATE,                        -- Tanggal Mulai Periode Semester
    end_date DATE,                          -- Tanggal Selesai Periode Semester
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_class_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TRIGGER update_class_schedules_updated_at BEFORE UPDATE ON class_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexing untuk Class Schedules
CREATE INDEX idx_class_schedules_room ON class_schedules(room_id);
CREATE INDEX idx_class_schedules_semester ON class_schedules(semester);
CREATE INDEX idx_class_schedules_academic ON class_schedules(academic_year);
CREATE INDEX idx_class_schedules_day ON class_schedules(day_of_week);

-- Tabel Software (Software yang terinstall di Laboratorium)
CREATE TABLE software (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    license_type VARCHAR(50) DEFAULT 'Free',
    license_key TEXT,
    vendor VARCHAR(100),
    install_date DATE,
    room_id VARCHAR(50),
    category VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_software_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TRIGGER update_software_updated_at BEFORE UPDATE ON software FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexing untuk Software
CREATE INDEX idx_software_room ON software(room_id);
CREATE INDEX idx_software_category ON software(category);
CREATE INDEX idx_software_name ON software(name);

-- Tabel Error Logs (Log Error Aplikasi)
CREATE TABLE error_logs (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(50) NOT NULL, -- 'API', 'NETWORK', 'VALIDATION', 'RUNTIME', 'DATABASE', 'AUTH', 'UNKNOWN'
    error_message TEXT NOT NULL,
    error_stack TEXT, -- Stack trace untuk debugging
    endpoint VARCHAR(255), -- Endpoint API yang gagal (jika ada)
    method VARCHAR(10), -- HTTP Method (GET, POST, etc)
    user_id VARCHAR(50), -- User yang melakukan request (jika ada)
    user_email VARCHAR(100), -- Email user untuk tracking
    browser_info VARCHAR(255), -- Browser/User-Agent
    ip_address VARCHAR(45),
    severity VARCHAR(20) DEFAULT 'ERROR', -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(50),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk Error Logs
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(is_resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);

-- ==========================================
-- MULTI-DEVICE AUTHENTICATION TABLES
-- ==========================================

-- Table to store user sessions/tokens (Extended for multi-device support)
CREATE TABLE user_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_id VARCHAR(100) NOT NULL DEFAULT gen_random_uuid(), -- Unique device identifier (can be custom string from frontend)
  device_name VARCHAR(100), -- Friendly device name (e.g., "Laptop Kantor", "HP Android")
  device_type VARCHAR(50), -- Device type: 'desktop', 'mobile', 'tablet'
  user_agent TEXT,
  ip_address VARCHAR(45),
  is_remember_me BOOLEAN DEFAULT FALSE, -- TRUE if "Remember Me" was checked
  refresh_token TEXT, -- For "Remember Me" auto-login functionality
  refresh_token_expires_at TIMESTAMPTZ, -- Expiry for refresh token (longer than access token)
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE -- For revoking specific sessions
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at ON user_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tokens_device_id ON user_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_refresh_token ON user_tokens(refresh_token);

-- Tabel Google SSO Config
-- Menyimpan konfigurasi Google OAuth/SSO
CREATE TABLE sso_config (
    id SERIAL PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    client_id VARCHAR(255),
    domain VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default SSO config
INSERT INTO sso_config (enabled, client_id, domain) 
VALUES (TRUE, '828476305239-7hilvfjvadt8ndn9br7n1upmdso38ou8.apps.googleusercontent.com', 'uksw.edu,student.uksw.edu,students.uksw.edu');

-- Tabel SSO Users (Pengguna Google SSO yang Diizinkan)
-- Menyimpan data pengguna yang dapat login menggunakan Google Workspace
CREATE TABLE sso_users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    status user_status_enum DEFAULT 'Aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_sso_users_updated_at BEFORE UPDATE ON sso_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexing untuk SSO Users
CREATE INDEX IF NOT EXISTS idx_sso_users_email ON sso_users(email);
CREATE INDEX IF NOT EXISTS idx_sso_users_status ON sso_users(status);

-- ==========================================
-- LAYANAN TATA USAHA (TU)
-- ==========================================

-- Tabel Active Student Requests (Surat Keterangan Aktif Kuliah)
CREATE TABLE active_student_requests (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nim VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    birth_place VARCHAR(100),
    birth_date VARCHAR(30),
    study_program_level VARCHAR(100),
    study_program_name VARCHAR(255),
    faculty VARCHAR(255),
    university VARCHAR(255),
    transcript_base64 TEXT,
    transcript_name VARCHAR(255),
    signature_base64 TEXT,
    stamp_base64 TEXT,
    letter_number VARCHAR(100),
    letter_sequence INTEGER,
    letter_generated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_active_student_requests_updated_at BEFORE UPDATE ON active_student_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Observation Requests (Surat Pengantar Observasi)
CREATE TABLE observation_requests (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nim VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    recipient_name VARCHAR(255), -- Nama penerima atau jabatan tujuan surat
    company_address TEXT, -- Alamat instansi/perusahaan tujuan
    purpose TEXT, -- Tujuan spesifik observasi
    company VARCHAR(255), -- Nama instansi/perusahaan tujuan
    course_name VARCHAR(255),
    lecturer_name VARCHAR(255),
    head_of_program_name VARCHAR(255),
    student_members JSONB NOT NULL DEFAULT '[]'::jsonb, -- Anggota kelompok observasi
    signature_base64 TEXT,
    stamp_base64 TEXT,
    letter_number VARCHAR(100),
    letter_sequence INTEGER,
    letter_generated_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_observation_requests_updated_at BEFORE UPDATE ON observation_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabel Background Surat TU (1 PNG A4 per jenis surat)
CREATE TABLE tu_letter_backgrounds (
    id SERIAL PRIMARY KEY,
    letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
    file_name VARCHAR(255),
    mime_type VARCHAR(100) DEFAULT 'image/png',
    image_base64 TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(letter_type)
);

CREATE TRIGGER update_tu_letter_backgrounds_updated_at BEFORE UPDATE ON tu_letter_backgrounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Counter nomor surat TU per jenis surat per bulan
CREATE TABLE tu_letter_number_counters (
    id SERIAL PRIMARY KEY,
    letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    last_sequence INTEGER NOT NULL DEFAULT 0,
    last_letter_number VARCHAR(100),
    last_generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(letter_type, year, month)
);

CREATE TRIGGER update_tu_letter_number_counters_updated_at BEFORE UPDATE ON tu_letter_number_counters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE tu_letter_layouts (
    id SERIAL PRIMARY KEY,
    letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
    margin_top_mm NUMERIC(6,2) NOT NULL DEFAULT 40,
    margin_right_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
    margin_bottom_mm NUMERIC(6,2) NOT NULL DEFAULT 26,
    margin_left_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(letter_type)
);

CREATE TRIGGER update_tu_letter_layouts_updated_at BEFORE UPDATE ON tu_letter_layouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_student_requests_letter_number_unique
ON active_student_requests(letter_number)
WHERE letter_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_letter_number_unique
ON observation_requests(letter_number)
WHERE letter_number IS NOT NULL;

-- Pengaturan default untuk Layanan TU
INSERT INTO system_settings (key, value) VALUES ('tu_dean_signature_base64', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('tu_faculty_stamp_base64', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_settings (key, value) VALUES ('tu_current_semester_code', '') ON CONFLICT (key) DO NOTHING;
