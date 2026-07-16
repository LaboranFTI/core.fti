import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Force TIMESTAMP (oid 1114) to be parsed as UTC instead of local system timezone
pg.types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

// Validation function to check required environment variables
const validateDbConfig = () => {
  const requiredVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`❌ Error: Variabel lingkungan database berikut belum diset: ${missing.join(', ')}`);
    console.error('💡 Silakan pastikan file .env sudah dikonfigurasi dengan benar.');
    process.exit(1);
  }
};

// Validasi konfigurasi database saat startup
validateDbConfig();

// Buat konfigurasi pool dengan keamanan tambahan
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10),
  // SSL configuration - wajib untuk production/hosting tertentu
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Connection pool settings untuk keamanan dan performa
  max: 20, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000, // how long to wait when connecting
};

// Logging konfigurasi database (dengan password tersembunyi)
console.log('🔄 Menghubungkan ke database...');
console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   SSL: ${process.env.DB_SSL === 'true' ? 'Enabled' : 'Disabled'}`);

const pool = new Pool(dbConfig);

// --- AUTO-RETRY MECHANISM & ERROR HANDLING ---

// 1. Tangani error pada idle client agar aplikasi tidak crash
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle database client:', err.message);
  // pg pool akan secara otomatis membuang client yang bermasalah dan membuat yang baru
});

// Helper untuk mendeteksi apakah error disebabkan oleh masalah koneksi/jaringan
const isConnectionError = (err) => {
  if (!err) return false;
  return err.code === 'ECONNRESET' || 
         err.code === 'ETIMEDOUT' ||
         err.code === 'EHOSTUNREACH' ||
         err.code === 'ENOTFOUND' ||
         err.code === '08006' || // connection_failure
         err.code === '08003' || // connection_does_not_exist
         err.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
         err.code === '57P01' || // admin_shutdown
         (err.message && err.message.includes('Connection terminated')) ||
         (err.message && err.message.includes('timeout exceeded'));
};

// 2. Intercept pool.query untuk menambahkan fitur auto-retry
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  // Jika dipanggil dengan callback (internal pg library), lewati auto-retry agar tidak merusak aliran asli
  const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
  if (cb) return originalQuery(...args);

  const maxRetries = 3;
  let retries = 0;
  while (true) {
    try {
      return await originalQuery(...args);
    } catch (err) {
      if (isConnectionError(err) && retries < maxRetries) {
        retries++;
        const backoffTime = retries * 1000; // Tunggu 1s, lalu 2s, lalu 3s
        console.warn(`⚠️ [DB] Koneksi terputus (${err.code || err.message}). Mencoba ulang query (${retries}/${maxRetries}) dalam ${backoffTime}ms...`);
        await new Promise(res => setTimeout(res, backoffTime));
      } else {
        throw err; // Lempar error jika sudah melebihi batas retry atau bukan error koneksi
      }
    }
  }
};

// 3. Intercept pool.connect (untuk transaksi DB seperti BEGIN/COMMIT)
const originalConnect = pool.connect.bind(pool);
pool.connect = async (...args) => {
  // Sama seperti query, jika ada callback, langsung lewatkan ke fungsi aslinya
  const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
  if (cb) return originalConnect(...args);

  const maxRetries = 3;
  let retries = 0;
  while (true) {
    try {
      return await originalConnect(...args);
    } catch (err) {
      if (isConnectionError(err) && retries < maxRetries) {
        retries++;
        const backoffTime = retries * 1000;
        console.warn(`⚠️ [DB] Gagal mendapat koneksi (${err.code || err.message}). Mencoba ulang connect (${retries}/${maxRetries}) dalam ${backoffTime}ms...`);
        await new Promise(res => setTimeout(res, backoffTime));
      } else {
        throw err;
      }
    }
  }
};

// Test koneksi database saat startup (called by server.js)
export const testConnection = () => {
  return pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ Berhasil terhubung ke database PostgreSQL');
    })
    .catch((err) => {
      console.error('❌ Gagal terhubung ke database:', err.message);
      process.exit(1);
    });
};

export const ensureAuthSchema = async () => {
  const schemaQueries = [
    "ALTER TYPE user_status_enum ADD VALUE IF NOT EXISTS 'Reset'",
    'ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_granted_scopes TEXT',
    'ALTER TABLE staff ADD COLUMN IF NOT EXISTS keterangan TEXT',
    `CREATE TABLE IF NOT EXISTS staff_position_periods (
      id VARCHAR(50) PRIMARY KEY,
      staff_id VARCHAR(50) NOT NULL,
      period_number INT NOT NULL,
      jabatan VARCHAR(50),
      start_date DATE NOT NULL,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_staff_position_period_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
      CONSTRAINT uq_staff_position_period_number UNIQUE (staff_id, period_number)
    )`,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_position_periods_updated_at') THEN
         CREATE TRIGGER update_staff_position_periods_updated_at
         BEFORE UPDATE ON staff_position_periods
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
       END IF;
     END $$`,
    'CREATE INDEX IF NOT EXISTS idx_staff_position_periods_staff_id ON staff_position_periods(staff_id)',
    `INSERT INTO staff_position_periods (id, staff_id, period_number, jabatan, start_date, end_date)
     SELECT
       'SPP-' || s.id || '-1',
       s.id,
       1,
       s.jabatan,
       COALESCE(s.created_at::date, CURRENT_DATE),
       CASE WHEN s.status = 'Non-Aktif' THEN COALESCE(s.updated_at::date, CURRENT_DATE) ELSE NULL END
     FROM staff s
     WHERE NOT EXISTS (
       SELECT 1 FROM staff_position_periods p WHERE p.staff_id = s.id
     )`,
  ];

  try {
    for (const query of schemaQueries) {
      await pool.query(query);
    }
    console.log('Auth schema ensured successfully');

    // Sync Google SSO client ID from process.env.VITE_GOOGLE_CLIENT_ID if present
    const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID;
    if (googleClientId) {
      try {
        const ssoCheck = await pool.query('SELECT * FROM sso_config LIMIT 1');
        if (ssoCheck.rows.length > 0) {
          const currentSso = ssoCheck.rows[0];
          if (currentSso.client_id !== googleClientId) {
            console.log(`🔄 Syncing Google SSO Client ID in database`);
            await pool.query(
              'UPDATE sso_config SET client_id = $1, enabled = TRUE, updated_at = NOW() WHERE id = $2',
              [googleClientId, currentSso.id]
            );
          }
        } else {
          console.log(`🔄 Seeding Google SSO Client ID from .env: ${googleClientId}`);
          await pool.query(
            'INSERT INTO sso_config (enabled, client_id, domain) VALUES (TRUE, $1, $2)',
            [googleClientId, 'uksw.edu,student.uksw.edu,students.uksw.edu']
          );
        }
      } catch (ssoErr) {
        console.error('Error syncing SSO config:', ssoErr);
      }
    }
  } catch (err) {
    console.error('Error ensuring auth schema:', err);
    throw err;
  }
};

