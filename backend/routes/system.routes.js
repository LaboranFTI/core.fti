import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import multer from 'multer';
import { pool, dbConfig } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
import {
  CalendarConflictError,
  CalendarNotFoundError,
  CalendarValidationError,
  cancelCalendarEventsForClassSchedule,
  syncClassScheduleToCalendar,
} from '../services/calendar.service.js';
import jwt from 'jsonwebtoken';
const router = express.Router();

// Konfigurasi Upload for restore
const upload = multer({ dest: 'uploads/' });

const CLASS_SCHEDULE_MUTATION_ROLES = ['Admin', 'Laboran', 'Supervisor'];
const CLASS_SCHEDULE_DAYS = new Set(['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']);
const CLASS_SCHEDULE_SEMESTERS = new Set(['Ganjil', 'Antara', 'Genap']);
const LAB_ROOM_CATEGORY = 'Laboratorium Komputer';
const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLASS_SCHEDULE_SOFTWARE_IDS = 100;

const createClassScheduleId = () => `SCH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const createSemesterPeriodId = () => `SEM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');
const optionalTrimmedString = (value) => {
  const trimmed = trimString(value);
  return trimmed || null;
};
const normalizeTimeValue = (value) => trimString(value).slice(0, 5);
const normalizeBoolean = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);
const normalizeIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  const normalized = [...new Set(
    value
      .map((item) => trimString(item))
      .filter(Boolean)
  )];
  if (normalized.length > MAX_CLASS_SCHEDULE_SOFTWARE_IDS) {
    throw new CalendarValidationError(`Maksimal ${MAX_CLASS_SCHEDULE_SOFTWARE_IDS} software dapat dipilih untuk satu jadwal.`);
  }
  return normalized;
};

const normalizeClassSchedulePayload = (body = {}) => {
  const payload = {
    courseCode: trimString(body.courseCode).toUpperCase(),
    courseName: trimString(body.courseName),
    classGroup: trimString(body.classGroup) || '-',
    dayOfWeek: trimString(body.dayOfWeek),
    startTime: normalizeTimeValue(body.startTime),
    endTime: normalizeTimeValue(body.endTime),
    semester: trimString(body.semester),
    academicYear: trimString(body.academicYear),
    roomId: optionalTrimmedString(body.roomId),
    lecturerId: optionalTrimmedString(body.lecturerId),
    lecturerName: trimString(body.lecturerName),
    startDate: optionalTrimmedString(body.startDate),
    endDate: optionalTrimmedString(body.endDate),
    softwareIds: normalizeIdArray(body.softwareIds),
  };

  if (!payload.courseCode || !payload.courseName || !payload.dayOfWeek || !payload.startTime || !payload.endTime || !payload.semester || !payload.academicYear) {
    throw new CalendarValidationError('Kode, nama, hari, jam, semester, dan tahun akademik wajib diisi.');
  }
  if (!CLASS_SCHEDULE_DAYS.has(payload.dayOfWeek)) {
    throw new CalendarValidationError('Hari jadwal kelas tidak valid.');
  }
  if (!CLASS_SCHEDULE_SEMESTERS.has(payload.semester)) {
    throw new CalendarValidationError('Semester jadwal kelas tidak valid.');
  }
  if (!/^\d{4}\/\d{4}$/.test(payload.academicYear)) {
    throw new CalendarValidationError('Format tahun akademik harus YYYY/YYYY.');
  }
  if (!TIME_VALUE_PATTERN.test(payload.startTime) || !TIME_VALUE_PATTERN.test(payload.endTime)) {
    throw new CalendarValidationError('Format jam jadwal kelas tidak valid.');
  }
  if (payload.endTime <= payload.startTime) {
    throw new CalendarValidationError('Jam selesai harus lebih besar dari jam mulai.');
  }
  if ((payload.startDate && !DATE_VALUE_PATTERN.test(payload.startDate)) || (payload.endDate && !DATE_VALUE_PATTERN.test(payload.endDate))) {
    throw new CalendarValidationError('Format tanggal periode harus YYYY-MM-DD.');
  }
  if ((payload.startDate && !payload.endDate) || (!payload.startDate && payload.endDate)) {
    throw new CalendarValidationError('Tanggal mulai dan selesai periode harus diisi berpasangan.');
  }
  if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
    throw new CalendarValidationError('Tanggal selesai periode harus setelah tanggal mulai.');
  }
  return payload;
};

