import express from 'express';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
import {
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  getStudyProgramCodeFromNim,
  mapStudyProgramRow
} from '../utils/activeStudentLetter.js';

const router = express.Router();

// Helper untuk mendapatkan __dirname di ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SISTEM UPLOAD VIA HP (QR CODE) ---
// Menggunakan In-Memory Map untuk menyimpan sesi upload sementara.
// (Catatan: Untuk skala enterprise/banyak server, lebih baik gunakan Redis atau Database)
const uploadSessions = new Map();

// 1. Generate Sesi Upload Baru (Dipanggil dari Komputer)
router.post('/upload-session', async (req, res) => {
  const sessionId = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  uploadSessions.set(sessionId, { status: 'pending', fileBase64: null, fileName: null });
  
  // Hapus sesi otomatis setelah 15 menit jika tidak digunakan untuk menghemat memori
  setTimeout(() => uploadSessions.delete(sessionId), 15 * 60 * 1000);
  
  res.json({ success: true, sessionId });
});

// 2. Menerima File dari HP (Dipanggil dari Browser HP)
router.post('/upload-session/:id', async (req, res) => {
  const { id } = req.params;
  const { fileBase64, fileName } = req.body;
  
  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah kadaluarsa' });
  }

  uploadSessions.set(id, { status: 'completed', fileBase64, fileName });
  res.json({ success: true });
});

// 3. Polling Status Sesi (Dipanggil berkala oleh Komputer)
router.get('/upload-session/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan' });
  }

  const sessionData = uploadSessions.get(id);
  res.json({ success: true, data: sessionData });
  
  // Jika sudah 'completed', kita hapus dari memori agar bersih
  if (sessionData.status === 'completed') {
    uploadSessions.delete(id);
  }
});

const TU_ACCESS_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
const TU_ADMIN_ROLES = ['Admin', 'Admin TU'];
const TU_SETTINGS_KEYS = ['tu_dean_signature_base64', 'tu_faculty_stamp_base64', 'tu_current_semester_code'];
const LETTER_TYPE_TO_CLIENT_KEY = {
  'active-student': 'activeStudent',
  observation: 'observation'
};
const LETTER_TYPE_TO_CODE = {
  'active-student': 'S.Ket',
  observation: 'FTI-OBS'
};

const createEmptyLetterAsset = () => ({ imageBase64: '', fileName: '', mimeType: 'image/png' });
const createEmptyLetterBackgrounds = () => ({
  activeStudent: createEmptyLetterAsset(),
  observation: createEmptyLetterAsset()
});

const mapActiveStudentRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  status: row.status,
  transcriptBase64: row.transcript_base64,
  transcriptName: row.transcript_name,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  letterGeneratedAt: row.letter_generated_at,
  birthPlace: row.birth_place,
  birthDate: row.birth_date,
  studyProgramLevel: row.study_program_level,
  studyProgramName: row.study_program_name,
  faculty: row.faculty,
  university: row.university,
  createdAt: row.created_at
});

const mapObservationRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  recipientName: row.recipient_name,
  companyAddress: row.company_address,
  purpose: row.purpose,
  company: row.company,
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  letterGeneratedAt: row.letter_generated_at,
  createdAt: row.created_at
});

const buildLetterAssetsPayload = (rows) => {
  const assets = createEmptyLetterBackgrounds();

  for (const row of rows) {
    const clientKey = LETTER_TYPE_TO_CLIENT_KEY[row.letter_type];
    // The current frontend only uses a single 'background' asset per letter type.
    if (clientKey && row.asset_type === 'background' && assets[clientKey]) {
      assets[clientKey] = {
        imageBase64: row.image_base64 || '',
        fileName: row.file_name || '',
        mimeType: row.mime_type || 'image/png'
      };
    }
  }

  return assets;
};

