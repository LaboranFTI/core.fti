import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// ==========================================
// ENDPOINT PROGRAM STUDI
// ==========================================

// 1. GET - Mengambil semua program studi
// Endpoint: GET /study-programs
router.get('/study-programs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM study_programs ORDER BY level ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching study programs:', err);
    res.status(500).json({ error: 'Gagal mengambil data program studi' });
  }
});

// 2. GET - Mengambil Kepala Program Studi berdasarkan ID prodi
// Endpoint: GET /study-programs/:id/kaprodi
router.get('/study-programs/:id/kaprodi', async (req, res) => {
  try {
    const { id } = req.params;

    // Cari dosen dengan jabatan 'Kepala Program Studi' untuk prodi ini
    const result = await pool.query(
      `SELECT l.id, l.nama, l.jabatan, l.study_program_id
       FROM lecturer l
       WHERE l.jabatan = 'Kepala Program Studi' AND l.study_program_id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ found: false, kaprodi: null });
    }

    res.json({ found: true, kaprodi: result.rows[0] });
  } catch (err) {
    console.error('Error fetching kaprodi:', err);
    res.status(500).json({ error: 'Gagal mengambil data Kepala Program Studi' });
  }
});

// 3. GET - Mengambil dosen berdasarkan jabatan (misal: Dekan)
// Endpoint: GET /lecturers/by-jabatan/:jabatan
router.get('/lecturers/by-jabatan/:jabatan', async (req, res) => {
  try {
    const { jabatan } = req.params;
    const result = await pool.query(
      `SELECT l.id, l.nama, l.jabatan, l.study_program_id,
              sp.name AS study_program_name, sp.level AS study_program_level
       FROM lecturer l
       LEFT JOIN study_programs sp ON l.study_program_id = sp.id
       WHERE l.jabatan = $1
       ORDER BY l.nama ASC`,
      [jabatan]
    );

    res.json({ found: result.rows.length > 0, data: result.rows });
  } catch (err) {
    console.error('Error fetching lecturer by jabatan:', err);
    res.status(500).json({ error: 'Gagal mengambil data dosen berdasarkan jabatan' });
  }
});

export default router;
