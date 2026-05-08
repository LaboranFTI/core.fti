import express from 'express';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';

const router = express.Router();

// ==========================================
// ENDPOINT CRUD LECTURER
// ==========================================

// 1. GET - Mengambil semua data dosen
// Endpoint: GET /lecturers
router.get('/lecturers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lecturer ORDER BY nama ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching lecturers:', err);
    res.status(500).json({ error: 'Gagal mengambil data dosen' });
  }
});

// 2. GET - Mengambil satu data dosen berdasarkan ID (Kode Dosen)
// Endpoint: GET /lecturers/:id
router.get('/lecturers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM lecturer WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data dosen tidak ditemukan' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching lecturer:', err);
    res.status(500).json({ error: 'Gagal mengambil data dosen' });
  }
});

// 3. POST - Menambahkan data dosen baru
// Endpoint: POST /lecturers
router.post('/lecturers', verifyRole(['Admin']), async (req, res) => {
  const { id, nama } = req.body;

  if (!id || !nama) {
    return res.status(400).json({ error: 'Kode dosen (id) dan nama wajib diisi.' });
  }

  try {
    // Cek apakah kode dosen sudah terdaftar
    const existing = await pool.query('SELECT id FROM lecturer WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Kode dosen tersebut sudah terdaftar.' });
    }

    const result = await pool.query(
      'INSERT INTO lecturer (id, nama) VALUES ($1, $2) RETURNING *',
      [id, nama]
    );

    res.status(201).json({
      success: true,
      message: 'Data dosen berhasil ditambahkan',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating lecturer:', err);
    res.status(500).json({ error: 'Gagal menambahkan data dosen' });
  }
});

// 4. PUT - Mengubah data dosen (nama)
// Endpoint: PUT /lecturers/:id
router.put('/lecturers/:id', verifyRole(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { nama } = req.body;

  if (!nama) {
    return res.status(400).json({ error: 'Nama dosen wajib diisi.' });
  }

  try {
    const result = await pool.query(
      'UPDATE lecturer SET nama = $1 WHERE id = $2 RETURNING *',
      [nama, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data dosen tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Data dosen berhasil diperbarui',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating lecturer:', err);
    res.status(500).json({ error: 'Gagal memperbarui data dosen' });
  }
});

// 5. DELETE - Menghapus data dosen
// Endpoint: DELETE /lecturers/:id
router.delete('/lecturers/:id', verifyRole(['Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM lecturer WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data dosen tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Data dosen berhasil dihapus'
    });
  } catch (err) {
    console.error('Error deleting lecturer:', err);
    res.status(500).json({ error: 'Gagal menghapus data dosen. Pastikan data tidak sedang digunakan di tabel lain.' });
  }
});

export default router;