const normalizeSemesterPeriodPayload = (body = {}) => {
  const payload = {
    semester: trimString(body.semester),
    academicYear: trimString(body.academicYear),
    startDate: optionalTrimmedString(body.startDate),
    endDate: optionalTrimmedString(body.endDate),
    notes: optionalTrimmedString(body.notes),
    isActive: normalizeBoolean(body.isActive, true),
  };

  if (!CLASS_SCHEDULE_SEMESTERS.has(payload.semester)) {
    throw new CalendarValidationError('Semester tidak valid.');
  }
  if (!/^\d{4}\/\d{4}$/.test(payload.academicYear)) {
    throw new CalendarValidationError('Format tahun akademik harus YYYY/YYYY.');
  }
  if (!payload.startDate || !payload.endDate || !DATE_VALUE_PATTERN.test(payload.startDate) || !DATE_VALUE_PATTERN.test(payload.endDate)) {
    throw new CalendarValidationError('Tanggal mulai dan selesai semester wajib berformat YYYY-MM-DD.');
  }
  if (payload.endDate < payload.startDate) {
    throw new CalendarValidationError('Tanggal selesai semester harus setelah tanggal mulai.');
  }

  return payload;
};

const sendClassScheduleMutationError = (res, err, fallbackMessage) => {
  if (err instanceof CalendarConflictError || err?.code === 'CALENDAR_CONFLICT') {
    return res.status(409).json({ error: err.message, code: err.code });
  }
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Data dengan kombinasi yang sama sudah ada.', code: 'DUPLICATE_DATA' });
  }
  if (err?.code === '23503' || err?.code === '23514') {
    return res.status(422).json({ error: 'Referensi atau nilai data tidak valid.', code: 'INVALID_REFERENCE' });
  }
  if (err instanceof CalendarNotFoundError || err instanceof CalendarValidationError || err?.status) {
    return res.status(err.status || 422).json({ error: err.message || fallbackMessage, code: err.code });
  }
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

const mapSemesterPeriodRow = (row) => ({
  id: row.id,
  semester: row.semester,
  academicYear: row.academic_year,
  startDate: row.start_date ? new Date(row.start_date).toLocaleDateString('en-CA') : '',
  endDate: row.end_date ? new Date(row.end_date).toLocaleDateString('en-CA') : '',
  notes: row.notes || '',
  isActive: row.is_active,
});

const getActiveSemesterPeriod = async (queryable, semester, academicYear) => {
  const result = await queryable.query(
    `SELECT *
     FROM semester_periods
     WHERE semester = $1
       AND academic_year = $2
       AND is_active = TRUE
     LIMIT 1`,
    [semester, academicYear]
  );
  return result.rows[0] || null;
};

const applySemesterPeriodDates = async (queryable, payload) => {
  if (!payload.roomId) return payload;

  const period = await getActiveSemesterPeriod(queryable, payload.semester, payload.academicYear);
  if (!period) {
    if (!payload.startDate || !payload.endDate) {
      throw new CalendarValidationError('Konfigurasi periode semester aktif belum tersedia untuk jadwal ruangan ini.');
    }
    return payload;
  }

  return {
    ...payload,
    startDate: mapSemesterPeriodRow(period).startDate,
    endDate: mapSemesterPeriodRow(period).endDate,
  };
};

const syncClassSchedulesForSemesterPeriod = async (client, payload, actorUserId) => {
  if (!payload.isActive) {
    return { schedulesUpdated: 0, calendarSyncedCount: 0 };
  }

  const schedules = await client.query(
    `UPDATE class_schedules
     SET start_date = $1,
         end_date = $2,
         updated_at = NOW()
     WHERE semester = $3
       AND academic_year = $4
       AND room_id IS NOT NULL
     RETURNING id`,
    [payload.startDate, payload.endDate, payload.semester, payload.academicYear]
  );

  let calendarSyncedCount = 0;
  for (const row of schedules.rows) {
    const calendarEvents = await syncClassScheduleToCalendar(client, row.id, actorUserId);
    if (calendarEvents) calendarSyncedCount++;
  }

  return { schedulesUpdated: schedules.rowCount, calendarSyncedCount };
};

