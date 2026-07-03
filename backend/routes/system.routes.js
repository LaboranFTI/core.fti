import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import multer from 'multer';
import { pool, dbConfig } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
const router = express.Router();

// Konfigurasi Upload for restore
const upload = multer({ dest: 'uploads/' });

// --- ENDPOINTS STAFF (Data Internal & PIC) ---

const normalizeLabRoomIds = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(
    value
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => item.trim())
  )];
};

const normalizeDateValue = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getTodayDateValue = () => new Date().toISOString().slice(0, 10);

const syncStaffLabAssignments = async (client, staffId, labRoomIds) => {
  await client.query(
    `UPDATE rooms
     SET pic_id = NULL
     WHERE pic_id = $1
       AND category = 'Laboratorium Komputer'
       AND NOT (id = ANY($2::text[]))`,
    [staffId, labRoomIds]
  );

  if (labRoomIds.length === 0) return;

  await client.query(
    `UPDATE rooms
     SET pic_id = $1
     WHERE category = 'Laboratorium Komputer'
       AND id = ANY($2::text[])`,
    [staffId, labRoomIds]
  );
};

const insertStaffPositionPeriod = async (client, staffId, periodNumber, jabatan, startDate, endDate = null) => {
  const periodId = `SPP-${staffId}-${periodNumber}-${Date.now()}`;
  await client.query(
    `INSERT INTO staff_position_periods (id, staff_id, period_number, jabatan, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [periodId, staffId, periodNumber, jabatan, startDate, endDate]
  );
};

const syncStaffPositionPeriod = async (client, staffId, {
  jabatan,
  status,
  previousStatus,
  positionStartDate,
  positionEndDate
}) => {
  const requestedStartDate = normalizeDateValue(positionStartDate);
  const requestedEndDate = normalizeDateValue(positionEndDate);
  const fallbackDate = getTodayDateValue();

  const latestResult = await client.query(
    `SELECT id, period_number, start_date, end_date
     FROM staff_position_periods
     WHERE staff_id = $1
     ORDER BY period_number DESC
     LIMIT 1`,
    [staffId]
  );
  const latestPeriod = latestResult.rows[0] || null;

  const openResult = await client.query(
    `SELECT id, period_number, start_date
     FROM staff_position_periods
     WHERE staff_id = $1 AND end_date IS NULL
     ORDER BY period_number DESC
     LIMIT 1`,
    [staffId]
  );
  const openPeriod = openResult.rows[0] || null;

  if (!latestPeriod) {
    const startDate = requestedStartDate || fallbackDate;
    const endDate = status === 'Non-Aktif' ? (requestedEndDate || startDate) : null;
    await insertStaffPositionPeriod(client, staffId, 1, jabatan, startDate, endDate);
    return;
  }

  if (status === 'Non-Aktif') {
    if (!openPeriod) return;
    await client.query(
      `UPDATE staff_position_periods
       SET jabatan = $1,
           start_date = COALESCE($2::date, start_date),
           end_date = $3
       WHERE id = $4`,
      [jabatan, requestedStartDate, requestedEndDate || fallbackDate, openPeriod.id]
    );
    return;
  }

  if (previousStatus === 'Non-Aktif' || !openPeriod) {
    await insertStaffPositionPeriod(
      client,
      staffId,
      Number(latestPeriod.period_number || 0) + 1,
      jabatan,
      requestedStartDate || fallbackDate,
      null
    );
    return;
  }

  await client.query(
    `UPDATE staff_position_periods
     SET jabatan = $1,
         start_date = COALESCE($2::date, start_date)
     WHERE id = $3`,
    [jabatan, requestedStartDate, openPeriod.id]
  );
};

// Get All Staff
router.get('/staff', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
             (
               SELECT COALESCE(array_agg(r.id ORDER BY r.name), ARRAY[]::varchar[])
               FROM rooms r
               WHERE r.pic_id = s.id
                 AND r.category = 'Laboratorium Komputer'
             ) AS assigned_lab_ids,
             (
               SELECT COALESCE(array_agg(r.name ORDER BY r.name), ARRAY[]::varchar[])
               FROM rooms r
               WHERE r.pic_id = s.id
                 AND r.category = 'Laboratorium Komputer'
             ) AS assigned_lab_names,
             (
               SELECT COALESCE(
                 json_agg(
                   json_build_object(
                     'id', p.id,
                     'periodNumber', p.period_number,
                     'jabatan', p.jabatan,
                     'startDate', to_char(p.start_date, 'YYYY-MM-DD'),
                     'endDate', CASE WHEN p.end_date IS NULL THEN NULL ELSE to_char(p.end_date, 'YYYY-MM-DD') END
                   )
                   ORDER BY p.period_number
                 ),
                 '[]'::json
               )
               FROM staff_position_periods p
               WHERE p.staff_id = s.id
             ) AS position_periods
      FROM staff s
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ error: 'Gagal mengambil data staff.' });
  }
});

// Add New Staff
router.post('/staff', async (req, res) => {
  const { name, nim, email, phone, jabatan, status, keterangan, positionStartDate, positionEndDate } = req.body;
  const labRoomIds = jabatan === 'Teknisi' ? (normalizeLabRoomIds(req.body.labRoomIds) || []) : [];
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const id = `STF-${Date.now()}`;
    await client.query(
      "INSERT INTO staff (id, nama, identifier, email, telepon, jabatan, keterangan, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, name, nim, email, phone, jabatan, keterangan || null, status]
    );
    await syncStaffPositionPeriod(client, id, {
      jabatan,
      status,
      previousStatus: null,
      positionStartDate,
      positionEndDate
    });
    await syncStaffLabAssignments(client, id, labRoomIds);
    await client.query('COMMIT');
    res.json({ success: true, id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add staff error:', err);
    res.status(500).json({ error: 'Gagal menambah staff.' });
  } finally {
    client.release();
  }
});

// Update Staff
router.put('/staff/:id', async (req, res) => {
  const { id } = req.params;
  const { name, nim, email, phone, jabatan, status, keterangan, positionStartDate, positionEndDate } = req.body;
  const normalizedLabRoomIds = normalizeLabRoomIds(req.body.labRoomIds);
  const shouldSyncLabs = normalizedLabRoomIds !== null || jabatan !== 'Teknisi';
  const labRoomIds = jabatan === 'Teknisi' ? (normalizedLabRoomIds || []) : [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const currentResult = await client.query('SELECT status FROM staff WHERE id = $1', [id]);
    const previousStatus = currentResult.rows[0]?.status || null;

    await client.query(
      "UPDATE staff SET nama=$1, identifier=$2, email=$3, telepon=$4, jabatan=$5, keterangan=$6, status=$7 WHERE id=$8",
      [name, nim, email, phone, jabatan, keterangan || null, status, id]
    );
    await syncStaffPositionPeriod(client, id, {
      jabatan,
      status,
      previousStatus,
      positionStartDate,
      positionEndDate
    });
    if (shouldSyncLabs) {
      await syncStaffLabAssignments(client, id, labRoomIds);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Gagal update staff.' });
  } finally {
    client.release();
  }
});

// Delete Staff
router.delete('/staff/:id', async (req, res) => {
  try {
    await pool.query("DELETE FROM staff WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Gagal menghapus staff.' });
  }
});

// --- PKL STUDENTS (Tabel: pkl_students) ---

// Get All PKL Students
router.get('/pkl', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.nama_siswa, p.sekolah, p.jurusan, p.tanggal_mulai, p.tanggal_selesai, 
             p.status, p.pembimbing_id, p.created_at, p.updated_at,
             (p.surat_pengajuan IS NOT NULL) AS has_surat,
             s.nama as pembimbing_nama 
      FROM pkl_students p 
      LEFT JOIN staff s ON p.pembimbing_id = s.id
      ORDER BY p.created_at DESC
    `);
    
    const pklStudents = result.rows.map(row => ({
      id: row.id,
      nama: row.nama_siswa,
      sekolah: row.sekolah,
      Jurusan: row.jurusan,
      tanggalMulai: row.tanggal_mulai ? new Date(row.tanggal_mulai).toLocaleDateString('en-CA') : '',
      tanggalSelesai: row.tanggal_selesai ? new Date(row.tanggal_selesai).toLocaleDateString('en-CA') : '',
      status: row.status,
      hasSurat: row.has_surat,
      pembimbingId: row.pembimbing_id,
      pembimbingNama: row.pembimbing_nama,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(pklStudents);
  } catch (err) {
    console.error('Get PKL error:', err);
    res.status(500).json({ error: 'Gagal mengambil data PKL.' });
  }
});

// Get PKL Document (On-Demand)
router.get('/pkl/:id/document', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT surat_pengajuan FROM pkl_students WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0 || !result.rows[0].surat_pengajuan) {
      return res.status(404).json({ error: 'Surat pengajuan tidak ditemukan.' });
    }
    
    const base64Data = `data:application/pdf;base64,${result.rows[0].surat_pengajuan.toString('base64')}`;
    res.json({ file: base64Data });
  } catch (err) {
    console.error('Get PKL document error:', err);
    res.status(500).json({ error: 'Gagal mengambil dokumen PKL.' });
  }
});