const getSemesterMeta = (semesterCode) => {
  if (/^\d{4}[123]$/.test(String(semesterCode || ''))) {
    const year = parseInt(String(semesterCode).slice(0, 4), 10);
    const type = String(semesterCode).slice(4);

    if (type === '1') return { semesterName: 'Ganjil', academicYear: `${year}/${year + 1}` };
    if (type === '2') return { semesterName: 'Genap', academicYear: `${year - 1}/${year}` };
    return { semesterName: 'Antara', academicYear: `${year - 1}/${year}` };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  return currentMonth >= 7
    ? { semesterName: 'Ganjil', academicYear: `${currentYear}/${currentYear + 1}` }
    : { semesterName: 'Genap', academicYear: `${currentYear - 1}/${currentYear}` };
};

const getStudyProgramByNim = async (nim, queryable = pool) => {
  const studyProgramCode = getStudyProgramCodeFromNim(nim);
  if (!studyProgramCode) return null;

  const result = await queryable.query(
    'SELECT id, name, level FROM study_programs WHERE id = $1 LIMIT 1',
    [studyProgramCode]
  );

  return mapStudyProgramRow(result.rows[0]);
};

const formatLetterNumber = (type, sequence, date) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${paddedSequence}/FTI/${LETTER_TYPE_TO_CODE[type]}/${paddedMonth}/${date.getFullYear()}`;
};

const upsertSystemSetting = async (client, key, value) => {
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
};

const getTuSettingsPayload = async () => {
  const [settingsResult, assetResult] = await Promise.all([
    pool.query(`SELECT key, value FROM system_settings WHERE key = ANY($1)`, [TU_SETTINGS_KEYS]),
    pool.query(`SELECT letter_type, asset_type, file_name, mime_type, image_base64 FROM tu_letter_assets`)
  ]);

  const settings = settingsResult.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    signatureBase64: settings.tu_dean_signature_base64 || '',
    stampBase64: settings.tu_faculty_stamp_base64 || '',
    currentSemesterCode: settings.tu_current_semester_code || '',
    letterBackgrounds: buildLetterAssetsPayload(assetResult.rows)
  };
};

const saveLetterAssets = async (client, letterBackgrounds) => {
  if (!letterBackgrounds || typeof letterBackgrounds !== 'object') return;

  const assetType = 'background'; // The frontend UI is for a single background image

  for (const [dbLetterType, clientKey] of Object.entries(LETTER_TYPE_TO_CLIENT_KEY)) {
    const asset = letterBackgrounds[clientKey];

    if (asset && asset.imageBase64) {
      await client.query(
        `INSERT INTO tu_letter_assets (letter_type, asset_type, file_name, mime_type, image_base64)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (letter_type, asset_type)
         DO UPDATE SET
           file_name = EXCLUDED.file_name,
           mime_type = EXCLUDED.mime_type,
           image_base64 = EXCLUDED.image_base64,
           updated_at = CURRENT_TIMESTAMP`,
        [dbLetterType, assetType, asset.fileName || '', asset.mimeType || 'image/png', asset.imageBase64]
      );
    } else {
      // If imageBase64 is empty, remove it from the database
      await client.query(
        `DELETE FROM tu_letter_assets WHERE letter_type = $1 AND asset_type = $2`,
        [dbLetterType, assetType]
      );
    }
  }
};

const ensureLetterNumber = async (client, type, requestData) => {
  if (requestData.letter_number) {
    return requestData;
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const lockKey = `tu-letter-${type}-${year}-${month}`;
  const config = letterConfig[type];

  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

  const nextSequenceResult = await client.query(
    `SELECT COALESCE(MAX(letter_sequence), 0) AS last_sequence
     FROM ${config.table}
     WHERE letter_generated_at IS NOT NULL
       AND EXTRACT(MONTH FROM letter_generated_at) = $1
       AND EXTRACT(YEAR FROM letter_generated_at) = $2`,
    [month, year]
  );

  const nextSequence = Number(nextSequenceResult.rows[0]?.last_sequence || 0) + 1;
  const letterNumber = formatLetterNumber(type, nextSequence, now);
  const updateResult = await client.query(
    `UPDATE ${config.table}
     SET letter_number = $1,
         letter_sequence = $2,
         letter_generated_at = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [letterNumber, nextSequence, now, requestData.id]
  );

  return updateResult.rows[0];
};

// --- SISTEM SURAT AKTIF KULIAH ---

router.post('/active-student', async (req, res) => {
  const {
    name,
    nim,
    email,
    birthPlace,
    birthDate,
    faculty,
    university,
    transcriptBase64,
    transcriptName
  } = req.body;

  try {
    const id = `REQ-${Date.now()}`;
    const studyProgram = await getStudyProgramByNim(nim);

    if (!studyProgram) {
      return res.status(400).json({ error: 'Kode program studi dari NIM belum terdaftar di database.' });
    }

    await pool.query(
      `INSERT INTO active_student_requests (
         id,
         name,
         nim,
         email,
         birth_place,
         birth_date,
         study_program_level,
         study_program_name,
         faculty,
         university,
         transcript_base64,
         transcript_name,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')`,
      [
        id,
        name,
        nim,
        email,
        birthPlace || null,
        birthDate || null,
        studyProgram.studyProgramLevel,
        studyProgram.studyProgramName,
        faculty || DEFAULT_FACULTY,
        university || DEFAULT_UNIVERSITY,
        transcriptBase64,
        transcriptName
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Insert active student request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan.' });
  }
});

router.get('/active-student', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM active_student_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapActiveStudentRow) });
  } catch (err) {
    console.error('Get active student requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan.' });
  }
});

