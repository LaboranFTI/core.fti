import express from 'express';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
import {
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  deriveStudyProgramFromNim,
  formatStudentName
} from '../utils/activeStudentLetter.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadSessions = new Map();
const qrDownloadSessions = new Map();

const TU_ACCESS_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
const TU_ADMIN_ROLES = ['Admin', 'Admin TU'];
const TU_SUBMIT_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
const TU_SETTINGS_KEYS = ['tu_dean_signature_base64', 'tu_faculty_stamp_base64', 'tu_current_semester_code'];
const QR_DOWNLOAD_TOKEN_TTL_HOURS = 24;
const LETTER_TYPE_TO_CLIENT_KEY = {
  'active-student': 'activeStudent',
  observation: 'observation'
};
const LETTER_TYPE_TO_CODE = {
  'active-student': 'S.Ket',
  observation: 'FTI-OBS'
};

const createQrDownloadToken = () => crypto.randomBytes(32).toString('base64url');
const hashQrDownloadToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const getQrDownloadExpiry = () => new Date(Date.now() + QR_DOWNLOAD_TOKEN_TTL_HOURS * 60 * 60 * 1000);

const createEmptyLetterBackgrounds = () => ({
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const DEFAULT_LETTER_LAYOUT_MM = Object.freeze({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

const createEmptyLetterLayouts = () => ({
  activeStudent: { ...DEFAULT_LETTER_LAYOUT_MM.activeStudent },
  observation: { ...DEFAULT_LETTER_LAYOUT_MM.observation }
});

const clampMarginMm = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(80, Math.max(0, Number(parsed.toFixed(2))));
};

const normalizeLetterLayout = (layout, fallback) => ({
  marginTopMm: clampMarginMm(layout?.marginTopMm, fallback.marginTopMm),
  marginRightMm: clampMarginMm(layout?.marginRightMm, fallback.marginRightMm),
  marginBottomMm: clampMarginMm(layout?.marginBottomMm, fallback.marginBottomMm),
  marginLeftMm: clampMarginMm(layout?.marginLeftMm, fallback.marginLeftMm)
});

let tuInfrastructurePromise = null;

const ensureTuInfrastructure = async () => {
  if (tuInfrastructurePromise) {
    return tuInfrastructurePromise;
  }

  tuInfrastructurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_student_requests (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        birth_place VARCHAR(100),
        birth_date VARCHAR(30),
        study_program_level VARCHAR(100),
        study_program_name VARCHAR(255),
        faculty VARCHAR(255),
        university VARCHAR(255),
        transcript_base64 TEXT,
        transcript_name VARCHAR(255),
        signature_base64 TEXT,
        stamp_base64 TEXT,
        letter_number VARCHAR(100),
        letter_sequence INTEGER,
        letter_generated_at TIMESTAMP,
        qr_download_token_hash VARCHAR(64),
        qr_download_token_expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE active_student_requests
      ADD COLUMN IF NOT EXISTS transcript_base64 TEXT,
      ADD COLUMN IF NOT EXISTS transcript_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS birth_place VARCHAR(100),
      ADD COLUMN IF NOT EXISTS birth_date VARCHAR(30),
      ADD COLUMN IF NOT EXISTS study_program_level VARCHAR(100),
      ADD COLUMN IF NOT EXISTS study_program_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS faculty VARCHAR(255),
      ADD COLUMN IF NOT EXISTS university VARCHAR(255),
      ADD COLUMN IF NOT EXISTS signature_base64 TEXT,
      ADD COLUMN IF NOT EXISTS stamp_base64 TEXT,
      ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
      ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS observation_requests (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        recipient_name VARCHAR(255),
        company_address TEXT,
        purpose TEXT,
        company VARCHAR(255),
        course_name VARCHAR(255),
        lecturer_name VARCHAR(255),
        head_of_program_name VARCHAR(255),
        study_program_level VARCHAR(100),
        study_program_name VARCHAR(255),
        student_members JSONB NOT NULL DEFAULT '[]'::jsonb,
        signature_base64 TEXT,
        stamp_base64 TEXT,
        letter_number VARCHAR(100),
        letter_sequence INTEGER,
        letter_generated_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE observation_requests
      ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS company_address TEXT,
      ADD COLUMN IF NOT EXISTS purpose TEXT,
      ADD COLUMN IF NOT EXISTS company VARCHAR(255),
      ADD COLUMN IF NOT EXISTS course_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lecturer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS head_of_program_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS study_program_level VARCHAR(100),
      ADD COLUMN IF NOT EXISTS study_program_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS student_members JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS signature_base64 TEXT,
      ADD COLUMN IF NOT EXISTS stamp_base64 TEXT,
      ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
      ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_backgrounds (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
        file_name VARCHAR(255),
        mime_type VARCHAR(100) DEFAULT 'image/png',
        image_base64 TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(letter_type)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_number_counters (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        last_sequence INTEGER NOT NULL DEFAULT 0,
        last_letter_number VARCHAR(100),
        last_generated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(letter_type, year, month)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_layouts (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation')),
        margin_top_mm NUMERIC(6,2) NOT NULL DEFAULT 40,
        margin_right_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
        margin_bottom_mm NUMERIC(6,2) NOT NULL DEFAULT 26,
        margin_left_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(letter_type)
      )
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_student_requests_letter_number_unique
      ON active_student_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_letter_number_unique
      ON observation_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_requests_qr_download_token_hash
      ON observation_requests(qr_download_token_hash)
      WHERE qr_download_token_hash IS NOT NULL
    `);

    await pool.query(`
      INSERT INTO system_settings (key, value) VALUES
        ('tu_dean_signature_base64', ''),
        ('tu_faculty_stamp_base64', ''),
        ('tu_current_semester_code', '')
      ON CONFLICT (key) DO NOTHING
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_active_student_requests_updated_at'
        ) THEN
          CREATE TRIGGER update_active_student_requests_updated_at
          BEFORE UPDATE ON active_student_requests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_observation_requests_updated_at'
        ) THEN
          CREATE TRIGGER update_observation_requests_updated_at
          BEFORE UPDATE ON observation_requests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_tu_letter_backgrounds_updated_at'
        ) THEN
          CREATE TRIGGER update_tu_letter_backgrounds_updated_at
          BEFORE UPDATE ON tu_letter_backgrounds
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_tu_letter_number_counters_updated_at'
        ) THEN
          CREATE TRIGGER update_tu_letter_number_counters_updated_at
          BEFORE UPDATE ON tu_letter_number_counters
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_tu_letter_layouts_updated_at'
        ) THEN
          CREATE TRIGGER update_tu_letter_layouts_updated_at
          BEFORE UPDATE ON tu_letter_layouts
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);
  })().catch((err) => {
    tuInfrastructurePromise = null;
    throw err;
  });

  return tuInfrastructurePromise;
};

const mapActiveStudentRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  status: row.status,
  birthPlace: row.birth_place,
  birthDate: row.birth_date,
  studyProgramLevel: row.study_program_level,
  studyProgramName: row.study_program_name,
  faculty: row.faculty,
  university: row.university,
  transcriptBase64: row.transcript_base64,
  transcriptName: row.transcript_name,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  letterGeneratedAt: row.letter_generated_at,
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
  courseName: row.course_name,
  lecturerName: row.lecturer_name,
  headOfProgramName: row.head_of_program_name,
  students: normalizeObservationStudents(row.student_members),
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  letterGeneratedAt: row.letter_generated_at,
  createdAt: row.created_at
});

const buildLetterBackgroundsPayload = (rows) => {
  const backgrounds = createEmptyLetterBackgrounds();

  for (const row of rows) {
    const clientKey = LETTER_TYPE_TO_CLIENT_KEY[row.letter_type];
    if (!clientKey) continue;

    backgrounds[clientKey] = {
      imageBase64: row.image_base64 || '',
      fileName: row.file_name || '',
      mimeType: row.mime_type || 'image/png'
    };
  }

  return backgrounds;
};

const buildLetterLayoutsPayload = (rows) => {
  const layouts = createEmptyLetterLayouts();

  for (const row of rows) {
    const clientKey = LETTER_TYPE_TO_CLIENT_KEY[row.letter_type];
    if (!clientKey) continue;

    layouts[clientKey] = normalizeLetterLayout({
      marginTopMm: row.margin_top_mm,
      marginRightMm: row.margin_right_mm,
      marginBottomMm: row.margin_bottom_mm,
      marginLeftMm: row.margin_left_mm
    }, DEFAULT_LETTER_LAYOUT_MM[clientKey]);
  }

  return layouts;
};

const normalizeObservationStudents = (students) => {
  if (!Array.isArray(students)) return [];

  return students
    .map((student) => ({
      name: String(student?.name || '').trim(),
      nim: String(student?.nim || '').trim()
    }))
    .filter((student) => student.name || student.nim);
};

