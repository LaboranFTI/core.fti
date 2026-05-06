import express from 'express';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
const router = express.Router();
const ROOM_MANAGEMENT_ROLES = ['Admin', 'Laboran', 'Supervisor'];

// --- ROOMS (Tabel: rooms) ---

router.get('/rooms', async (req, res) => {
  try {
    const excludeImage = req.query.exclude_image === 'true';
    const imageColumn = excludeImage ? 'NULL' : 'r.image_data';
    // Join dengan staff untuk dapat nama PIC
    const result = await pool.query(`
        SELECT r.id, r.name, r.category, r.deskripsi, r.kapasitas, r.pic_id, r.fasilitas, r.google_calendar_url, r.lantai, ${imageColumn} as image_data, s.nama as pic_name,
                   (SELECT COUNT(*) FROM room_computers rc WHERE rc.room_id = r.id) as computer_count,
                   (SELECT b.keperluan FROM bookings b 
                     JOIN booking_schedules bs ON b.id = bs.booking_id 
                     WHERE b.room_id = r.id AND b.status = 'Disetujui' 
                     AND bs.schedule_date = CURRENT_DATE 
                     AND CURRENT_TIME BETWEEN bs.start_time AND bs.end_time LIMIT 1) as current_activity,
                   (SELECT bs.end_time FROM bookings b 
                     JOIN booking_schedules bs ON b.id = bs.booking_id 
                     WHERE b.room_id = r.id AND b.status = 'Disetujui' 
                     AND bs.schedule_date = CURRENT_DATE 
                     AND CURRENT_TIME BETWEEN bs.start_time AND bs.end_time LIMIT 1) as current_activity_end,
                   CASE WHEN EXISTS (
                     SELECT 1 FROM bookings b 
                     JOIN booking_schedules bs ON b.id = bs.booking_id 
                     WHERE b.room_id = r.id AND b.status = 'Disetujui' 
                     AND bs.schedule_date = CURRENT_DATE 
                     AND CURRENT_TIME BETWEEN bs.start_time AND bs.end_time
                   ) THEN 'Digunakan' ELSE 'Tersedia' END as current_status
        FROM rooms r 
        LEFT JOIN staff s ON r.pic_id = s.id 
        ORDER BY r.name ASC
    `);
    const rooms = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.deskripsi,
      capacity: row.kapasitas,
      pic: row.pic_name || 'Unknown', 
      pic_id: row.pic_id,
      image: row.image_data ? `data:image/jpeg;base64,${row.image_data.toString('base64')}` : null,
      facilities: row.fasilitas || [],
      googleCalendarUrl: row.google_calendar_url,
      floor: row.lantai || 'FTI Lt. 4',
      computerCount: parseInt(row.computer_count || '0'),
      currentStatus: row.current_status,
      currentActivity: row.current_activity,
      currentActivityEnd: row.current_activity_end
    }));
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.get('/room/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
        SELECT r.id, r.name, r.category, r.deskripsi, r.kapasitas, r.pic_id, r.fasilitas, r.google_calendar_url, r.lantai, r.image_data, s.nama as pic_name,
               (SELECT COUNT(*) FROM room_computers rc WHERE rc.room_id = r.id) as computer_count
        FROM rooms r 
        LEFT JOIN staff s ON r.pic_id = s.id 
        WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const row = result.rows[0];
    const room = {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.deskripsi,
      capacity: row.kapasitas,
      pic: row.pic_name || 'Unknown',
      pic_id: row.pic_id,
      image: row.image_data ? `data:image/jpeg;base64,${row.image_data.toString('base64')}` : null,
      facilities: row.fasilitas || [],
      googleCalendarUrl: row.google_calendar_url,
      floor: row.lantai || 'FTI Lt. 4',
      computerCount: parseInt(row.computer_count || '0'),
    };
    res.json(room);
  } catch (err) { res.status(500).json({ error: 'DB Error' }); }
});