const syncClassScheduleSoftware = async (client, scheduleId, roomId, softwareIds) => {
  const normalizedSoftwareIds = normalizeIdArray(softwareIds);

  if (!roomId || normalizedSoftwareIds.length === 0) {
    await client.query('DELETE FROM class_schedule_software WHERE class_schedule_id = $1', [scheduleId]);
    return;
  }

  const roomResult = await client.query('SELECT id, category FROM rooms WHERE id = $1', [roomId]);
  const room = roomResult.rows[0];
  if (!room) {
    throw new CalendarValidationError('Ruangan jadwal kelas tidak ditemukan.');
  }
  if (room.category !== LAB_ROOM_CATEGORY) {
    throw new CalendarValidationError('Kebutuhan software hanya dapat dipilih untuk ruangan Laboratorium Komputer.');
  }

  const softwareResult = await client.query(
    `SELECT id
     FROM software
     WHERE room_id = $1
       AND id = ANY($2::varchar[])`,
    [roomId, normalizedSoftwareIds]
  );
  const validSoftwareIds = new Set(softwareResult.rows.map((row) => row.id));
  const invalidSoftwareIds = normalizedSoftwareIds.filter((softwareId) => !validSoftwareIds.has(softwareId));
  if (invalidSoftwareIds.length > 0) {
    throw new CalendarValidationError('Software yang dipilih harus terdaftar pada laboratorium yang sama.');
  }

  await client.query('DELETE FROM class_schedule_software WHERE class_schedule_id = $1', [scheduleId]);
  for (const softwareId of normalizedSoftwareIds) {
    await client.query(
      `INSERT INTO class_schedule_software (class_schedule_id, software_id)
       VALUES ($1, $2)
       ON CONFLICT (class_schedule_id, software_id) DO NOTHING`,
      [scheduleId, softwareId]
    );
  }
};

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

router.get('/semester-periods', async (req, res) => {
  try {
    const { semester, academicYear, activeOnly } = req.query;
    const params = [];
    const conditions = [];

    if (semester) {
      params.push(semester);
      conditions.push(`semester = $${params.length}`);
    }
    if (academicYear) {
      params.push(academicYear);
      conditions.push(`academic_year = $${params.length}`);
    }
    if (activeOnly === 'true') {
      conditions.push('is_active = TRUE');
    }

    const result = await pool.query(
      `SELECT *
       FROM semester_periods
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY academic_year DESC,
         CASE semester WHEN 'Ganjil' THEN 1 WHEN 'Genap' THEN 2 WHEN 'Antara' THEN 3 ELSE 4 END`,
      params
    );

    res.json(result.rows.map(mapSemesterPeriodRow));
  } catch (err) {
    console.error('Get semester periods error:', err);
    res.status(500).json({ error: 'Gagal mengambil konfigurasi semester.' });
  }
});