const buildObservationStudentRowsHtml = (students) => {
  const normalizedStudents = normalizeObservationStudents(students);

  if (normalizedStudents.length === 0) {
    return `
      <tr>
        <td colspan="2" style="font-style: italic; color: gray; padding-top: 0.8mm; padding-bottom: 0.8mm;">Data mahasiswa belum ditambahkan</td>
      </tr>
    `;
  }

  return normalizedStudents
    .map((student) => `
      <tr>
        <td style="padding-top: 0.8mm; padding-bottom: 0.8mm;">${student.name || '-'}</td>
        <td style="padding-top: 0.8mm; padding-bottom: 0.8mm;">${student.nim || '-'}</td>
      </tr>
    `)
    .join('');
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

const formatLetterNumber = (type, sequence, date) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${paddedSequence}/${LETTER_TYPE_TO_CODE[type]}/${paddedMonth}/${date.getFullYear()}`;
};

const reserveLetterNumber = async (client, type, date) => {
  await ensureTuInfrastructure();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await client.query(
    `INSERT INTO tu_letter_number_counters (letter_type, year, month, last_sequence)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (letter_type, year, month) DO NOTHING`,
    [type, year, month]
  );

  const counterResult = await client.query(
    `SELECT last_sequence
     FROM tu_letter_number_counters
     WHERE letter_type = $1 AND year = $2 AND month = $3
     FOR UPDATE`,
    [type, year, month]
  );

  const nextSequence = Number(counterResult.rows[0]?.last_sequence || 0) + 1;
  const letterNumber = formatLetterNumber(type, nextSequence, date);

  await client.query(
    `UPDATE tu_letter_number_counters
     SET last_sequence = $4,
         last_letter_number = $5,
         last_generated_at = $6,
         updated_at = CURRENT_TIMESTAMP
     WHERE letter_type = $1 AND year = $2 AND month = $3`,
    [type, year, month, nextSequence, letterNumber, date]
  );

  return { nextSequence, letterNumber };
};

const upsertSystemSetting = async (client, key, value) => {
  await client.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
};

const getTuSettingsPayload = async () => {
  await ensureTuInfrastructure();
  const [settingsResult, assetResult, layoutResult] = await Promise.all([
    pool.query(`SELECT key, value FROM system_settings WHERE key = ANY($1)`, [TU_SETTINGS_KEYS]),
    pool.query(`SELECT letter_type, file_name, mime_type, image_base64 FROM tu_letter_backgrounds`),
    pool.query(`SELECT letter_type, margin_top_mm, margin_right_mm, margin_bottom_mm, margin_left_mm FROM tu_letter_layouts`)
  ]);

  const settings = settingsResult.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return {
    signatureBase64: settings.tu_dean_signature_base64 || '',
    stampBase64: settings.tu_faculty_stamp_base64 || '',
    currentSemesterCode: settings.tu_current_semester_code || '',
    letterBackgrounds: buildLetterBackgroundsPayload(assetResult.rows),
    letterLayouts: buildLetterLayoutsPayload(layoutResult.rows)
  };
};

const saveLetterBackgrounds = async (client, letterBackgrounds) => {
  await ensureTuInfrastructure();
  if (!letterBackgrounds || typeof letterBackgrounds !== 'object') return;

  for (const [letterType, clientKey] of Object.entries(LETTER_TYPE_TO_CLIENT_KEY)) {
    const asset = letterBackgrounds[clientKey];
    if (!asset || typeof asset !== 'object') continue;

    if (asset.imageBase64) {
      await client.query(
        `INSERT INTO tu_letter_backgrounds (letter_type, file_name, mime_type, image_base64)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (letter_type)
         DO UPDATE SET
           file_name = EXCLUDED.file_name,
           mime_type = EXCLUDED.mime_type,
           image_base64 = EXCLUDED.image_base64,
           updated_at = CURRENT_TIMESTAMP`,
        [letterType, asset.fileName || '', asset.mimeType || 'image/png', asset.imageBase64]
      );
    } else {
      await client.query(
        `DELETE FROM tu_letter_backgrounds WHERE letter_type = $1`,
        [letterType]
      );
    }
  }
};

const saveLetterLayouts = async (client, letterLayouts) => {
  await ensureTuInfrastructure();

  for (const [letterType, clientKey] of Object.entries(LETTER_TYPE_TO_CLIENT_KEY)) {
    const fallback = DEFAULT_LETTER_LAYOUT_MM[clientKey];
    const layout = normalizeLetterLayout(letterLayouts?.[clientKey], fallback);

    await client.query(
      `INSERT INTO tu_letter_layouts (
         letter_type,
         margin_top_mm,
         margin_right_mm,
         margin_bottom_mm,
         margin_left_mm
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (letter_type)
      DO UPDATE SET
         margin_top_mm = EXCLUDED.margin_top_mm,
         margin_right_mm = EXCLUDED.margin_right_mm,
         margin_bottom_mm = EXCLUDED.margin_bottom_mm,
         margin_left_mm = EXCLUDED.margin_left_mm,
         updated_at = CURRENT_TIMESTAMP`,
      [
        letterType,
        layout.marginTopMm,
        layout.marginRightMm,
        layout.marginBottomMm,
        layout.marginLeftMm
      ]
    );
  }
};

// Helper: Generate PDF Buffer menggunakan Puppeteer
const generatePdfBuffer = async (htmlContent) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  return pdfBuffer;
};

let transporter;
const initTransporter = async () => {
  // Prioritaskan EMAIL_* (konfigurasi baru) → fallback ke SMTP_* (lama)
  const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
  const emailTls = process.env.EMAIL_TLS !== 'false'; // true by default

  if (!emailHost || !emailUser || !emailPass) {
    console.warn('[Mailer] ⚠ Konfigurasi EMAIL tidak lengkap di .env. Menggunakan Mock Server (Ethereal).');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    return;
  }

  transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,   // port 465 = SSL, 587 = STARTTLS
    requireTLS: emailPort !== 465 && emailTls,
    name: process.env.EMAIL_HOSTNAME || emailHost, // Fix HELO/EHLO A Record warning
    auth: { user: emailUser, pass: emailPass }
  });
  console.log(`[Mailer] Transporter siap → ${emailHost}:${emailPort} (user: ${emailUser})`);
};
initTransporter().catch(err => {
  console.error('[Mailer] Gagal menginisialisasi transporter email:', err);
});

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
    getPlaceholders: async ({ data, letterNumber, semesterMeta }) => {
      let deanName = 'Prof. Ir. Daniel H.F. Manongga, M.Sc., Ph.D.';
      let deanTitle = 'Dekan';

      try {
        const deanResult = await pool.query("SELECT nama, jabatan FROM lecturer WHERE jabatan ILIKE 'Dekan%' LIMIT 1");
        if (deanResult.rows.length > 0) {
          deanName = deanResult.rows[0].nama;
          deanTitle = deanResult.rows[0].jabatan;
        }
      } catch (e) {
        console.error('Failed to fetch Dean data:', e);
      }

      return {
        '{{tempatTanggalLahir}}': buildBirthPlaceAndDate(data.birth_place || data.birthPlace, data.birth_date || data.birthDate),
        '{{jenjangProgram}}': data.study_program_level || data.studyProgramLevel || deriveStudyProgramFromNim(data.nim)?.studyProgramLevel || '',
        '{{programStudi}}': data.study_program_name || data.studyProgramName || deriveStudyProgramFromNim(data.nim)?.studyProgramName || '',
        '{{fakultas}}': data.faculty || data.facultyName || DEFAULT_FACULTY,
        '{{universitas}}': data.university || DEFAULT_UNIVERSITY,
        '{{semester}}': semesterMeta.semesterName,
        '{{tahunAkademik}}': semesterMeta.academicYear,
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Permohonan Surat Aktif Kuliah',
        '{{lampiran}}': '1 lembar',
        '{{deanName}}': deanName,
        '{{deanTitle}}': deanTitle
      };
    }
  },
  observation: {
    table: 'observation_requests',
    template: 'suratObservasiV2.html',
    subject: 'Surat Pengantar Observasi',
    pdfFilename: 'Surat_Pengantar_Observasi',
    emailBody: `
      <p>Permohonan Surat Pengantar Observasi Anda telah diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF.</p>
    `,
    getPlaceholders: ({ data, letterNumber }) => {
      const derivedProdi = deriveStudyProgramFromNim(data.nim);
      const level = data.study_program_level || derivedProdi?.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        'Sarjana': 'S1',
        'Magister': 'S2',
        'Doktor': 'S3'
      };

      const tanggalSurat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Pengantar Observasi',
        '{{lampiran}}': '-',
        '{{recipientName}}': data.recipient_name || data.recipientName || '(tidak disebutkan)',
        '{{companyAddress}}': data.company_address || data.companyAddress || '(tidak disebutkan)',
        '{{purpose}}': data.purpose || '(tidak disebutkan)',
        '{{company}}': data.company || '(tidak disebutkan)',
        '{{courseName}}': data.course_name || data.courseName || '(tidak disebutkan)',
        '{{lecturerName}}': data.lecturer_name || data.lecturerName || '(tidak disebutkan)',
        '{{headOfProgramName}}': data.head_of_program_name || data.headOfProgramName || '(tidak disebutkan)',
        '{{jenjangProgram}}': map[level] || level,
        '{{programStudi}}': data.study_program_name || derivedProdi?.studyProgramName || 'Teknik Informatika',
        '{{studentRows}}': buildObservationStudentRowsHtml(data.student_members || data.students),
        '{{tanggalSurat}}': tanggalSurat
      };
    }
  }
};

const ensureLetterNumber = async (client, type, requestData) => {
  if (requestData.letter_number) {
    return requestData;
  }

  const now = new Date();
  const config = letterConfig[type];
  const { nextSequence, letterNumber } = await reserveLetterNumber(client, type, now);
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

const upsertObservationRequest = async (client, data, targetStatus) => {
  const recentDuplicate = await client.query(
    `SELECT * FROM observation_requests 
     WHERE nim = $1 
       AND company IS NOT DISTINCT FROM $2 
       AND course_name IS NOT DISTINCT FROM $3 
       AND created_at > NOW() - INTERVAL '1 day'
     ORDER BY created_at DESC LIMIT 1`,
    [data.nim, data.company, data.course_name]
  );

  if (recentDuplicate.rows.length > 0) {
    const existing = recentDuplicate.rows[0];
    const statusPriority = { 'pending': 1, 'verified': 2, 'sent': 3 };
    const currentStatusLevel = statusPriority[existing.status] || 0;
    const targetStatusLevel = statusPriority[targetStatus] || 0;
    const newStatus = targetStatusLevel > currentStatusLevel ? targetStatus : existing.status;

    const updateResult = await client.query(
      `UPDATE observation_requests SET 
         name = $1, email = $2, recipient_name = $3, company_address = $4,
         purpose = $5, lecturer_name = $6, head_of_program_name = $7, study_program_level = $8,
         study_program_name = $9, student_members = $10::jsonb, status = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 RETURNING *`,
      [
        data.name, data.email, data.recipient_name, data.company_address, data.purpose || null,
        data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), newStatus, 
        existing.id
      ]
    );
    return updateResult.rows[0];
  } else {
    const id = `OBS-${Date.now()}`;
    const insertResult = await client.query(
      `INSERT INTO observation_requests (
          id, name, nim, email, recipient_name, company_address, company,
          purpose, course_name, lecturer_name, head_of_program_name, study_program_level, study_program_name, student_members, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      RETURNING *`,
      [
        id, data.name, data.nim, data.email, data.recipient_name, data.company_address, data.company, 
        data.purpose || null, data.course_name, data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), targetStatus
      ]
    );
    return insertResult.rows[0];
  }
};

router.get('/tu/letter-numbering', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT letter_type, year, month, last_sequence, last_letter_number, last_generated_at, updated_at
       FROM tu_letter_number_counters
       ORDER BY year DESC, month DESC, letter_type ASC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get TU letter numbering error:', err);
    res.status(500).json({ error: 'Gagal mengambil data nomor surat TU.' });
  }
});

router.post('/upload-session', async (req, res) => {
  const sessionId = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  uploadSessions.set(sessionId, { status: 'pending', fileBase64: null, fileName: null });
  setTimeout(() => uploadSessions.delete(sessionId), 15 * 60 * 1000);
  res.json({ success: true, sessionId });
});

router.post('/upload-session/:id', async (req, res) => {
  const { id } = req.params;
  const { fileBase64, fileName } = req.body;

  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah kadaluarsa' });
  }

  uploadSessions.set(id, { status: 'completed', fileBase64, fileName });
  res.json({ success: true });
});

router.get('/upload-session/:id', async (req, res) => {
  const { id } = req.params;

  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan' });
  }

  const sessionData = uploadSessions.get(id);
  res.json({ success: true, data: sessionData });

  if (sessionData.status === 'completed') {
    uploadSessions.delete(id);
  }
});

router.post('/active-student', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    name,
    nim,
    email,
    birthPlace,
    birthDate,
    studyProgramLevel,
    studyProgramName,
    faculty,
    university,
    transcriptBase64,
    transcriptName
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const id = `REQ-${Date.now()}`;
    const derivedStudyProgram = deriveStudyProgramFromNim(nim);

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
        formatStudentName(name),
        nim,
        email,
        birthPlace || null,
        birthDate || null,
        studyProgramLevel || derivedStudyProgram?.studyProgramLevel || null,
        studyProgramName || derivedStudyProgram?.studyProgramName || null,
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

router.delete('/tu/requests/active-student/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM active_student_requests WHERE id = $1 RETURNING id, name, nim, letter_generated_at`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await pool.query(
        `UPDATE tu_letter_number_counters
         SET last_sequence = GREATEST(last_sequence - 1, 0)
         WHERE letter_type = 'active-student' AND year = $1 AND month = $2`,
        [date.getFullYear(), date.getMonth() + 1]
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete active student error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengajuan.' });
  }
});

// Batch hapus surat aktif kuliah
router.post('/tu/requests/active-student/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM active_student_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );
    
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        await pool.query(
          `UPDATE tu_letter_number_counters
           SET last_sequence = GREATEST(last_sequence - 1, 0)
           WHERE letter_type = 'active-student' AND year = $1 AND month = $2`,
          [date.getFullYear(), date.getMonth() + 1]
        );
      }
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete active student error:', err);
    res.status(500).json({ error: 'Gagal menghapus data secara batch.' });
  }
});