export const ensureCalendarSchema = async () => {
  const schemaQueries = [
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ language 'plpgsql'`,
    `CREATE TABLE IF NOT EXISTS calendar_sources (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      provider VARCHAR(30) NOT NULL DEFAULT 'core',
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_calendar_sources_provider CHECK (provider IN ('core', 'google_legacy', 'ics_import'))
    )`,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calendar_sources_updated_at') THEN
         CREATE TRIGGER update_calendar_sources_updated_at
         BEFORE UPDATE ON calendar_sources
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
       END IF;
     END $$`,
    `INSERT INTO calendar_sources (id, name, provider, is_primary, is_active, notes)
     VALUES ('CORE_CALENDAR', 'CORE.FTI Calendar', 'core', TRUE, TRUE, 'Primary internal calendar source of truth.')
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         provider = EXCLUDED.provider,
         is_primary = TRUE,
         is_active = TRUE,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
    "UPDATE calendar_sources SET is_primary = FALSE, updated_at = NOW() WHERE id <> 'CORE_CALENDAR' AND is_primary = TRUE",
    `CREATE TABLE IF NOT EXISTS calendar_events (
      id VARCHAR(50) PRIMARY KEY,
      source_id VARCHAR(50) NOT NULL DEFAULT 'CORE_CALENDAR',
      room_id VARCHAR(50),
      booking_id VARCHAR(50),
      source_reference_type VARCHAR(50),
      source_reference_id VARCHAR(100),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      location TEXT,
      event_type VARCHAR(30) NOT NULL DEFAULT 'manual',
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      visibility VARCHAR(30) NOT NULL DEFAULT 'internal',
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
      recurrence_rule TEXT,
      recurrence_until TIMESTAMPTZ,
      created_by VARCHAR(50),
      updated_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_calendar_event_source FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE RESTRICT,
      CONSTRAINT fk_calendar_event_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      CONSTRAINT fk_calendar_event_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      CONSTRAINT fk_calendar_event_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_calendar_event_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_calendar_event_type CHECK (event_type IN ('booking', 'class_schedule', 'maintenance', 'manual', 'holiday')),
      CONSTRAINT chk_calendar_event_status CHECK (status IN ('scheduled', 'tentative', 'cancelled')),
      CONSTRAINT chk_calendar_event_visibility CHECK (visibility IN ('internal', 'public'))
    )`,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calendar_events_updated_at') THEN
         CREATE TRIGGER update_calendar_events_updated_at
         BEFORE UPDATE ON calendar_events
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS calendar_occurrences (
      id VARCHAR(50) PRIMARY KEY,
      event_id VARCHAR(50) NOT NULL,
      room_id VARCHAR(50),
      booking_schedule_id INTEGER,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_calendar_occurrence_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      CONSTRAINT fk_calendar_occurrence_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      CONSTRAINT fk_calendar_occurrence_booking_schedule FOREIGN KEY (booking_schedule_id) REFERENCES booking_schedules(id) ON DELETE SET NULL,
      CONSTRAINT chk_calendar_occurrence_status CHECK (status IN ('scheduled', 'tentative', 'cancelled')),
      CONSTRAINT chk_calendar_occurrence_time CHECK (end_at > start_at)
    )`,
    'ALTER TABLE calendar_occurrences ALTER COLUMN room_id DROP NOT NULL',
    'ALTER TABLE calendar_occurrences ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT FALSE',
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calendar_occurrences_updated_at') THEN
         CREATE TRIGGER update_calendar_occurrences_updated_at
         BEFORE UPDATE ON calendar_occurrences
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS calendar_audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      event_id VARCHAR(50),
      occurrence_id VARCHAR(50),
      actor_user_id VARCHAR(50),
      action VARCHAR(50) NOT NULL,
      previous_data JSONB,
      next_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_calendar_audit_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE SET NULL,
      CONSTRAINT fk_calendar_audit_occurrence FOREIGN KEY (occurrence_id) REFERENCES calendar_occurrences(id) ON DELETE SET NULL,
      CONSTRAINT fk_calendar_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    'DROP INDEX IF EXISTS idx_calendar_sources_primary',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sources_primary ON calendar_sources(is_primary) WHERE is_primary = TRUE',
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_source_id ON calendar_events(source_id)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_room_id ON calendar_events(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_booking_id ON calendar_events(booking_id)',
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_booking_unique ON calendar_events(booking_id) WHERE booking_id IS NOT NULL AND status <> 'cancelled'",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_class_schedule_unique ON calendar_events(source_reference_id) WHERE source_reference_type = 'class_schedule' AND source_reference_id IS NOT NULL AND status <> 'cancelled'",
    'CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_occurrences_event_id ON calendar_occurrences(event_id)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_occurrences_room_time ON calendar_occurrences(room_id, start_at, end_at)',
    "CREATE INDEX IF NOT EXISTS idx_calendar_occurrences_active_time ON calendar_occurrences(room_id, start_at, end_at) WHERE status IN ('scheduled', 'tentative')",
    'CREATE INDEX IF NOT EXISTS idx_calendar_occurrences_booking_schedule_id ON calendar_occurrences(booking_schedule_id)',
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_occurrences_booking_schedule_unique ON calendar_occurrences(booking_schedule_id) WHERE booking_schedule_id IS NOT NULL AND status <> 'cancelled'",
    'CREATE INDEX IF NOT EXISTS idx_calendar_audit_event_id ON calendar_audit_logs(event_id)',
    'CREATE INDEX IF NOT EXISTS idx_calendar_audit_created_at ON calendar_audit_logs(created_at)'
  ];

  try {
    for (const query of schemaQueries) {
      await pool.query(query);
    }
    console.log('Calendar schema ensured successfully');
  } catch (err) {
    console.error('Error ensuring calendar schema:', err);
    throw err;
  }

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await pool.query(`DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'excl_calendar_occurrences_room_overlap'
       ) THEN
         ALTER TABLE calendar_occurrences
         ADD CONSTRAINT excl_calendar_occurrences_room_overlap
         EXCLUDE USING gist (
           room_id WITH =,
           tstzrange(start_at, end_at, '[)') WITH &&
         )
         WHERE (room_id IS NOT NULL AND status IN ('scheduled', 'tentative'));
       END IF;
     END $$`);
  } catch (err) {
    console.warn('Calendar overlap constraint was not installed. Enable PostgreSQL btree_gist to enforce DB-level room conflict prevention.', err.message);
  }
};

