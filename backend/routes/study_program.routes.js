import express from 'express';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';

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

// 2. POST - Menambahkan program studi
router.post('/study-programs', verifyRole(['Admin', 'Admin TU']), async (req, res) => {
  const id = req.body.id?.trim();
  const name = req.body.name?.trim();
  const level = req.body.level?.trim();

  if (!id || !name || !level) {
    return res.status(400).json({ error: 'Kode NIM, nama program studi, dan jenjang wajib diisi.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO study_programs (id, name, level) VALUES ($1, $2, $3) RETURNING *',
      [id, name, level]
    );

    res.status(201).json({
      success: true,
      message: 'Program studi berhasil ditambahkan',
      data: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Kode NIM program studi sudah terdaftar.' });
    }

    console.error('Error creating study program:', err);
    res.status(500).json({ error: 'Gagal menambahkan program studi' });
  }
});

// 3. PUT - Memperbarui program studi
router.put('/study-programs/:id', verifyRole(['Admin', 'Admin TU']), async (req, res) => {
  const { id } = req.params;
  const name = req.body.name?.trim();
  const level = req.body.level?.trim();

  if (!name || !level) {
    return res.status(400).json({ error: 'Nama program studi dan jenjang wajib diisi.' });
  }

  try {
    const result = await pool.query(
      'UPDATE study_programs SET name = $1, level = $2 WHERE id = $3 RETURNING *',
      [name, level, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program studi tidak ditemukan.' });
    }

    res.json({
      success: true,
      message: 'Program studi berhasil diperbarui',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating study program:', err);
    res.status(500).json({ error: 'Gagal memperbarui program studi' });
  }
});

// 4. DELETE - Menghapus program studi
router.delete('/study-programs/:id', verifyRole(['Admin', 'Admin TU']), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM study_programs WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program studi tidak ditemukan.' });
    }

    res.json({
      success: true,
      message: 'Program studi berhasil dihapus'
    });
  } catch (err) {
    console.error('Error deleting study program:', err);
    res.status(500).json({ error: 'Gagal menghapus program studi' });
  }
});

// 5. GET - Mengambil Kepala Program Studi berdasarkan ID prodi
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

// 6. GET - Mengambil dosen berdasarkan jabatan (misal: Dekan)
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