router.get('/active-student', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
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
    await ensureTuInfrastructure();
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

router.post('/observation-requests', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    name,
    nim,
    email,
    recipientName,
    companyAddress,
    purpose,
    company,
    companyName,
    courseName,
    lecturerName,
    headOfProgramName,
    students
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const fallbackId = `OBS-${Date.now()}`;
    const normalizedStudents = normalizeObservationStudents(students);
    const primaryStudent = normalizedStudents[0] || { name: '', nim: '' };
    const resolvedName = formatStudentName(name || primaryStudent.name || 'Mahasiswa Observasi');
    const resolvedNim = String(nim || primaryStudent.nim || fallbackId).trim();
    const resolvedEmail = String(email || req.user?.email || '').trim() || 'arsip-observasi@core.fti';
    
    const client = await pool.connect();
    try {
      const requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        purpose: purpose || null,
        company: company || companyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: null,
        study_program_name: null,
        student_members: normalizedStudents
      }, 'pending');
      res.json({ success: true, id: requestData.id });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Insert observation request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan observasi.' });
  }
});

router.get('/observation-requests', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
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
    await ensureTuInfrastructure();
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

// Edit data surat observasi (hanya field konten, tidak ubah nomor surat dan status)
router.patch('/tu/requests/observation/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const {
    recipientName,
    company,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM observation_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Pengajuan observasi tidak ditemukan.' });

    const resolvedCompany = company || companyName || null;
    const normalizedStudents = students ? normalizeObservationStudents(students) : undefined;

    const updateResult = await pool.query(
      `UPDATE observation_requests
       SET recipient_name       = COALESCE($1, recipient_name),
           company              = COALESCE($2, company),
           company_address      = COALESCE($3, company_address),
           course_name          = COALESCE($4, course_name),
           lecturer_name        = COALESCE($5, lecturer_name),
           head_of_program_name = COALESCE($6, head_of_program_name),
           student_members      = COALESCE($7::jsonb, student_members),
           updated_at           = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        recipientName ?? null,
        resolvedCompany,
        companyAddress ?? null,
        courseName ?? null,
        lecturerName ?? null,
        headOfProgramName ?? null,
        normalizedStudents ? JSON.stringify(normalizedStudents) : null,
        id
      ]
    );

    res.json({ success: true, data: mapObservationRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch observation request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data surat observasi.' });
  }
});

// Hapus satu surat observasi
router.delete('/tu/requests/observation/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM observation_requests WHERE id = $1 RETURNING id, name, nim, company, letter_generated_at`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await pool.query(
        `UPDATE tu_letter_number_counters
         SET last_sequence = GREATEST(last_sequence - 1, 0)
         WHERE letter_type = 'observation' AND year = $1 AND month = $2`,
        [date.getFullYear(), date.getMonth() + 1]
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete observation error:', err);
    res.status(500).json({ error: 'Gagal menghapus surat observasi.' });
  }
});

// Batch hapus surat observasi
router.post('/tu/requests/observation/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM observation_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, company, letter_generated_at`,
      [ids]
    );
    
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        await pool.query(
          `UPDATE tu_letter_number_counters
           SET last_sequence = GREATEST(last_sequence - 1, 0)
           WHERE letter_type = 'observation' AND year = $1 AND month = $2`,
          [date.getFullYear(), date.getMonth() + 1]
        );
      }
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete observation error:', err);
    res.status(500).json({ error: 'Gagal menghapus data observasi secara batch.' });
  }
});

