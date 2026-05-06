import express from 'express';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
const router = express.Router();
const INVENTORY_MANAGEMENT_ROLES = ['Admin', 'Laboran', 'Supervisor'];

// --- INVENTORY

router.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY created_at DESC');
    const items = result.rows.map(row => ({
      id: row.id,
      ukswCode: row.uksw_code,
      name: row.nama,
      category: row.kategori,
      condition: row.kondisi,
      isAvailable: row.is_available,
      serialNumber: row.serial_number,
      location: row.lokasi,
      vendor: row.vendor
    }));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.post('/inventory', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  const { id, ukswCode, name, category, condition, isAvailable, serialNumber, location, vendor } = req.body;
  try {
    await pool.query(
      'INSERT INTO inventory (id, uksw_code, nama, kategori, kondisi, is_available, serial_number, lokasi, vendor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, ukswCode, name, category, condition, isAvailable, serialNumber, location || '', vendor || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Gagal menyimpan data ruangan' });
  }
});

router.put('/inventory/:id', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  const { ukswCode, name, category, condition, isAvailable, serialNumber, location, vendor } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Ambil data lama untuk mengecek perubahan lokasi
    const oldItemRes = await client.query('SELECT lokasi, is_available FROM inventory WHERE id = $1', [req.params.id]);
    const oldLocation = oldItemRes.rows.length > 0 ? (oldItemRes.rows[0].lokasi || '') : '';
    const wasAvailable = oldItemRes.rows.length > 0 ? oldItemRes.rows[0].is_available : true;
    const newLocation = location || '';

    // Validasi Ketersediaan: Cegah pemaksaan ubah status jadi Tersedia jika barang masih dipinjam!
    if (isAvailable && !wasAvailable) {
        const activeLoan = await client.query('SELECT id FROM loans WHERE inventory_id = $1 AND status = \'Dipinjam\'', [req.params.id]);
        if (activeLoan.rows.length > 0) {
            throw new Error('Gagal: Tidak dapat diubah menjadi Tersedia karena barang sedang dalam masa peminjaman.');
        }
    }

    // 2. Update data inventaris
    await client.query(
      'UPDATE inventory SET uksw_code=$1, nama=$2, kategori=$3, kondisi=$4, is_available=$5, serial_number=$6, lokasi=$7, vendor=$8 WHERE id=$9',
      [ukswCode, name, category, condition, isAvailable, serialNumber, newLocation, vendor || '', req.params.id]
    );

    // 3. Catat di item_movements jika lokasi berubah
    if (oldLocation !== newLocation && oldItemRes.rows.length > 0) {
      let movedBy = 'System';
      if (req.user && req.user.id) {
        const userRes = await client.query('SELECT nama FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length > 0) movedBy = userRes.rows[0].nama;
      }

      const moveId = `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const movementDate = new Date().toISOString().split('T')[0];

      await client.query(
        `INSERT INTO item_movements (id, inventory_id, movement_date, movement_type, from_person, to_person, moved_by, quantity, from_location, to_location, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [moveId, req.params.id, movementDate, 'Manual', '', '', movedBy, 1, oldLocation, newLocation, `Perubahan lokasi via Edit Inventaris. Kondisi: ${condition}`]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  } finally {
    client.release();
  }
});

router.delete('/inventory/:id', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- ITEM MOVEMENTS (Tabel: item_movements) ---

router.get('/item-movements', async (req, res) => {
  try {
    const { inventoryId } = req.query;
    let query = `
      SELECT m.*, i.nama as inventory_name 
      FROM item_movements m 
      LEFT JOIN inventory i ON m.inventory_id = i.id
    `;
    let params = [];
    
    if (inventoryId) {
      query += ' WHERE m.inventory_id = $1';
      params.push(inventoryId);
    }
    
    query += ' ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    const movements = result.rows.map(row => ({
      id: row.id,
      inventoryId: row.inventory_id,
      inventoryName: row.inventory_name,
      movementDate: row.movement_date ? new Date(row.movement_date).toLocaleDateString('en-CA') : '',
      movementType: row.movement_type,
      fromPerson: row.from_person,
      toPerson: row.to_person,
      movedBy: row.moved_by,
      quantity: row.quantity,
      fromLocation: row.from_location,
      toLocation: row.to_location,
      notes: row.notes,
      loanId: row.loan_id,
      createdAt: row.created_at
    }));
    res.json(movements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.post('/item-movements', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  const { inventoryId, movementDate, movementType, fromPerson, toPerson, movedBy, quantity, fromLocation, toLocation, notes, loanId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const id = `MOV-${Date.now()}`;
    
    // Insert movement record
    await client.query(
      `INSERT INTO item_movements (id, inventory_id, movement_date, movement_type, from_person, to_person, moved_by, quantity, from_location, to_location, notes, loan_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, inventoryId, movementDate, movementType, fromPerson, toPerson, movedBy, quantity || 1, fromLocation, toLocation, notes, loanId || null]
    );
    
    // Update inventory location to new location
    if (toLocation) {
      await client.query('UPDATE inventory SET lokasi = $1 WHERE id = $2', [toLocation, inventoryId]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true, id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  } finally {
    client.release();
  }
});

router.put('/item-movements/:id', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  const { id } = req.params;
  const { movementDate, fromPerson, toPerson, movedBy, quantity, fromLocation, toLocation, notes } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const movRes = await client.query('SELECT * FROM item_movements WHERE id = $1', [id]);
    if (movRes.rows.length === 0) throw new Error('Data tidak ditemukan');
    const mov = movRes.rows[0];

    // Validasi: hanya bisa mengedit tipe perpindahan "Manual"
    if (mov.movement_type !== 'Manual') {
      throw new Error('Hanya perpindahan manual yang dapat diedit secara langsung');
    }

    // Update tabel item_movements
    await client.query(
      `UPDATE item_movements 
       SET movement_date = $1, from_person = $2, to_person = $3, moved_by = $4, quantity = $5, from_location = $6, to_location = $7, notes = $8
       WHERE id = $9`,
      [movementDate, fromPerson, toPerson, movedBy, quantity, fromLocation, toLocation, notes, id]
    );

    // Update lokasi di tabel inventory JIKA ini adalah riwayat perpindahan yang paling terakhir
    if (toLocation !== undefined && toLocation !== mov.to_location) {
       const lastRes = await client.query('SELECT id FROM item_movements WHERE inventory_id = $1 ORDER BY created_at DESC LIMIT 1', [mov.inventory_id]);
       if (lastRes.rows.length > 0 && lastRes.rows[0].id === id) {
          await client.query('UPDATE inventory SET lokasi = $1 WHERE id = $2', [toLocation || '', mov.inventory_id]);
       }
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Gagal memperbarui data' });
  } finally {
    client.release();
  }
});

// Undo Movement (Batalkan Perpindahan Terakhir)
router.post('/item-movements/:id/undo', verifyRole(INVENTORY_MANAGEMENT_ROLES), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ambil data movement yang mau di-undo
    const moveRes = await client.query('SELECT * FROM item_movements WHERE id = $1', [id]);
    if (moveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Data perpindahan tidak ditemukan.' });
    }
    const movement = moveRes.rows[0];

    // 2. Validasi: Jangan izinkan undo jika berasal dari Peminjaman (harus lewat menu Loans)
    if (movement.loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Perpindahan ini terkait Peminjaman. Gunakan menu Peminjaman untuk membatalkan.' });
    }

    // 3. Validasi: Cek apakah ini movement terakhir untuk barang tersebut?
    const lastRes = await client.query(
      'SELECT id FROM item_movements WHERE inventory_id = $1 ORDER BY created_at DESC LIMIT 1',
      [movement.inventory_id]
    );

    if (lastRes.rows.length > 0 && lastRes.rows[0].id !== id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Hanya perpindahan terakhir yang dapat dibatalkan demi konsistensi data.' });
    }

    // 4. Kembalikan lokasi barang ke 'from_location' & Hapus record
    await client.query('UPDATE inventory SET lokasi = $1 WHERE id = $2', [movement.from_location || '', movement.inventory_id]);
    await client.query('DELETE FROM item_movements WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Perpindahan berhasil dibatalkan.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Undo movement error:', err);
    res.status(500).json({ error: 'Gagal membatalkan perpindahan.' });
  } finally {
    client.release();
  }
});

export default router;
