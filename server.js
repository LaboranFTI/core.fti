import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { allowedOrigins } from './backend/config/cors.js';
import { pool, testConnection, createIndexes, ensureAuthSchema } from './backend/config/database.js';
import { verifyToken } from './backend/middleware/auth.js';
import authRoutes from './backend/routes/auth.routes.js';
import userRoutes from './backend/routes/user.routes.js';
import inventoryRoutes from './backend/routes/inventory.routes.js';
import roomRoutes from './backend/routes/room.routes.js';
import bookingRoutes from './backend/routes/booking.routes.js';
import loanRoutes from './backend/routes/loan.routes.js';
import systemRoutes from './backend/routes/system.routes.js';
import settingsRoutes from './backend/routes/settings.routes.js';
import siasatRoutes from './backend/routes/siasat.routes.js';
import tuRoutes from './backend/routes/tu.routes.v2.js';
import lecturerRoutes from './backend/routes/lecturer.routes.js';
import studyProgramRoutes from './backend/routes/study_program.routes.js';

const app = express();
const port = process.env.PORT || 5000; // Menggunakan port dari env atau default 5000

// Trust Proxy: Agar Express bisa membaca IP asli user dari Nginx (X-Forwarded-For)
app.set('trust proxy', 1);

// --- Security Middlewares ---

// 1. Set various HTTP headers for security
app.use(helmet());

// 2. Enable CORS with specific origin
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
    // Also allow file:// for local development
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all origins for development
    }
  }
}));

// 3. Body Parser
app.use(express.json({ limit: '20mb' })); // Tingkatkan limit ke 20mb untuk gambar 360 resolusi tinggi
app.use(express.urlencoded({ extended: true, limit: '20mb' })); // Tambahkan juga limit untuk urlencoded

// Konfigurasi Upload (Simpan sementara di folder uploads/)
const upload = multer({ dest: 'uploads/' });

// --- Rute Publik (Akses Guest Tanpa Token) ---
// Harus diletakkan SEBELUM middleware verifyToken agar bisa diakses oleh guest di App.tsx & Login.tsx
app.get('/api/settings/maintenance', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance_mode'");
    const isEnabled = result.rows.length > 0 && result.rows[0].value === 'true';
    res.json({ enabled: isEnabled });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil pengaturan maintenance' });
  }
});

app.get('/api/settings/announcement', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'global_announcement'");
    if (result.rows.length > 0 && result.rows[0].value) {
      res.json(JSON.parse(result.rows[0].value));
    } else {
      res.json({ active: false, message: '', type: 'info' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil pengumuman' });
  }
});

app.get('/api/settings/sso-config', async (req, res) => {
  try {
    const result = await pool.query('SELECT enabled, client_id as "clientId", domain FROM sso_config LIMIT 1');
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ enabled: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil konfigurasi SSO' });
  }
});

// Terapkan middleware verifikasi token ke semua rute API
app.use('/api', verifyToken);

// --- Rute Khusus Admin ---
// Endpoint untuk menghapus error log yang sudah diselesaikan (resolved)
app.delete('/api/error-logs', async (req, res) => {
  try {
    // Proteksi tambahan: Pastikan hanya Admin yang bisa menghapus log
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Akses ditolak. Hanya Admin yang dapat menghapus log sistem.' });
    }

    const { resolved } = req.body;
    if (resolved === true) {
      const result = await pool.query('DELETE FROM error_logs WHERE is_resolved = true RETURNING id');
      res.json({ success: true, deleted: result.rowCount });
    } else {
      res.status(400).json({ error: 'Parameter tidak valid' });
    }
  } catch (err) {
    console.error('Error deleting resolved logs:', err);
    res.status(500).json({ error: 'Gagal menghapus log error' });
  }
});

// Mount all route modules under /api
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', roomRoutes);
app.use('/api', bookingRoutes);
app.use('/api', loanRoutes);
app.use('/api', systemRoutes);
app.use('/api', settingsRoutes);
app.use('/api', siasatRoutes);
app.use('/api', tuRoutes);
app.use('/api', lecturerRoutes);
app.use('/api', studyProgramRoutes);

// Global Error Handler untuk menangkap error yang tidak terduga
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
});

// Test Endpoint
app.get('/', (req, res) => {
  res.send('Backend API CORE.FTI is running on port 5000');
});

// Jalankan Server
const startServer = async () => {
  try {
    await testConnection();
    await ensureAuthSchema();
    await createIndexes();

    app.listen(port, () => {
      console.log(`Backend server berjalan di http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Gagal menyiapkan server:', err);
    process.exit(1);
  }
};

startServer();