router.get('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    res.json(await getTuSettingsPayload());
  } catch (err) {
    console.error('Get TU settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan TU.' });
  }
});

router.get('/tu/letter-backgrounds', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  try {
    const { letterBackgrounds, letterLayouts } = await getTuSettingsPayload();
    res.json({ success: true, letterBackgrounds, letterLayouts });
  } catch (err) {
    console.error('Get TU letter backgrounds error:', err);
    res.status(500).json({ error: 'Gagal mengambil background surat TU.' });
  }
});

router.post('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { signatureBase64, stampBase64, currentSemesterCode, letterBackgrounds, letterLayouts } = req.body;

  if (currentSemesterCode && !/^\d{4}[123]$/.test(String(currentSemesterCode))) {
    return res.status(400).json({ error: 'Format semester berjalan tidak valid. Gunakan format seperti 20251, 20252, atau 20253.' });
  }

  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    await upsertSystemSetting(client, 'tu_dean_signature_base64', signatureBase64 || '');
    await upsertSystemSetting(client, 'tu_faculty_stamp_base64', stampBase64 || '');
    await upsertSystemSetting(client, 'tu_current_semester_code', currentSemesterCode || '');
    await saveLetterBackgrounds(client, letterBackgrounds);
    await saveLetterLayouts(client, letterLayouts);
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

router.post('/tu/requests/:type/:id/send-email', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];

  if (!config) {
    return res.status(400).json({ error: 'Jenis surat tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const client = await pool.connect();
    let requestData;

    try {
      await client.query('BEGIN');
      const result = await client.query(`SELECT * FROM ${config.table} WHERE id = $1 FOR UPDATE`, [id]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
      }

      requestData = await ensureLetterNumber(client, type, result.rows[0]);
      await client.query('COMMIT');
      client.release();
    } catch (txErr) {
      await client.query('ROLLBACK');
      client.release();
      throw txErr;
    }

    const tuSettings = await getTuSettingsPayload();
    const semesterMeta = getSemesterMeta(tuSettings.currentSemesterCode);
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY[type];
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(
      tuSettings.letterLayouts?.[assetKey],
      DEFAULT_LETTER_LAYOUT_MM[assetKey]
    );
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    htmlContent = htmlContent.replace(/{{name}}/g, requestData.name || '')
      .replace(/{{nim}}/g, requestData.nim || '')
      .replace(/{{tanggalSurat}}/g, tanggalSurat)
      .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
      .replace(/{{stampImage}}/g, requestData.stamp_base64 || '')
      .replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const specificPlaceholders = await config.getPlaceholders({
      data: requestData,
      letterNumber: requestData.letter_number,
      semesterMeta
    });

    for (const key in specificPlaceholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), specificPlaceholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);

    const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME;
    const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
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
      attachments: [
        {
          filename: `${(requestData.letter_number || config.pdfFilename).replace(/\//g, '_')}_${requestData.nim}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
      list: {
        unsubscribe: {
          url: `mailto:${fromEmail}?subject=unsubscribe`,
          comment: 'Unsubscribe'
        }
      }
    };

    const info = await transporter.sendMail(mailOptions);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Mailer] Mock Email Preview (Ethereal):', previewUrl);
    } else {
      console.log(`[Mailer] ✅ Email terkirim ke ${requestData.email} | MessageID: ${info.messageId}`);
    }

    await pool.query(`UPDATE ${config.table} SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

    res.json({ success: true, message: 'Email berhasil dikirim', letterNumber: requestData.letter_number });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email. Pastikan konfigurasi SMTP di .env sudah benar.' });
  }
});

router.post('/tu/observation-letter/finalize', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);

    await client.query('COMMIT');

    res.json({ success: true, letterNumber: requestData.letter_number });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Observation letter finalize error:', err);
    res.status(500).json({ error: 'Gagal memfinalisasi surat observasi.' });
  } finally {
    client.release();
  }
});