router.post('/semester-periods', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  let payload;
  try {
    payload = normalizeSemesterPeriodPayload(req.body);
  } catch (err) {
    return sendClassScheduleMutationError(res, err, 'Payload konfigurasi semester tidak valid');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = createSemesterPeriodId();
    const result = await client.query(
      `INSERT INTO semester_periods (
         id, semester, academic_year, start_date, end_date, notes, is_active, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (semester, academic_year) DO UPDATE
       SET start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           notes = EXCLUDED.notes,
           is_active = EXCLUDED.is_active,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
       RETURNING *`,
      [
        id,
        payload.semester,
        payload.academicYear,
        payload.startDate,
        payload.endDate,
        payload.notes,
        payload.isActive,
        req.user?.id || null,
      ]
    );

    const syncResult = await syncClassSchedulesForSemesterPeriod(client, payload, req.user?.id);
    await client.query('COMMIT');

    res.status(201).json({
      ...mapSemesterPeriodRow(result.rows[0]),
      ...syncResult,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal menyimpan konfigurasi semester');
  } finally {
    client.release();
  }
});

router.put('/semester-periods/:id', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  let payload;
  try {
    payload = normalizeSemesterPeriodPayload(req.body);
  } catch (err) {
    return sendClassScheduleMutationError(res, err, 'Payload konfigurasi semester tidak valid');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE semester_periods
       SET semester = $1,
           academic_year = $2,
           start_date = $3,
           end_date = $4,
           notes = $5,
           is_active = $6,
           updated_by = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        payload.semester,
        payload.academicYear,
        payload.startDate,
        payload.endDate,
        payload.notes,
        payload.isActive,
        req.user?.id || null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Konfigurasi semester tidak ditemukan.' });
    }

    const syncResult = await syncClassSchedulesForSemesterPeriod(client, payload, req.user?.id);
    await client.query('COMMIT');

    res.json({
      ...mapSemesterPeriodRow(result.rows[0]),
      ...syncResult,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal memperbarui konfigurasi semester');
  } finally {
    client.release();
  }
});

router.delete('/semester-periods/:id', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM semester_periods WHERE id = $1 FOR UPDATE', [req.params.id]);
    const period = existing.rows[0];
    if (!period) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Konfigurasi semester tidak ditemukan.' });
    }

    const scheduleCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM class_schedules WHERE semester = $1 AND academic_year = $2',
      [period.semester, period.academic_year]
    );
    const result = await client.query(
      `UPDATE semester_periods
       SET is_active = FALSE,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Konfigurasi semester tidak ditemukan.' });
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      disabled: true,
      affectedSchedules: scheduleCount.rows[0]?.count || 0,
      period: mapSemesterPeriodRow(result.rows[0]),
      message: 'Konfigurasi semester berhasil dinonaktifkan.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete semester period error:', err);
    res.status(500).json({ error: 'Gagal menonaktifkan konfigurasi semester.' });
  } finally {
    client.release();
  }
});

router.get('/semester-lab-usage', async (req, res) => {
  const semester = trimString(req.query.semester);
  const academicYear = trimString(req.query.academicYear);
  const roomId = optionalTrimmedString(req.query.roomId);

  if (!semester || !academicYear) {
    return res.status(422).json({ error: 'Semester dan tahun akademik wajib diisi.' });
  }

  try {
    const params = [semester, academicYear, LAB_ROOM_CATEGORY];
    const roomFilter = roomId ? `AND cs.room_id = $${params.push(roomId)}` : '';
    const result = await pool.query(
      `SELECT
         cs.id,
         cs.course_code,
         cs.course_name,
         cs.class_group,
         cs.day_of_week,
         cs.start_time,
         cs.end_time,
         cs.semester,
         cs.academic_year,
         cs.room_id,
         r.name AS room_name,
         COALESCE(l.nama, cs.lecturer_name) AS lecturer_name,
         COALESCE(json_agg(
           DISTINCT jsonb_build_object(
             'id', s.id,
             'name', s.name,
             'version', s.version,
             'category', s.category,
             'licenseType', s.license_type,
             'vendor', s.vendor
           )
         ) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS software
       FROM class_schedules cs
       JOIN rooms r ON r.id = cs.room_id
       LEFT JOIN lecturer l ON l.id = cs.lecturer_id
       LEFT JOIN class_schedule_software css ON css.class_schedule_id = cs.id
       LEFT JOIN software s ON s.id = css.software_id
       WHERE cs.semester = $1
         AND cs.academic_year = $2
         AND r.category = $3
         ${roomFilter}
       GROUP BY cs.id, r.name, l.nama
       ORDER BY r.name ASC, cs.day_of_week ASC, cs.start_time ASC`,
      params
    );

    res.json(result.rows.map((row) => ({
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
      lecturerName: row.lecturer_name,
      software: row.software || [],
    })));
  } catch (err) {
    console.error('Get semester lab usage error:', err);
    res.status(500).json({ error: 'Gagal mengambil pemakaian software laboratorium.' });
  }
});

// Get All Class Schedules
router.get('/class-schedules', async (req, res) => {
  try {
    const { semester, academicYear, roomId } = req.query;
    
    let query = `
      SELECT
        cs.*,
        r.name as room_name,
        r.category as room_category,
        l.nama as lecturer_name,
        COALESCE(schedule_software.software, '[]'::json) as software
      FROM class_schedules cs
      LEFT JOIN rooms r ON cs.room_id = r.id
      LEFT JOIN lecturer l ON cs.lecturer_id = l.id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'version', s.version,
            'category', s.category,
            'licenseType', s.license_type,
            'vendor', s.vendor,
            'roomId', s.room_id,
            'notes', s.notes
          )
          ORDER BY s.name ASC, s.version ASC
        ) AS software
        FROM class_schedule_software css
        JOIN software s ON s.id = css.software_id
        WHERE css.class_schedule_id = cs.id
      ) schedule_software ON true`;
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
      roomCategory: row.room_category,
      lecturerId: row.lecturer_id,
      lecturerName: row.lecturer_name,
      startDate: row.start_date ? new Date(row.start_date).toLocaleDateString('en-CA') : '',
      endDate: row.end_date ? new Date(row.end_date).toLocaleDateString('en-CA') : '',
      software: row.software || [],
      softwareIds: (row.software || []).map((software) => software.id)
    }));
    
    res.json(schedules);
  } catch (err) {
    console.error('Get class schedules error:', err);
    res.status(500).json({ error: 'Gagal mengambil jadwal kelas.' });
  }
});

// Add New Class Schedule
router.post('/class-schedules', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  let payload;
  try {
    payload = normalizeClassSchedulePayload(req.body);
  } catch (err) {
    return sendClassScheduleMutationError(res, err, 'Payload jadwal kelas tidak valid');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    payload = await applySemesterPeriodDates(client, payload);

    const id = createClassScheduleId();
    const result = await client.query(
      `INSERT INTO class_schedules 
       (id, course_code, course_name, class_group, day_of_week, start_time, end_time, semester, academic_year, room_id, lecturer_id, lecturer_name, start_date, end_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING *`,
      [
        id,
        payload.courseCode,
        payload.courseName,
        payload.classGroup,
        payload.dayOfWeek,
        payload.startTime,
        payload.endTime,
        payload.semester,
        payload.academicYear,
        payload.roomId,
        payload.lecturerId,
        payload.lecturerName,
        payload.startDate,
        payload.endDate
      ]
    );

    await syncClassScheduleSoftware(client, id, payload.roomId, payload.softwareIds);
    const calendarEvents = await syncClassScheduleToCalendar(client, id, req.user?.id);
    await client.query('COMMIT');

    res.status(201).json({
      ...result.rows[0],
      calendarSynced: Boolean(calendarEvents),
      calendarEventId: calendarEvents?.[0]?.eventId || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal menambahkan jadwal kelas');
  } finally {
    client.release();
  }
});

// Update Class Schedule
router.put('/class-schedules/:id', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  const { id } = req.params;
  let payload;
  try {
    payload = normalizeClassSchedulePayload(req.body);
  } catch (err) {
    return sendClassScheduleMutationError(res, err, 'Payload jadwal kelas tidak valid');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    payload = await applySemesterPeriodDates(client, payload);

    const result = await client.query(
      `UPDATE class_schedules 
       SET course_code = $1, course_name = $2, class_group = $3, day_of_week = $4, 
           start_time = $5, end_time = $6, semester = $7, academic_year = $8, 
           room_id = $9, lecturer_id = $10, lecturer_name = $11, start_date = $12, end_date = $13,
           updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [
        payload.courseCode,
        payload.courseName,
        payload.classGroup,
        payload.dayOfWeek,
        payload.startTime,
        payload.endTime,
        payload.semester,
        payload.academicYear,
        payload.roomId,
        payload.lecturerId,
        payload.lecturerName,
        payload.startDate,
        payload.endDate,
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jadwal kelas tidak ditemukan' });
    }

    await syncClassScheduleSoftware(client, id, payload.roomId, payload.softwareIds);
    const calendarEvents = await syncClassScheduleToCalendar(client, id, req.user?.id);
    await client.query('COMMIT');

    res.json({
      ...result.rows[0],
      calendarSynced: Boolean(calendarEvents),
      calendarEventId: calendarEvents?.[0]?.eventId || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal memperbarui jadwal kelas');
  } finally {
    client.release();
  }
});

