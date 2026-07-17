import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Helper function to execute queries
const queryWilayah = async (res, query, params = []) => {
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wilayah:', error);
    res.status(500).json({ message: 'Internal server error fetching wilayah data' });
  }
};

// 1. Get all provinces
router.get('/provinces', (req, res) => {
  const query = `SELECT kode, nama FROM wilayah WHERE LENGTH(kode) = 2 ORDER BY nama ASC`;
  queryWilayah(res, query);
});

// 2. Get regencies by province ID
router.get('/regencies/:provinceId', (req, res) => {
  const { provinceId } = req.params;
  const query = `SELECT kode, nama FROM wilayah WHERE LENGTH(kode) = 5 AND kode LIKE $1 || '.%' ORDER BY nama ASC`;
  queryWilayah(res, query, [provinceId]);
});

// 3. Get districts by regency ID
router.get('/districts/:regencyId', (req, res) => {
  const { regencyId } = req.params;
  const query = `SELECT kode, nama FROM wilayah WHERE LENGTH(kode) = 8 AND kode LIKE $1 || '.%' ORDER BY nama ASC`;
  queryWilayah(res, query, [regencyId]);
});

// 4. Get villages by district ID
router.get('/villages/:districtId', (req, res) => {
  const { districtId } = req.params;
  const query = `SELECT kode, nama FROM wilayah WHERE LENGTH(kode) > 8 AND kode LIKE $1 || '.%' ORDER BY nama ASC`;
  queryWilayah(res, query, [districtId]);
});

export default router;