router.post('/tu/observation-letter/generate-and-download', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);

    const config = letterConfig.observation;
    const tuSettings = await getTuSettingsPayload();
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY.observation;
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    htmlContent = htmlContent.replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const placeholders = config.getPlaceholders({
      data: requestData,
      letterNumber: requestData.letter_number,
    });

    for (const key in placeholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), placeholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Observation letter download & archive error:', err);
    res.status(500).json({ error: 'Gagal membuat dan mengunduh PDF surat observasi.' });
  } finally {
    client.release();
  }
});

router.post('/tu/observation-letter/generate-qr-link', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);
    const qrDownloadToken = createQrDownloadToken();
    const qrDownloadTokenHash = hashQrDownloadToken(qrDownloadToken);
    const qrDownloadTokenExpiresAt = getQrDownloadExpiry();

    requestData = (await client.query(
      `UPDATE observation_requests
       SET qr_download_token_hash = $1,
           qr_download_token_expires_at = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [qrDownloadTokenHash, qrDownloadTokenExpiresAt, requestData.id]
    )).rows[0];

    const config = letterConfig.observation;
    const tuSettings = await getTuSettingsPayload();
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY.observation;
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    htmlContent = htmlContent.replace(/{{name}}/g, requestData.name || '')
      .replace(/{{nim}}/g, requestData.nim || '')
      .replace(/{{tanggalSurat}}/g, tanggalSurat)
      .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
      .replace(/{{stampImage}}/g, requestData.stamp_base64 || '')
      .replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const placeholders = config.getPlaceholders({
      data: requestData,
      letterNumber: requestData.letter_number,
    });

    for (const key in placeholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), placeholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    const qrPath = `/api/tu/public/qr-download/${qrDownloadToken}`;
    res.json({
      success: true,
      qrUrl: qrPath,
      token: qrDownloadToken,
      expiresAt: qrDownloadTokenExpiresAt.toISOString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Observation letter QR generate error:', err);
    res.status(500).json({ error: 'Gagal membuat QR Code surat observasi.', details: err.message, stack: err.stack });
  } finally {
    client.release();
  }
});

// Kirim email surat observasi langsung dari form (bukan dari DB yang sudah ada)
router.post('/tu/observation-letter/send-email', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel,
    targetEmail   // email tujuan pengiriman (diisi user di form)
  } = req.body;

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return res.status(400).json({ error: 'Alamat email tujuan tidak valid.' });
  }

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'sent');
    requestData = await ensureLetterNumber(client, 'observation', requestData);

    const config = letterConfig.observation;
    const tuSettings = await getTuSettingsPayload();
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY.observation;
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    htmlContent = htmlContent
      .replace(/{{name}}/g, requestData.name || '')
      .replace(/{{nim}}/g, requestData.nim || '')
      .replace(/{{tanggalSurat}}/g, tanggalSurat)
      .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
      .replace(/{{stampImage}}/g, requestData.stamp_base64 || '')
      .replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const placeholders = config.getPlaceholders({ data: requestData, letterNumber: requestData.letter_number });
    for (const key in placeholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), placeholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const pdfFilename = `SuratObservasi_${safeCompanyName}_${requestData.letter_number?.replace(/\//g, '_') || requestData.nim}.pdf`;

    const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME;
    const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: targetEmail,
      subject: `${config.subject} - ${resolvedCompanyName || 'Observasi'}`,
      text: `Halo, ${resolvedName} (${resolvedNim})\n\nPermohonan Surat Pengantar Observasi Anda telah disetujui dan diproses oleh Tata Usaha. Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.\n\nSalam,\nBagian Tata Usaha\nFakultas Teknologi Informasi UKSW`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Halo, ${resolvedName} (${resolvedNim})</h2>
          ${config.emailBody}
          <br/>
          <p>Salam,<br/><strong>Bagian Tata Usaha<br/>Fakultas Teknologi Informasi UKSW</strong></p>
        </div>
      `,
      attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }],
      list: {
        unsubscribe: {
          url: `mailto:${fromEmail}?subject=unsubscribe`,
          comment: 'Unsubscribe'
        }
      }
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('[Mailer] Mock Email Preview (Ethereal):', previewUrl);
    else console.log(`[Mailer] ✅ Surat observasi terkirim ke ${targetEmail}`);

    res.json({
      success: true,
      message: `Surat berhasil dikirim ke ${targetEmail}`,
      letterNumber: requestData.letter_number
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Mailer] Observation send-email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email surat observasi. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

router.get('/tu/public/qr-download/:token', async (req, res) => {
  const token = req.params.token;
  if (token.startsWith('QR-')) {
    const session = qrDownloadSessions.get(token);
    if (!session) {
      return res.status(404).send('Link download tidak valid atau sudah kadaluarsa (maksimal 10 menit).');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', session.buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${session.filename}"`);
    return res.send(session.buffer);
  }

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    const tokenHash = hashQrDownloadToken(token);
    const result = await client.query(
      `SELECT * FROM observation_requests
       WHERE qr_download_token_hash = $1
         AND qr_download_token_expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Link download tidak valid atau sudah kadaluarsa (maksimal 24 jam).');
    }

    const requestData = result.rows[0];
    const config = letterConfig.observation;
    const tuSettings = await getTuSettingsPayload();
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY.observation;
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = requestData.letter_generated_at 
      ? new Date(requestData.letter_generated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(requestData.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    htmlContent = htmlContent
      .replace(/{{name}}/g, requestData.name || '')
      .replace(/{{nim}}/g, requestData.nim || '')
      .replace(/{{tanggalSurat}}/g, tanggalSurat)
      .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
      .replace(/{{stampImage}}/g, requestData.stamp_base64 || '')
      .replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const placeholders = config.getPlaceholders({
      data: requestData,
      letterNumber: requestData.letter_number || '-',
    });

    for (const key in placeholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), placeholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);
    const safeCompanyName = (requestData.company || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('QR download generation error:', err);
    res.status(500).send('Gagal menghasilkan dokumen.');
  } finally {
    client.release();
  }
});

router.get('/tu/requests/:type/:id/download', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];

  if (!config) {
    return res.status(400).json({ error: 'Jenis surat tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }
    const requestData = result.rows[0];

    const tuSettings = await getTuSettingsPayload();
    const semesterMeta = getSemesterMeta(tuSettings.currentSemesterCode);
    const assetKey = LETTER_TYPE_TO_CLIENT_KEY[type];
    const backgroundImage = tuSettings.letterBackgrounds?.[assetKey]?.imageBase64 || '';
    const letterLayout = normalizeLetterLayout(
      tuSettings.letterLayouts?.[assetKey],
      DEFAULT_LETTER_LAYOUT_MM[assetKey]
    );
    const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    const tanggalSurat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    htmlContent = htmlContent.replace(/{{name}}/g, requestData.name || '')
      .replace(/{{nim}}/g, requestData.nim || '')
      .replace(/{{tanggalSurat}}/g, tanggalSurat)
      .replace(/{{signatureImage}}/g, requestData.signature_base64 || '')
      .replace(/{{stampImage}}/g, requestData.stamp_base64 || '')
      .replace(/{{backgroundImage}}/g, backgroundImage)
      .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
      .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
      .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
      .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm));

    const specificPlaceholders = config.getPlaceholders({
      data: requestData,
      letterNumber: requestData.letter_number,
      semesterMeta
    });

    for (const key in specificPlaceholders) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), specificPlaceholders[key]);
    }

    const pdfBuffer = await generatePdfBuffer(htmlContent);

    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download PDF error:', err);
    res.status(500).json({ error: 'Gagal mendownload PDF dokumen.' });
  }
});

router.get('/active-student/summary', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT status, COUNT(*) as count FROM active_student_requests GROUP BY status`);

    const summary = {
      pending: 0,
      verified: 0,
      sent: 0,
      total: 0
    };

    result.rows.forEach((row) => {
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