export const ensureAcademicSchema = async () => {
  const schemaQueries = [
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ language 'plpgsql'`,
    'ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS lecturer_id VARCHAR(50)',
    `CREATE TABLE IF NOT EXISTS semester_periods (
      id VARCHAR(50) PRIMARY KEY,
      semester VARCHAR(20) NOT NULL,
      academic_year VARCHAR(20) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(50),
      updated_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_semester_period UNIQUE (semester, academic_year),
      CONSTRAINT fk_semester_period_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_semester_period_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_semester_period_semester CHECK (semester IN ('Ganjil', 'Antara', 'Genap')),
      CONSTRAINT chk_semester_period_academic_year CHECK (academic_year ~ '^\\d{4}/\\d{4}$'),
      CONSTRAINT chk_semester_period_dates CHECK (end_date >= start_date)
    )`,
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS semester VARCHAR(20)',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS start_date DATE',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS end_date DATE',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS notes TEXT',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE semester_periods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_semester_period') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT uq_semester_period UNIQUE (semester, academic_year);
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_semester_period_created_by') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT fk_semester_period_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_semester_period_updated_by') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT fk_semester_period_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_semester_period_semester') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT chk_semester_period_semester CHECK (semester IN ('Ganjil', 'Antara', 'Genap'));
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_semester_period_academic_year') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT chk_semester_period_academic_year CHECK (academic_year ~ '^\\d{4}/\\d{4}$');
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_semester_period_dates') THEN
         ALTER TABLE semester_periods ADD CONSTRAINT chk_semester_period_dates CHECK (end_date >= start_date);
       END IF;
     END $$`,
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_semester_periods_updated_at') THEN
         CREATE TRIGGER update_semester_periods_updated_at
         BEFORE UPDATE ON semester_periods
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS class_schedule_software (
      class_schedule_id VARCHAR(50) NOT NULL,
      software_id VARCHAR(50) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (class_schedule_id, software_id),
      CONSTRAINT fk_class_schedule_software_schedule FOREIGN KEY (class_schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE,
      CONSTRAINT fk_class_schedule_software_software FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
    )`,
    'ALTER TABLE class_schedule_software ADD COLUMN IF NOT EXISTS class_schedule_id VARCHAR(50)',
    'ALTER TABLE class_schedule_software ADD COLUMN IF NOT EXISTS software_id VARCHAR(50)',
    'ALTER TABLE class_schedule_software ADD COLUMN IF NOT EXISTS notes TEXT',
    'ALTER TABLE class_schedule_software ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_schedule_software_schedule') THEN
         ALTER TABLE class_schedule_software ADD CONSTRAINT fk_class_schedule_software_schedule FOREIGN KEY (class_schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_schedule_software_software') THEN
         ALTER TABLE class_schedule_software ADD CONSTRAINT fk_class_schedule_software_software FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE;
       END IF;
     END $$`,
    'CREATE INDEX IF NOT EXISTS idx_semester_periods_lookup ON semester_periods(semester, academic_year)',
    'CREATE INDEX IF NOT EXISTS idx_semester_periods_active ON semester_periods(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_class_schedule_software_schedule ON class_schedule_software(class_schedule_id)',
    'CREATE INDEX IF NOT EXISTS idx_class_schedule_software_software ON class_schedule_software(software_id)'
  ];

  try {
    for (const query of schemaQueries) {
      await pool.query(query);
    }
    console.log('Academic schema ensured successfully');
  } catch (err) {
    console.error('Error ensuring academic schema:', err);
    throw err;
  }
};

// --- DATABASE INDEXES (Optimizations) ---
export const createIndexes = async () => {
  const indexes = [
    // Users table indexes
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    
    // Bookings table indexes
    'CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
    
    // Booking schedules indexes
    'CREATE INDEX IF NOT EXISTS idx_booking_schedules_booking_id ON booking_schedules(booking_id)',
    'CREATE INDEX IF NOT EXISTS idx_booking_schedules_date ON booking_schedules(schedule_date)',
    
    // Inventory indexes
    'CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(kategori)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_available ON inventory(is_available)',
    'CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(lokasi)',
    
    // Item movements indexes
    'CREATE INDEX IF NOT EXISTS idx_item_movements_inventory_id ON item_movements(inventory_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_movements_date ON item_movements(movement_date)',
    
    // Rooms index
    'CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name)',
  ];

  try {
    for (const indexQuery of indexes) {
      await pool.query(indexQuery);
    }
    console.log('Database indexes created successfully');
  } catch (err) {
    console.error('Error creating indexes:', err);
  }
};

export { pool, dbConfig };