// Bulk Delete Class Schedules
router.delete('/class-schedules', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  const semester = trimString(req.query.semester);
  const academicYear = trimString(req.query.academicYear);

  if (!semester || !academicYear) {
    return res.status(422).json({ error: 'Semester dan tahun akademik wajib diisi untuk hapus jadwal massal.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schedules = await client.query(
      'SELECT id FROM class_schedules WHERE semester = $1 AND academic_year = $2',
      [semester, academicYear]
    );

    for (const row of schedules.rows) {
      await cancelCalendarEventsForClassSchedule(client, row.id, req.user?.id);
    }

    const result = await client.query(
      'DELETE FROM class_schedules WHERE semester = $1 AND academic_year = $2 RETURNING id',
      [semester, academicYear]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Jadwal kelas berhasil dihapus',
      deletedCount: result.rowCount,
      calendarCancelledCount: schedules.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal menghapus jadwal kelas');
  } finally {
    client.release();
  }
});

// Delete Class Schedule
router.delete('/class-schedules/:id', verifyRole(CLASS_SCHEDULE_MUTATION_ROLES), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('DELETE FROM class_schedules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Jadwal kelas tidak ditemukan' });
    }

    await cancelCalendarEventsForClassSchedule(client, id, req.user?.id);
    await client.query('COMMIT');

    res.json({ success: true, message: 'Jadwal kelas berhasil dihapus' });
  } catch (err) {
    await client.query('ROLLBACK');
    return sendClassScheduleMutationError(res, err, 'Gagal menghapus jadwal kelas');
  } finally {
    client.release();
  }
});

export default router;
