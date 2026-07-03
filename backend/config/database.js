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
