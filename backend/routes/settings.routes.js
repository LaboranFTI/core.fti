import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import multer from 'multer';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Endpoint Update Status Maintenance
router.put('/settings/maintenance', verifyRole(['Admin']), async (req, res) => {
  const { maintenance_mode } = req.body;
  try {
    await pool.query(
      "INSERT INTO system_settings (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [String(maintenance_mode)]
    );
    res.json({ success: true, message: 'Status maintenance diperbarui' });
  } catch (err) {
    console.error('Error fetching maintenance status:', err);
    res.status(500).json({ error: 'Gagal memperbarui status maintenance' });
  }
});

// Endpoint Update Global Announcement
router.put('/settings/announcement', verifyRole(['Admin']), async (req, res) => {
  const announcement = req.body; // { active: boolean, message: string, type: string }
  try {
    await pool.query(
      "INSERT INTO system_settings (key, value) VALUES ('global_announcement', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [JSON.stringify(announcement)]
    );
    res.json({ success: true, message: 'Pengumuman diperbarui' });
  } catch (err) {
    console.error('Error fetching global announcement:', err);
    res.status(500).json({ error: 'Gagal memperbarui pengumuman' });
  }
});

// Endpoint Update Konfigurasi SSO
router.put('/settings/sso-config', verifyRole(['Admin']), async (req, res) => {
  const { enabled, client_id, domain } = req.body;
  try {
    const result = await pool.query('SELECT id FROM sso_config LIMIT 1');
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE sso_config SET enabled = $1, client_id = $2, domain = $3, updated_at = NOW() WHERE id = $4',
        [enabled, client_id, domain, result.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO sso_config (enabled, client_id, domain) VALUES ($1, $2, $3)',
        [enabled, client_id, domain]
      );
    }
    res.json({ success: true, message: 'Konfigurasi SSO diperbarui' });
  } catch (err) {
    console.error('Error fetching SSO config:', err);
    res.status(500).json({ error: 'Gagal memperbarui konfigurasi SSO' });
  }
});

// Endpoint Download Backup Database
router.get('/settings/backup', verifyRole(['Admin']), (req, res) => {
  const date = new Date().toISOString().split('T')[0];
  const fileName = `backup-corefti-${date}.sql`;
  const filePath = path.join(os.tmpdir(), fileName);

  // Flag -c (--clean) akan menambahkan script "DROP TABLE" secara otomatis di dalam SQL.
  // Berguna agar proses restore tidak terbentur masalah "Table Already Exists".
  // Flag -w (--no-password) mencegah hang menunggu input jika autentikasi gagal.
  const dumpCommand = `pg_dump -U ${process.env.DB_USER} -h ${process.env.DB_HOST} -p ${process.env.DB_PORT || 5432} -d ${process.env.DB_NAME} -F p -c -w -f "${filePath}"`;

  exec(dumpCommand, {
    env: {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD
    }
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Backup error: ${error.message}`, stderr);
      return res.status(500).json({ error: 'Gagal membuat backup. Pastikan pg_dump terinstall di sistem.' });
    }

    res.download(filePath, fileName, (err) => {
      if (err) console.error("Error downloading file:", err);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Hapus dari disk setelah diunduh
    });
  });
});

// Endpoint Upload & Restore Database
router.post('/settings/restore', verifyRole(['Admin']), upload.single('file'), (req, res) => {
  // Pastikan form-data dari Frontend menggunakan key "file"
  if (!req.file) {
    return res.status(400).json({ error: 'File backup (.sql) tidak ditemukan pada request.' });
  }

  const filePath = req.file.path;

  // Gunakan 'psql' untuk mengeksekusi file format plain text SQL (-F p)
  const restoreCommand = `psql -U ${process.env.DB_USER} -h ${process.env.DB_HOST} -p ${process.env.DB_PORT || 5432} -d ${process.env.DB_NAME} -w -f "${filePath}"`;

  exec(restoreCommand, {
    env: {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD
    }
  }, (error, stdout, stderr) => {
    // Selalu hapus file temporary yang diupload user
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (error) {
      console.error(`Restore error: ${error.message}`, stderr);
      return res.status(500).json({ error: 'Gagal merestore database. Pastikan file valid.' });
    }

    res.json({ success: true, message: 'Database berhasil dipulihkan (Restore).' });
  });
});

// Endpoint Get Konfigurasi SSO
router.get('/settings/sso-config', verifyRole(['Admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT enabled, client_id as "clientId", domain FROM sso_config LIMIT 1');
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ enabled: false, clientId: '', domain: '' });
    }
  } catch (err) {
    console.error('Error fetching SSO config:', err);
    res.status(500).json({ error: 'Gagal memuat konfigurasi SSO' });
  }
});

// Endpoint Get SSO Users
router.get('/sso-users', verifyRole(['Admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, status, created_at as "createdAt", updated_at as "updatedAt" FROM sso_users ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching SSO users:', err);
    res.status(500).json({ error: 'Gagal memuat data SSO users' });
  }
});

export default router;