router.post('/rooms', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  const { id, name, category, description, capacity, pic, image, facilities, googleCalendarUrl, floor } = req.body;
  try {
    // Cari ID Staff berdasarkan nama (karena frontend mengirim nama)
    let picId = null;
    const staffRes = await pool.query("SELECT id FROM staff WHERE nama = $1", [pic]);
    if (staffRes.rows.length > 0) picId = staffRes.rows[0].id;

    // Convert Base64 Image to Buffer
    let imageBuffer = null;
    if (image && image.startsWith('data:image')) {
        const base64Data = image.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
    }

    await pool.query(
      'INSERT INTO rooms (id, name, category, deskripsi, kapasitas, pic_id, image_data, fasilitas, google_calendar_url, lantai) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, name, category, description, capacity, picId, imageBuffer, facilities || [], googleCalendarUrl, floor || 'FTI Lt. 4']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.put('/rooms/:id', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
    const { name, category, description, capacity, pic, image, facilities, googleCalendarUrl, floor } = req.body;
    try {
      let picId = null;
      const staffRes = await pool.query("SELECT id FROM staff WHERE nama = $1", [pic]);
      if (staffRes.rows.length > 0) picId = staffRes.rows[0].id;
  
      let updateQuery = 'UPDATE rooms SET name=$1, category=$2, deskripsi=$3, kapasitas=$4, pic_id=$5, fasilitas=$6, google_calendar_url=$7, lantai=$8';
      let params = [name, category, description, capacity, picId, facilities || [], googleCalendarUrl, floor];
      let paramIndex = 9;

      if (image !== undefined) {
          let imageBuffer = null;
          if (image && image.startsWith('data:image')) {
              imageBuffer = Buffer.from(image.split(',')[1], 'base64');
          }
          updateQuery += `, image_data=$${paramIndex}`;
          params.push(imageBuffer);
          paramIndex++;
      }

      updateQuery += ` WHERE id=$${paramIndex}`;
      params.push(req.params.id);

      await pool.query(updateQuery, params);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Gagal memperbarui data ruangan' });
    }
});

router.delete('/rooms/:id', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
    try {
      await pool.query('DELETE FROM rooms WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'DB Error' });
    }
});

// --- ROOM COMPUTERS (Spesifikasi) ---

// Get All Computers in a Room
router.get('/rooms/:id/computers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM room_computers WHERE room_id = $1 ORDER BY pc_number ASC', [req.params.id]);
    const computers = result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      pcNumber: row.pc_number,
      cpu: row.cpu,
      gpuType: row.gpu_type,
      gpuModel: row.gpu_model,
      vram: row.vram,
      ram: row.ram,
      storage: row.storage,
      os: row.os,
      keyboard: row.keyboard,
      mouse: row.mouse,
      monitor: row.monitor,
      condition: row.condition
    }));
    res.json(computers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// Get Dominant Spec Summary for a Room
router.get('/rooms/:id/specs-summary', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM room_computers WHERE room_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.json(null);

    // Hitung frekuensi spesifikasi yang sama
    const counts = {};
    let maxCount = 0;
    let dominant = null;

    for (const pc of result.rows) {
        // Buat signature key dari spek (kecuali ID dan Nomor PC)
        const key = JSON.stringify({
            cpu: pc.cpu, gpu_type: pc.gpu_type, gpu_model: pc.gpu_model,
            vram: pc.vram, ram: pc.ram, storage: pc.storage,
            os: pc.os, keyboard: pc.keyboard, mouse: pc.mouse, monitor: pc.monitor
        });
        
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > maxCount) {
            maxCount = counts[key];
            dominant = JSON.parse(key);
        }
    }
    
    res.json({ ...dominant, totalUnits: result.rows.length, dominantCount: maxCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// Add/Update Computer
router.post('/computers', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  const { id, roomId, pcNumber, cpu, gpuType, gpuModel, vram, ram, storage, os, keyboard, mouse, monitor, condition } = req.body;
  try {
    // Upsert (Insert or Update)
    const query = `
      INSERT INTO room_computers (id, room_id, pc_number, cpu, gpu_type, gpu_model, vram, ram, storage, os, keyboard, mouse, monitor, condition)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
      pc_number=$3, cpu=$4, gpu_type=$5, gpu_model=$6, vram=$7, ram=$8, storage=$9, os=$10, keyboard=$11, mouse=$12, monitor=$13, condition=$14
    `;
    await pool.query(query, [id, roomId, pcNumber, cpu, gpuType, gpuModel, vram, ram, storage, os, keyboard, mouse, monitor, condition || 'Baik']);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// Delete All Computers in a Room (Reset)
router.delete('/rooms/:id/computers', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM room_computers WHERE room_id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.delete('/computers/:id', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM room_computers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- SOFTWARE (Tabel: software) ---

// Get All Software
router.get('/software', async (req, res) => {
  try {
    const { roomId, category } = req.query;
    let query = `
      SELECT s.*, r.name as room_name 
      FROM software s 
      LEFT JOIN rooms r ON s.room_id = r.id
    `;
    let params = [];
    let conditions = [];
    
    if (roomId) {
      params.push(roomId);
      conditions.push(`s.room_id = $${params.length}`);
    }
    
    if (category) {
      params.push(category);
      conditions.push(`s.category = $${params.length}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.name ASC';
    
    const result = await pool.query(query, params);
    const software = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      version: row.version,
      licenseType: row.license_type,
      licenseKey: row.license_key,
      vendor: row.vendor,
      installDate: row.install_date ? new Date(row.install_date).toLocaleDateString('en-CA') : '',
      roomId: row.room_id,
      roomName: row.room_name,
      notes: row.notes,
      category: row.category
    }));
    res.json(software);
  } catch (err) {
    console.error('Get software error:', err);
    res.status(500).json({ error: 'Gagal mengambil data software.' });
  }
});

// Add New Software
router.post('/software', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  const { name, version, licenseType, licenseKey, vendor, installDate, roomId, notes, category } = req.body;
  try {
    const id = `SOFT-${Date.now()}`;
    await pool.query(
      `INSERT INTO software (id, name, version, license_type, license_key, vendor, install_date, room_id, notes, category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, name, version, licenseType, licenseKey || null, vendor || null, installDate || null, roomId || null, notes || null, category || null]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Add software error:', err);
    res.status(500).json({ error: 'Gagal menambah software.' });
  }
});

// Update Software
router.put('/software/:id', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  const { id } = req.params;
  const { name, version, licenseType, licenseKey, vendor, installDate, roomId, notes, category } = req.body;
  try {
    await pool.query(
      `UPDATE software SET name=$1, version=$2, license_type=$3, license_key=$4, vendor=$5, install_date=$6, room_id=$7, notes=$8, category=$9, updated_at=CURRENT_TIMESTAMP WHERE id=$10`,
      [name, version, licenseType, licenseKey || null, vendor || null, installDate || null, roomId || null, notes || null, category || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update software error:', err);
    res.status(500).json({ error: 'Gagal update software.' });
  }
});

// Delete Software
router.delete('/software/:id', verifyRole(ROOM_MANAGEMENT_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM software WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus software.' });
  }
});

export default router;
