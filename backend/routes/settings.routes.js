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

// Endpoint Get Status Maintenance
router.get('/settings/maintenance', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenance_mode' LIMIT 1");
    res.json({ enabled: result.rows[0]?.value === 'true' });
  } catch (err) {
    console.error('Error fetching maintenance status:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan maintenance' });
  }
});

// Endpoint Update Status Maintenance
router.put('/settings/maintenance', verifyRole(['Admin']), async (req, res) => {
  const { enabled } = req.body;
  try {
    await pool.query(
      "INSERT INTO system_settings (key, value) VALUES ('maintenance_mode', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [String(enabled)]
    );
    res.json({ success: true, message: 'Status maintenance diperbarui' });
  } catch (err) {
    console.error('Error updating maintenance status:', err);
    res.status(500).json({ error: 'Gagal memperbarui status maintenance' });
  }
});

// Endpoint Get Global Announcement
router.get('/settings/announcement', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'global_announcement' LIMIT 1");
    const value = result.rows[0]?.value;
    res.json(value ? JSON.parse(value) : { active: false, message: '', type: 'info' });
  } catch (err) {
    console.error('Error fetching global announcement:', err);
    res.status(500).json({ error: 'Gagal mengambil pengumuman' });
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
    console.error('Error updating global announcement:', err);
    res.status(500).json({ error: 'Gagal memperbarui pengumuman' });
  }
});

// Endpoint Get Konfigurasi SSO
router.get('/settings/sso-config', async (req, res) => {
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

// Endpoint Update Konfigurasi SSO
router.put('/settings/sso-config', verifyRole(['Admin']), async (req, res) => {
  const { enabled, clientId, domain } = req.body;
  try {
    const result = await pool.query('SELECT id FROM sso_config LIMIT 1');
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE sso_config SET enabled = $1, client_id = $2, domain = $3, updated_at = NOW() WHERE id = $4',
        [enabled, clientId, domain, result.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO sso_config (enabled, client_id, domain) VALUES ($1, $2, $3)',
        [enabled, clientId, domain]
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

// --- Error Logs Management ---

// Endpoint Get Error Logs
router.get('/error-logs', verifyRole(['Admin']), async (req, res) => {
  try {
    const { type, severity, resolved, startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM error_logs WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM error_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND error_type = $${paramIndex}`;
      countQuery += ` AND error_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      countQuery += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (resolved) {
      query += ` AND is_resolved = $${paramIndex}`;
      countQuery += ` AND is_resolved = $${paramIndex}`;
      params.push(resolved === 'true');
      paramIndex++;
    }

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      countQuery += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      countQuery += ` AND created_at <= $${paramIndex}`;
      params.push(endDate + ' 23:59:59');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const countResult = await pool.query(countQuery, params);
    
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const dataResult = await pool.query(query, dataParams);

    res.json({
      logs: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (err) {
    console.error('Get error logs error:', err);
    res.status(500).json({ error: 'Gagal mengambil error logs' });
  }
});

// Endpoint POST Error Logs
router.post('/error-logs', async (req, res) => {
  try {
    const { type, message, stack, endpoint, method, severity } = req.body;
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;
    const browserInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';

    await pool.query(
      `INSERT INTO error_logs 
        (error_type, error_message, error_stack, endpoint, method, user_id, user_email, browser_info, ip_address, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [type || 'Frontend', message, stack, endpoint, method, userId, userEmail, browserInfo, ipAddress, severity || 'ERROR']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Create error log error:', err);
    res.status(500).json({ error: 'Gagal menyimpan error log.' });
  }
});

// Get Error Log Statistics
router.get('/error-logs/stats', verifyRole(['Admin']), async (req, res) => {
  try {
    const typeStats = await pool.query(`SELECT error_type, COUNT(*) as count FROM error_logs GROUP BY error_type ORDER BY count DESC`);
    const severityStats = await pool.query(`SELECT severity, COUNT(*) as count FROM error_logs GROUP BY severity ORDER BY count DESC`);
    const unresolvedResult = await pool.query('SELECT COUNT(*) as count FROM error_logs WHERE is_resolved = FALSE');
    const todayResult = await pool.query(`SELECT COUNT(*) as count FROM error_logs WHERE created_at >= CURRENT_DATE`);

    res.json({
      byType: typeStats.rows,
      bySeverity: severityStats.rows,
      unresolved: parseInt(unresolvedResult.rows[0].count),
      today: parseInt(todayResult.rows[0].count)
    });
  } catch (err) {
    console.error('Get error log stats error:', err);
    res.status(500).json({ error: 'Gagal mengambil statistik error logs.' });
  }
});

// Resolve Error Log
router.put('/error-logs/:id/resolve', verifyRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await pool.query(
      'UPDATE error_logs SET is_resolved = TRUE, resolved_by = $1, resolved_at = NOW() WHERE id = $2',
      [userId, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Resolve error log error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan error log.' });
  }
});

// Delete/Clear Error Logs
router.delete('/error-logs', verifyRole(['Admin']), async (req, res) => {
  try {
    const { resolved, olderThan } = req.body;

    let query = 'DELETE FROM error_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (resolved === true) {
      query += ` AND is_resolved = $${paramIndex}`;
      params.push(true);
      paramIndex++;
    }

    if (olderThan) {
      query += ` AND created_at < $${paramIndex}`;
      params.push(olderThan);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('Delete error logs error:', err);
    res.status(500).json({ error: 'Gagal menghapus error logs.' });
  }
});

export default router;