// Add New PKL Student (Single or Batch)
router.post('/pkl', async (req, res) => {
  const { students } = req.body;
  
  // students bisa berupa array (batch) atau single object
  const studentList = Array.isArray(students) ? students : [students];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const student of studentList) {
      const { nama, sekolah, Jurusan, tanggalMulai, tanggalSelesai, pembimbingId, suratPengajuan } = student;
      
      // Konversi file PDF jika ada
      let suratBuffer = null;
      if (suratPengajuan && suratPengajuan.startsWith('data:application/pdf')) {
        const base64Data = suratPengajuan.split(',')[1];
        suratBuffer = Buffer.from(base64Data, 'base64');
        
        // Validasi ukuran: Max 5MB
        if (suratBuffer.length > 5 * 1024 * 1024) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Ukuran file surat pengajuan melebihi batas maksimum 5MB.' });
        }
      }
      
      const id = `PKL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      await client.query(
        `INSERT INTO pkl_students (id, nama_siswa, sekolah, Jurusan, tanggal_mulai, tanggal_selesai, pembimbing_id, surat_pengajuan, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Aktif')`,
        [id, nama, sekolah, Jurusan, tanggalMulai, tanggalSelesai, pembimbingId || null, suratBuffer]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: `${studentList.length} data PKL berhasil ditambahkan.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add PKL error:', err);
    res.status(500).json({ error: 'Gagal menambah data PKL.' });
  } finally {
    client.release();
  }
});

// Update PKL Student
router.put('/pkl/:id', async (req, res) => {
  const { id } = req.params;
  const { nama, sekolah, Jurusan, tanggalMulai, tanggalSelesai, status, pembimbingId, suratPengajuan } = req.body;
  
  try {
    // Cek jika ada file baru
    let suratBuffer = null;
    if (suratPengajuan && suratPengajuan.startsWith('data:application/pdf')) {
      const base64Data = suratPengajuan.split(',')[1];
      suratBuffer = Buffer.from(base64Data, 'base64');
      
      // Validasi ukuran
      if (suratBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Ukuran file surat pengajuan melebihi batas maksimum 5MB.' });
      }
      
      // Update dengan file baru
      await pool.query(
        `UPDATE pkl_students SET nama_siswa=$1, sekolah=$2, Jurusan=$3, tanggal_mulai=$4, tanggal_selesai=$5, status=$6, pembimbing_id=$7, surat_pengajuan=$8, updated_at=CURRENT_TIMESTAMP WHERE id=$9`,
        [nama, sekolah, Jurusan, tanggalMulai, tanggalSelesai, status, pembimbingId || null, suratBuffer, id]
      );
    } else {
      // Update tanpa mengubah file
      await pool.query(
        `UPDATE pkl_students SET nama_siswa=$1, sekolah=$2, Jurusan=$3, tanggal_mulai=$4, tanggal_selesai=$5, status=$6, pembimbing_id=$7, updated_at=CURRENT_TIMESTAMP WHERE id=$8`,
        [nama, sekolah, Jurusan, tanggalMulai, tanggalSelesai, status, pembimbingId || null, id]
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update PKL error:', err);
    res.status(500).json({ error: 'Gagal update data PKL.' });
  }
});

// Delete PKL Student
router.delete('/pkl/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pkl_students WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete PKL error:', err);
    res.status(500).json({ error: 'Gagal menghapus data PKL.' });
  }
});

// --- CLASS SCHEDULES (Jadwal Kuliah) ---

// Get All Class Schedules
router.get('/class-schedules', async (req, res) => {
  try {
    const { semester, academicYear, roomId } = req.query;
    
    let query = 'SELECT cs.*, r.name as room_name, l.nama as lecturer_name FROM class_schedules cs LEFT JOIN rooms r ON cs.room_id = r.id LEFT JOIN lecturer l ON cs.lecturer_id = l.id';
    let params = [];
    let conditions = [];
    
    if (semester) {
      params.push(semester);
      conditions.push(`cs.semester = $${params.length}`);
    }
    
    if (academicYear) {
      params.push(academicYear);
      conditions.push(`cs.academic_year = $${params.length}`);
    }
    
    if (roomId) {
      params.push(roomId);
      conditions.push(`cs.room_id = $${params.length}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY cs.day_of_week, cs.start_time';
    
    const result = await pool.query(query, params);
    
    const schedules = result.rows.map(row => ({
      id: row.id,
      courseCode: row.course_code,
      courseName: row.course_name,
      classGroup: row.class_group,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time ? row.start_time.substring(0, 5) : '',
      endTime: row.end_time ? row.end_time.substring(0, 5) : '',
      semester: row.semester,
      academicYear: row.academic_year,
      roomId: row.room_id,
      roomName: row.room_name,
      lecturerId: row.lecturer_id,
      lecturerName: row.lecturer_name,
      startDate: row.start_date ? new Date(row.start_date).toLocaleDateString('en-CA') : '',
      endDate: row.end_date ? new Date(row.end_date).toLocaleDateString('en-CA') : ''
    }));
    
    res.json(schedules);
  } catch (err) {
    console.error('Get class schedules error:', err);
    res.status(500).json({ error: 'Gagal mengambil jadwal kelas.' });
  }
});