router.put('/active-student/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { signatureBase64, stampBase64 } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM active_student_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    const numberedRequest = await ensureLetterNumber(client, 'active-student', existingResult.rows[0]);
    const updateResult = await client.query(
      `UPDATE active_student_requests
       SET status = 'verified',
           signature_base64 = $1,
           stamp_base64 = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [signatureBase64, stampBase64, id]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      letterNumber: numberedRequest.letter_number || updateResult.rows[0]?.letter_number || ''
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan.' });
  } finally {
    client.release();
  }
});

// --- SISTEM SURAT OBSERVASI ---

router.post('/observation-requests', async (req, res) => {
  const {
    name,
    nim,
    email,
    recipientName,
    companyAddress,
    purpose,
    company,
    companyName
  } = req.body;
  try {
    const id = `OBS-${Date.now()}`;
    await pool.query(
      `INSERT INTO observation_requests (id, name, nim, email, recipient_name, company_address, purpose, company, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [id, name, nim, email, recipientName || null, companyAddress || null, purpose || null, company || companyName || null]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Insert observation request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan observasi.' });
  }
});

router.get('/observation-requests', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM observation_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapObservationRow) });
  } catch (err) {
    console.error('Get observation requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan observasi.' });
  }
});

router.put('/observation-requests/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { signatureBase64, stampBase64 } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM observation_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    const numberedRequest = await ensureLetterNumber(client, 'observation', existingResult.rows[0]);
    await client.query(
      `UPDATE observation_requests
       SET status = 'verified',
           signature_base64 = $1,
           stamp_base64 = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [signatureBase64, stampBase64, id]
    );

    await client.query('COMMIT');
    res.json({ success: true, letterNumber: numberedRequest.letter_number || '' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify observation request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan observasi.' });
  } finally {
    client.release();
  }
});

// --- PENGATURAN LAYANAN TU ---

router.get('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    res.json(await getTuSettingsPayload());
  } catch (err) {
    console.error('Get TU settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan TU.' });
  }
});

router.get('/tu/letter-assets', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  try {
    const { letterBackgrounds } = await getTuSettingsPayload();
    res.json({ success: true, letterBackgrounds });
  } catch (err) {
    console.error('Get TU letter assets error:', err);
    res.status(500).json({ error: 'Gagal mengambil asset surat TU.' });
  }
});

router.post('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { signatureBase64, stampBase64, currentSemesterCode, letterBackgrounds } = req.body;

  if (currentSemesterCode && !/^\d{4}[123]$/.test(String(currentSemesterCode))) {
    return res.status(400).json({ error: 'Format semester berjalan tidak valid. Gunakan format seperti 20251, 20252, atau 20253.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await upsertSystemSetting(client, 'tu_dean_signature_base64', signatureBase64 || '');
    await upsertSystemSetting(client, 'tu_faculty_stamp_base64', stampBase64 || '');
    await upsertSystemSetting(client, 'tu_current_semester_code', currentSemesterCode || '');
    await saveLetterAssets(client, letterBackgrounds);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save TU settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan TU.' });
  } finally {
    client.release();
  }
});

// --- SISTEM PENGIRIMAN EMAIL GENERIC ---

const SENDER_NAME = process.env.SENDER_NAME || "Layanan Surat FTI";
const SENDER_EMAIL = process.env.SMTP_USER;

// Konfigurasi Transporter Nodemailer (Dengan Mock Support untuk Development)
let transporter;
const initTransporter = async () => {
  if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
    console.log('🛠️ Menginisialisasi Mock Email Server (Ethereal)...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
};
initTransporter().catch(err => {
  console.error('Gagal menginisialisasi transporter email:', err);
});

// Konfigurasi untuk setiap jenis surat
const letterConfig = {
  'active-student': {
    table: 'active_student_requests',
    template: 'suratAktifKuliahV2.html',
    subject: 'Surat Keterangan Aktif Kuliah',
    pdfFilename: 'Surat_Aktif_Kuliah',
    emailBody: `
      <p>Permohonan Surat Keterangan Aktif Kuliah Anda telah disetujui dan diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.</p>
    `,
    getPlaceholders: async (data, semesterMeta) => {
      const studyProgram = data.study_program_level && data.study_program_name
        ? {
            studyProgramLevel: data.study_program_level,
            studyProgramName: data.study_program_name
          }
        : await getStudyProgramByNim(data.nim);

      return {
        '{{jenjangProgram}}': data.study_program_level || data.studyProgramLevel || studyProgram?.studyProgramLevel || '',
        '{{programStudi}}': data.study_program_name || data.studyProgramName || studyProgram?.studyProgramName || '',
        '{{fakultas}}': data.faculty || DEFAULT_FACULTY,
        '{{universitas}}': data.university || DEFAULT_UNIVERSITY,
        '{{semester}}': semesterMeta.semesterName,
        '{{tahunAkademik}}': semesterMeta.academicYear,
        '{{nomorSurat}}': data.letter_number || '-',
        '{{lampiran}}': '-',
        '{{letterPurpose}}': 'Keterangan Aktif Kuliah'
      };
    }
  },
  'observation': {
    table: 'observation_requests',
    template: 'suratObservasiV2.html',
    subject: 'Surat Pengantar Observasi',
    pdfFilename: 'Surat_Pengantar_Observasi',
    emailBody: `
      <p>Permohonan Surat Pengantar Observasi Anda telah disetujui dan diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.</p>
    `,
    getPlaceholders: (data) => ({
      '{{recipientName}}': data.recipient_name || data.recipientName || '(tidak disebutkan)',
      '{{companyAddress}}': data.company_address || data.companyAddress || '(tidak disebutkan)',
      '{{purpose}}': data.purpose || '(tidak disebutkan)',
      '{{company}}': data.company || '(tidak disebutkan)',
      '{{nomorSurat}}': data.letter_number || '-',
      '{{lampiran}}': '-',
      '{{letterPurpose}}': 'Pengantar Observasi'
    })
  }
};

// 7. Endpoint Kirim Email Generik
router.post('/tu/requests/:type/:id/send-email', verifyRole(['Admin', 'Admin TU']), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];

  if (!config) {
    return res.status(400).json({ error: 'Jenis surat tidak valid.' });
  }

  try {
    // 1. Ambil data pengajuan dari tabel yang sesuai
    const result = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }
    const requestData = result.rows[0];
    const tuSettings = await getTuSettingsPayload();
    const semesterMeta = getSemesterMeta(tuSettings.currentSemesterCode);

    // 2. Baca template HTML dari file
    const templatePath = path.join(__dirname, '..', 'templates', 'email', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    // 3. Ganti placeholder umum
    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
    htmlContent = htmlContent.replace(/{{name}}/g, requestData.name)
                             .replace(/{{nim}}/g, requestData.nim)
                             .replace(/{{tanggalSurat}}/g, tanggalSurat)
                             .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
                             .replace(/{{stampImage}}/g, requestData.stamp_base64 || '');

    // 4. Ganti placeholder spesifik per jenis surat
    const specificPlaceholders = await config.getPlaceholders(requestData, semesterMeta);
    for (const key in specificPlaceholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), specificPlaceholders[key]);
    }

    // 5. Render HTML menjadi Buffer PDF dengan Puppeteer
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '25mm', right: '25mm', bottom: '25mm', left: '25mm' }
    });
    await browser.close();

    // 6. Konfigurasi Email
    const mailOptions = {
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: requestData.email,
      subject: `${config.subject} - ${requestData.name}`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Halo, ${requestData.name} (${requestData.nim})</h2>
          ${config.emailBody}
          <br/>
          <p>Salam,<br/><strong>Bagian Tata Usaha<br/>Fakultas Teknologi Informasi UKSW</strong></p>
        </div>
      `,
      // 7. Melampirkan Buffer PDF ke Nodemailer
      attachments: [
        {
          filename: `${(requestData.letter_number || config.pdfFilename).replace(/\//g, '_')}_${requestData.nim}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    // 8. Kirim Email
    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
      console.log('📧 Mock Email berhasil ditangkap oleh Ethereal!');
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    // 9. Update status di tabel yang sesuai
    await pool.query(`UPDATE ${config.table} SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Email berhasil dikirim' });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email. Pastikan konfigurasi SMTP di .env sudah benar.' });
  }
});

// 8. Endpoint Ringkasan TU (Untuk Dashboard)
router.get('/active-student/summary', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    const result = await pool.query(`SELECT status, COUNT(*) as count FROM active_student_requests GROUP BY status`);
    
    const summary = {
      pending: 0,
      verified: 0,
      sent: 0,
      total: 0
    };
    
    result.rows.forEach(row => {
      if (row.status === 'pending') summary.pending = parseInt(row.count, 10);
      if (row.status === 'verified') summary.verified = parseInt(row.count, 10);
      if (row.status === 'sent') summary.sent = parseInt(row.count, 10);
      summary.total += parseInt(row.count, 10);
    });
    
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Get TU summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil data ringkasan TU.' });
  }
});

export default router;