// Add New Class Schedule
router.post('/class-schedules', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
  const {
    courseCode, courseName, classGroup, dayOfWeek,
    startTime, endTime, semester, academicYear,
    roomId, lecturerId, lecturerName, startDate, endDate
  } = req.body;

  try {
    const id = `SCH-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO class_schedules 
       (id, course_code, course_name, class_group, day_of_week, start_time, end_time, semester, academic_year, room_id, lecturer_id, lecturer_name, start_date, end_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING *`,
      [
        id, courseCode, courseName, classGroup || '-', dayOfWeek, 
        startTime, endTime, semester, academicYear, 
        roomId || null, lecturerId || null, lecturerName || '', 
        startDate || null, endDate || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating class schedule:', err);
    res.status(500).json({ error: 'Gagal menambahkan jadwal kelas' });
  }
});

// Update Class Schedule
router.put('/class-schedules/:id', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
  const { id } = req.params;
  const {
    courseCode, courseName, classGroup, dayOfWeek,
    startTime, endTime, semester, academicYear,
    roomId, lecturerId, lecturerName, startDate, endDate
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE class_schedules 
       SET course_code = $1, course_name = $2, class_group = $3, day_of_week = $4, 
           start_time = $5, end_time = $6, semester = $7, academic_year = $8, 
           room_id = $9, lecturer_id = $10, lecturer_name = $11, start_date = $12, end_date = $13,
           updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [
        courseCode, courseName, classGroup || '-', dayOfWeek, 
        startTime, endTime, semester, academicYear, 
        roomId || null, lecturerId || null, lecturerName || '', 
        startDate || null, endDate || null, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jadwal kelas tidak ditemukan' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating class schedule:', err);
    res.status(500).json({ error: 'Gagal memperbarui jadwal kelas' });
  }
});

// Delete Class Schedule
router.delete('/class-schedules/:id', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM class_schedules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jadwal kelas tidak ditemukan' });
    }
    res.json({ success: true, message: 'Jadwal kelas berhasil dihapus' });
  } catch (err) {
    console.error('Error deleting class schedule:', err);
    res.status(500).json({ error: 'Gagal menghapus jadwal kelas' });
  }
});

export default router;
