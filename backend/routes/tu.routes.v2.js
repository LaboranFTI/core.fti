import express from 'express';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qr.js';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
import {
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  formatStudentName,
  getStudyProgramCodeFromNim,
  mapStudyProgramRow
} from '../utils/activeStudentLetter.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QR_CENTER_LOGO_PATH = path.join(__dirname, '..', '..', 'src', 'assets', 'FTI_nobg.svg');

const uploadSessions = new Map();
const qrDownloadSessions = new Map();

const TU_ACCESS_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
const TU_ADMIN_ROLES = ['Admin', 'Admin TU'];
const TU_SUBMIT_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
const TU_SETTINGS_KEYS = [
  'tu_dean_signature_base64',
  'tu_faculty_stamp_base64',
  'tu_current_semester_code',
  'tu_su_rek_yang_terhormat',
  'tu_su_rek_berdasarkan_no',
  'tu_su_rek_perihal',
  'tu_su_rek_lampiran',
  'tu_su_rek_tembusan'
];
const QR_DOWNLOAD_TOKEN_TTL_HOURS = 24;
const publicObservationAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan kode akses. Silakan coba lagi beberapa menit lagi.' }
});
const publicValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request validasi. Silakan coba lagi beberapa menit lagi.' }
});
const LETTER_TYPE_TO_CLIENT_KEY = {
  'active-student': 'activeStudent',
  observation: 'observation',
  'su-rek': 'suRek'
};
const SHARED_LETTER_BACKGROUND_TYPE = 'document';
const LETTER_TYPE_TO_CODE = {
  'active-student': 'S.Ket',
  observation: 'FTI-OBS',
  'su-rek': 'Su.Rek'
};
const OBSERVATION_ACCESS_CODE_PREFIX = 'OBS';
const SUREK_ACCESS_CODE_PREFIX = 'REK';
const OBSERVATION_ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALIDATION_TOKEN_BYTES = 24;

const createQrDownloadToken = () => crypto.randomBytes(32).toString('base64url');
const hashQrDownloadToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const getQrDownloadExpiry = () => new Date(Date.now() + QR_DOWNLOAD_TOKEN_TTL_HOURS * 60 * 60 * 1000);
const createValidationToken = () => crypto.randomBytes(VALIDATION_TOKEN_BYTES).toString('base64url');
const randomAccessCodeSegment = () =>
  Array.from({ length: 4 }, () => OBSERVATION_ACCESS_CODE_ALPHABET[crypto.randomInt(0, OBSERVATION_ACCESS_CODE_ALPHABET.length)]).join('');
const createObservationAccessCode = () => `${OBSERVATION_ACCESS_CODE_PREFIX}-${randomAccessCodeSegment()}-${randomAccessCodeSegment()}`;
const normalizeObservationAccessCode = (value) => {
  const compactCode = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compactCode.length !== 11 || !compactCode.startsWith(OBSERVATION_ACCESS_CODE_PREFIX)) {
    return '';
  }

  const normalizedCode = `${compactCode.slice(0, 3)}-${compactCode.slice(3, 7)}-${compactCode.slice(7, 11)}`;
  return /^OBS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode) ? normalizedCode : '';
};
const createSuRekAccessCode = () => `${SUREK_ACCESS_CODE_PREFIX}-${randomAccessCodeSegment()}-${randomAccessCodeSegment()}`;
const normalizeSuRekAccessCode = (value) => {
  const compactCode = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compactCode.length !== 11 || !compactCode.startsWith(SUREK_ACCESS_CODE_PREFIX)) {
    return '';
  }

  const normalizedCode = `${compactCode.slice(0, 3)}-${compactCode.slice(3, 7)}-${compactCode.slice(7, 11)}`;
  return /^REK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode) ? normalizedCode : '';
};

const createEmptyLetterBackgrounds = () => ({
  document: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  suRek: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const DEFAULT_LETTER_LAYOUT_MM = Object.freeze({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  suRek: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

const createEmptyLetterLayouts = () => ({
  activeStudent: { ...DEFAULT_LETTER_LAYOUT_MM.activeStudent },
  observation: { ...DEFAULT_LETTER_LAYOUT_MM.observation },
  suRek: { ...DEFAULT_LETTER_LAYOUT_MM.suRek }
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
let qrCenterLogoDataUrlPromise = null;

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
        validation_token VARCHAR(64),
        qr_download_token_hash VARCHAR(64),
        qr_download_token_expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        carbon_copies JSONB DEFAULT '[]'::jsonb,
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
      ADD COLUMN IF NOT EXISTS validation_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
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
        validation_token VARCHAR(64),
        access_code VARCHAR(20),
        qr_download_token_hash VARCHAR(64),
        qr_download_token_expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        carbon_copies JSONB DEFAULT '[]'::jsonb,
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
      ADD COLUMN IF NOT EXISTS validation_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS access_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_backgrounds (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('document', 'active-student', 'observation', 'su-rek')),
        file_name VARCHAR(255),
        mime_type VARCHAR(100) DEFAULT 'image/png',
        image_base64 TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(letter_type)
      )
    `);

    await pool.query(`
      DO $$
      DECLARE
        constraint_record record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_backgrounds'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
        ) OR EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_backgrounds'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
            AND pg_get_constraintdef(oid) NOT LIKE '%su-rek%'
        ) THEN
          FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'tu_letter_backgrounds'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%letter_type%'
          LOOP
            EXECUTE format('ALTER TABLE tu_letter_backgrounds DROP CONSTRAINT %I', constraint_record.conname);
          END LOOP;

          ALTER TABLE tu_letter_backgrounds
            ADD CONSTRAINT tu_letter_backgrounds_letter_type_check
            CHECK (letter_type IN ('document', 'active-student', 'observation', 'su-rek'));
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_number_counters (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation', 'su-rek')),
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
      DO $$
      DECLARE
        constraint_record record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_number_counters'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
        ) OR EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_number_counters'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
            AND pg_get_constraintdef(oid) NOT LIKE '%su-rek%'
        ) THEN
          FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'tu_letter_number_counters'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%letter_type%'
          LOOP
            EXECUTE format('ALTER TABLE tu_letter_number_counters DROP CONSTRAINT %I', constraint_record.conname);
          END LOOP;

          ALTER TABLE tu_letter_number_counters
            ADD CONSTRAINT tu_letter_number_counters_letter_type_check
            CHECK (letter_type IN ('active-student', 'observation', 'su-rek'));
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_layouts (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation', 'su-rek')),
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
      DO $$
      DECLARE
        constraint_record record;
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_layouts'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
        ) OR EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'tu_letter_layouts'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%letter_type%'
            AND pg_get_constraintdef(oid) NOT LIKE '%su-rek%'
        ) THEN
          FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'tu_letter_layouts'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%letter_type%'
          LOOP
            EXECUTE format('ALTER TABLE tu_letter_layouts DROP CONSTRAINT %I', constraint_record.conname);
          END LOOP;

          ALTER TABLE tu_letter_layouts
            ADD CONSTRAINT tu_letter_layouts_letter_type_check
            CHECK (letter_type IN ('active-student', 'observation', 'su-rek'));
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS su_rek_requests (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        recipient_name TEXT,
        berdasarkan_no VARCHAR(100),
        perihal VARCHAR(255),
        lampiran VARCHAR(100),
        signature_base64 TEXT,
        stamp_base64 TEXT,
        letter_number VARCHAR(100),
        letter_sequence INTEGER,
        letter_generated_at TIMESTAMP,
        validation_token VARCHAR(64),
        access_code VARCHAR(20),
        qr_download_token_hash VARCHAR(64),
        qr_download_token_expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        carbon_copies JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE su_rek_requests
      ADD COLUMN IF NOT EXISTS recipient_name TEXT,
      ADD COLUMN IF NOT EXISTS berdasarkan_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS perihal VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lampiran VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signature_base64 TEXT,
      ADD COLUMN IF NOT EXISTS stamp_base64 TEXT,
      ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
      ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS validation_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS access_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_su_rek_requests_letter_number_unique
      ON su_rek_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_su_rek_requests_validation_token_unique
      ON su_rek_requests(validation_token)
      WHERE validation_token IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_su_rek_requests_access_code_unique
      ON su_rek_requests(access_code)
      WHERE access_code IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_student_requests_letter_number_unique
      ON active_student_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_student_requests_validation_token_unique
      ON active_student_requests(validation_token)
      WHERE validation_token IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_letter_number_unique
      ON observation_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_validation_token_unique
      ON observation_requests(validation_token)
      WHERE validation_token IS NOT NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_requests_qr_download_token_hash
      ON observation_requests(qr_download_token_hash)
      WHERE qr_download_token_hash IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_access_code_unique
      ON observation_requests(access_code)
      WHERE access_code IS NOT NULL
    `);

    await pool.query(`
      INSERT INTO system_settings (key, value) VALUES
        ('tu_dean_signature_base64', ''),
        ('tu_faculty_stamp_base64', ''),
        ('tu_current_semester_code', ''),
        ('tu_su_rek_yang_terhormat', 'Wakil Rektor Bidang Kerjasama dan Kealumnian\nUniversitas Kristen Satya Wacana\ndi tempat'),
        ('tu_su_rek_berdasarkan_no', '008/WR-KK/02/2025'),
        ('tu_su_rek_perihal', 'Beasiswa Afirmasi Cemerlang, ACPOS dan ACPA'),
        ('tu_su_rek_lampiran', '1 bendel'),
        ('tu_su_rek_tembusan', '[]')
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_su_rek_requests_updated_at'
        ) THEN
          CREATE TRIGGER update_su_rek_requests_updated_at
          BEFORE UPDATE ON su_rek_requests
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
  validationToken: row.validation_token,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
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
  studyProgramLevel: row.study_program_level,
  studyProgramName: row.study_program_name,
  students: normalizeObservationStudents(row.student_members),
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  accessCode: row.access_code,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
  createdAt: row.created_at
});

const buildObservationAccessPayload = (row) => ({
  accessCode: row.access_code,
  letterNumber: row.letter_number,
  status: row.status,
  letterGeneratedAt: row.letter_generated_at,
  data: {
    recipientName: row.recipient_name || '',
    companyName: row.company || '',
    companyAddress: row.company_address || '',
    courseName: row.course_name || '',
    lecturerName: row.lecturer_name || '',
    headOfProgramName: row.head_of_program_name || '',
    studyProgramName: row.study_program_name || '',
    studyProgramLevel: row.study_program_level || '',
    students: normalizeObservationStudents(row.student_members),
    carbonCopies: row.carbon_copies || []
  }
});

const formatPublicDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // PostgreSQL TIMESTAMP (without timezone) stores WIB local time as-is.
  // node-pg interprets it as UTC, so toISOString() labels it 'Z' incorrectly.
  // We re-label it as +07:00 (WIB) so the frontend displays the correct local time.
  return date.toISOString().replace('Z', '+07:00');
};

const buildPublicValidationUrl = (req, token) => {
  if (!token) return '';
  const configuredBaseUrl = buildPublicAppBaseUrl(req);
  return `${configuredBaseUrl}/tu/validasi-surat/${token}`;
};

const buildPublicAppBaseUrl = (req) => {
  const configuredBaseUrl =
    process.env.VITE_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_BASE_URL ||
    `${req.protocol}://${req.get('host')}`;
  return configuredBaseUrl.replace(/\/$/, '');
};

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getQrCenterLogoDataUrl = async () => {
  if (!qrCenterLogoDataUrlPromise) {
    qrCenterLogoDataUrlPromise = fs.readFile(QR_CENTER_LOGO_PATH)
      .then((buffer) => `data:image/svg+xml;base64,${buffer.toString('base64')}`)
      .catch((err) => {
        qrCenterLogoDataUrlPromise = null;
        console.warn('Failed to load TU QR center logo:', err.message);
        return '';
      });
  }

  return qrCenterLogoDataUrlPromise;
};

const createQrSvgDataUrl = async (value) => {
  if (!value) return '';

  const qr = qrcode(value, { errorCorrectLevel: qrcode.ErrorCorrectLevel.H });
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const size = moduleCount + quietZone * 2;
  const rects = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        rects.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
      }
    }
  }

  const logoDataUrl = await getQrCenterLogoDataUrl();
  const logoSize = Math.max(8, size * 0.25);
  const logoPadding = Math.max(1.25, size * 0.045);
  const logoFrameSize = logoSize + logoPadding * 2;
  const logoFrameCenter = size / 2;
  const logoFrameRadius = logoFrameSize / 2;
  const logoX = (size - logoSize) / 2;
  const logoMarkup = logoDataUrl
    ? `<circle cx="${logoFrameCenter}" cy="${logoFrameCenter}" r="${logoFrameRadius}" fill="#fff" shape-rendering="geometricPrecision"/><image href="${logoDataUrl}" x="${logoX}" y="${logoX}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><g fill="#000">${rects.join('')}</g>${logoMarkup}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `***@${domain}`;
  return `${local.substring(0, 3)}***@${domain}`;
};

const maskNim = (nim) => {
  if (!nim || typeof nim !== 'string' || nim.length < 5) return nim;
  return `${nim.substring(0, 4)}****`;
};

const maskDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  return '***DISENSOR***';
};

const buildLetterValidationPayload = (type, row, req) => {
  const isObservation = type === 'observation';
  const isSuRek = type === 'su-rek';
  const students = isObservation ? normalizeObservationStudents(row.student_members).map(s => ({ ...s, nim: maskNim(s.nim) })) : [];
  const primaryStudent = students[0] || { name: row.name, nim: maskNim(row.nim) };

  let typeLabel = 'Surat Keterangan Aktif Kuliah';
  if (isObservation) {
    typeLabel = 'Surat Pengantar Observasi';
  } else if (isSuRek) {
    typeLabel = 'Surat Rekomendasi Afirmasi Cemerlang';
  }

  return {
    type,
    typeLabel,
    status: row.status,
    isValid: ['verified', 'sent'].includes(row.status),
    letterNumber: row.letter_number,
    validationToken: row.validation_token,
    validationUrl: buildPublicValidationUrl(req, row.validation_token),
    issuedAt: formatPublicDate(row.letter_generated_at || row.created_at),
    createdAt: formatPublicDate(row.created_at),
    recipient: {
      name: row.name || primaryStudent.name || '',
      nim: maskNim(row.nim || primaryStudent.nim || ''),
      email: maskEmail(row.email || '')
    },
    activeStudent: (isObservation || isSuRek)
      ? null
      : {
          birthPlace: row.birth_place || '',
          birthDate: maskDate(row.birth_date),
          studyProgramLevel: row.study_program_level || '',
          studyProgramName: row.study_program_name || '',
          faculty: row.faculty || DEFAULT_FACULTY,
          university: row.university || DEFAULT_UNIVERSITY
        },
    observation: isObservation
      ? {
          recipientName: row.recipient_name || '',
          company: row.company || '',
          companyAddress: row.company_address || '',
          courseName: row.course_name || '',
          lecturerName: row.lecturer_name || '',
          headOfProgramName: row.head_of_program_name || '',
          studyProgramLevel: row.study_program_level || '',
          studyProgramName: row.study_program_name || '',
          students
        }
      : null,
    suRek: isSuRek
      ? {
          recipientName: row.recipient_name || '',
          berdasarkanNo: row.berdasarkan_no || '',
          perihal: row.perihal || '',
          lampiran: row.lampiran || ''
        }
      : null,
    carbonCopies: row.carbon_copies || []
  };
};

const buildLetterBackgroundsPayload = (rows) => {
  const backgrounds = createEmptyLetterBackgrounds();
  let sharedBackground = null;

  for (const row of rows) {
    const asset = {
      imageBase64: row.image_base64 || '',
      fileName: row.file_name || '',
      mimeType: row.mime_type || 'image/png'
    };

    if (row.letter_type === SHARED_LETTER_BACKGROUND_TYPE) {
      sharedBackground = asset;
      continue;
    }

    const clientKey = LETTER_TYPE_TO_CLIENT_KEY[row.letter_type];
    if (!clientKey) continue;

    backgrounds[clientKey] = asset;
  }

  sharedBackground =
    sharedBackground ||
    (backgrounds.activeStudent.imageBase64 ? backgrounds.activeStudent : null) ||
    (backgrounds.observation.imageBase64 ? backgrounds.observation : null) ||
    (backgrounds.suRek.imageBase64 ? backgrounds.suRek : null) ||
    backgrounds.document;

  backgrounds.document = sharedBackground;
  backgrounds.activeStudent = sharedBackground;
  backgrounds.observation = sharedBackground;
  backgrounds.suRek = sharedBackground;

  return backgrounds;
};

const getSharedLetterBackground = (letterBackgrounds) => {
  if (!letterBackgrounds || typeof letterBackgrounds !== 'object') {
    return createEmptyLetterBackgrounds().document;
  }

  return letterBackgrounds.document?.imageBase64
    ? letterBackgrounds.document
    : letterBackgrounds.activeStudent?.imageBase64
      ? letterBackgrounds.activeStudent
      : letterBackgrounds.observation?.imageBase64
        ? letterBackgrounds.observation
        : letterBackgrounds.suRek?.imageBase64
          ? letterBackgrounds.suRek
          : createEmptyLetterBackgrounds().document;
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

const getStudyProgramByNim = async (nim, queryable = pool) => {
  const studyProgramCode = getStudyProgramCodeFromNim(nim);
  if (!studyProgramCode) return null;

  const result = await queryable.query(
    'SELECT id, name, level FROM study_programs WHERE id = $1 LIMIT 1',
    [studyProgramCode]
  );

  return mapStudyProgramRow(result.rows[0]);
};

const getRecommendationSigner = async () => {
  let name = 'Nama Wakil Dekan Belum Diatur';
  let title = 'Wakil Dekan';

  try {
    const result = await pool.query(`
      SELECT nama, jabatan
      FROM lecturer
      WHERE jabatan ILIKE 'Wakil Dekan%'
      ORDER BY nama ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      name = result.rows[0].nama;
      title = result.rows[0].jabatan;
    }
  } catch (e) {
    console.error('Failed to fetch recommendation signer data:', e);
  }

  return { name, title };
};

const formatLetterNumber = (type, sequence, date) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  if (type === 'su-rek') {
    const month = String(date.getMonth() + 1);
    return `${paddedSequence}/FTI/Su.Rek/${month}/${date.getFullYear()}`;
  }
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
    suRekYangTerhormat: settings.tu_su_rek_yang_terhormat || 'Wakil Rektor Bidang Kerjasama dan Kealumnian\nUniversitas Kristen Satya Wacana\ndi tempat',
    suRekBerdasarkanNo: settings.tu_su_rek_berdasarkan_no || '008/WR-KK/02/2025',
    suRekPerihal: settings.tu_su_rek_perihal || 'Beasiswa Afirmasi Cemerlang, ACPOS dan ACPA',
    suRekLampiran: settings.tu_su_rek_lampiran || '1 bendel',
    suRekTembusan: (() => { try { return JSON.parse(settings.tu_su_rek_tembusan || '[]'); } catch { return []; } })(),
    letterBackgrounds: buildLetterBackgroundsPayload(assetResult.rows),
    letterLayouts: buildLetterLayoutsPayload(layoutResult.rows)
  };
};

const saveLetterBackgrounds = async (client, letterBackgrounds) => {
  await ensureTuInfrastructure();
  if (!letterBackgrounds || typeof letterBackgrounds !== 'object') return;

  const asset = getSharedLetterBackground(letterBackgrounds);

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
      [SHARED_LETTER_BACKGROUND_TYPE, asset.fileName || '', asset.mimeType || 'image/png', asset.imageBase64]
    );
  } else {
    await client.query(
      `DELETE FROM tu_letter_backgrounds WHERE letter_type = $1`,
      [SHARED_LETTER_BACKGROUND_TYPE]
    );
  }

  await client.query(
    `DELETE FROM tu_letter_backgrounds WHERE letter_type = ANY($1::text[])`,
    [Object.keys(LETTER_TYPE_TO_CLIENT_KEY)]
  );
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

const sendSuRekAccessCodeEmail = async (requestData, req) => {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME || 'TU FTI UKSW';
  const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;
  const accessCode = requestData.access_code || requestData.accessCode || '';
  const serviceUrl = `${buildPublicAppBaseUrl(req)}/layanan-tu`;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: requestData.email,
    subject: `Kode Akses Surat Rekomendasi - ${requestData.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Permohonan Surat Rekomendasi Diterima</h2>
        <p>Halo, <strong>${escapeXml(requestData.name)}</strong>.</p>
        <p>Permohonan Surat Rekomendasi Afirmasi Cemerlang Anda telah masuk ke sistem Tata Usaha FTI UKSW.</p>
        <p>Gunakan kode akses berikut untuk mengecek status permohonan dan mengunduh surat setelah diverifikasi:</p>
        <div style="margin: 18px 0; padding: 14px 18px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; text-align: center;">
          <div style="font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em;">Kode Akses</div>
          <div style="font-size: 24px; font-weight: 700; letter-spacing: 0.12em; color: #1d4ed8; font-family: Consolas, monospace;">${escapeXml(accessCode)}</div>
        </div>
        <p>Buka halaman layanan TU lalu masukkan kode akses tersebut:</p>
        <p><a href="${serviceUrl}" style="color: #1d4ed8;">${serviceUrl}</a></p>
        <p>Salam,<br/><strong>Bagian Tata Usaha<br/>Fakultas Teknologi Informasi UKSW</strong></p>
      </div>
    `,
    text: [
      `Halo, ${requestData.name}.`,
      'Permohonan Surat Rekomendasi Afirmasi Cemerlang Anda telah masuk ke sistem Tata Usaha FTI UKSW.',
      `Kode akses: ${accessCode}`,
      `Buka halaman layanan TU: ${serviceUrl}`,
      'Salam, Bagian Tata Usaha FTI UKSW'
    ].join('\n\n')
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[Mailer] Mock Email Preview (SuRek access code):', previewUrl);
  } else {
    console.log(`[Mailer] Kode akses SuRek terkirim ke ${requestData.email} | MessageID: ${info.messageId}`);
  }

  return { messageId: info.messageId, previewUrl };
};

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
      let deanName = 'Nama Dekan Belum Diatur';
      let deanTitle = 'Dekan';

      try {
        const deanResult = await pool.query(`
          SELECT nama, jabatan
          FROM lecturer
          WHERE jabatan ILIKE 'Dekan%' OR jabatan ILIKE 'Wakil Dekan%'
          ORDER BY CASE WHEN jabatan ILIKE 'Dekan%' THEN 0 ELSE 1 END, nama ASC
          LIMIT 1
        `);
        if (deanResult.rows.length > 0) {
          deanName = deanResult.rows[0].nama;
          deanTitle = deanResult.rows[0].jabatan;
        }
      } catch (e) {
        console.error('Failed to fetch Dean data:', e);
      }

      const studyProgram = data.study_program_level && data.study_program_name
        ? {
            studyProgramLevel: data.study_program_level,
            studyProgramName: data.study_program_name
          }
        : await getStudyProgramByNim(data.nim);

      return {
        '{{tempatTanggalLahir}}': buildBirthPlaceAndDate(data.birth_place || data.birthPlace, data.birth_date || data.birthDate),
        '{{jenjangProgram}}': data.study_program_level || data.studyProgramLevel || studyProgram?.studyProgramLevel || '',
        '{{programStudi}}': data.study_program_name || data.studyProgramName || studyProgram?.studyProgramName || '',
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
      <p>Permohonan Surat Pengantar Observasi Anda telah diproses oleh Sistem CORE.FTI.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF.</p>
    `,
    getPlaceholders: ({ data, letterNumber }) => {
      const level = data.study_program_level || data.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        'Sarjana': 'S1',
        'Magister': 'S2',
        'Doktor': 'S3'
      };

      const tanggalSurat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());

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
        '{{programStudi}}': data.study_program_name || data.studyProgramName || 'Teknik Informatika',
        '{{studentRows}}': buildObservationStudentRowsHtml(data.student_members || data.students),
        '{{tanggalSurat}}': tanggalSurat
      };
    }
  },
  'su-rek': {
    table: 'su_rek_requests',
    template: 'suratRekomendasiAfirmasiV2.html',
    subject: 'Surat Rekomendasi Afirmasi Cemerlang',
    pdfFilename: 'Surat_Rekomendasi_Afirmasi',
    emailBody: `
      <p>Permohonan Surat Rekomendasi Afirmasi Cemerlang Anda telah disetujui dan diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, semesterMeta }) => {
      const recommendationSigner = await getRecommendationSigner();

      const studyProgram = await getStudyProgramByNim(data.nim);
      const programLevel = studyProgram?.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        'Sarjana': 'S1',
        'Magister': 'S2',
        'Doktor': 'S3'
      };
      const formattedProdi = `${map[programLevel] || programLevel} ${studyProgram?.studyProgramName || ''}`.toUpperCase();

      const tanggalSurat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
      const academicYearDashed = (semesterMeta?.academicYear || '2025/2026').replace(/\//g, '-');

      return {
        '{{nomorSurat}}': letterNumber,
        '{{lampiran}}': data.lampiran || '1 bendel',
        '{{recipientName}}': String(data.recipient_name || data.recipientName || '').replace(/\r?\n/g, '<br>'),
        '{{berdasarkanNo}}': data.berdasarkan_no || data.berdasarkanNo || '',
        '{{perihal}}': data.perihal || 'Beasiswa Afirmasi Cemerlang, ACPOS dan ACPA',
        '{{name}}': (data.name || '').toUpperCase(),
        '{{nim}}': (data.nim || '').toUpperCase(),
        '{{programStudi}}': formattedProdi,
        '{{dekanNama}}': recommendationSigner.name,
        '{{dekanTitle}}': recommendationSigner.title,
        '{{tanggalSurat}}': tanggalSurat,
        '{{tahunAkademikDashed}}': academicYearDashed
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

const ensureLetterValidationToken = async (queryable, type, requestData) => {
  if (requestData.validation_token) {
    return requestData;
  }

  const config = letterConfig[type];
  if (!config) {
    throw new Error('Jenis surat tidak valid untuk token validasi.');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const validationToken = createValidationToken();
      const updateResult = await queryable.query(
        `UPDATE ${config.table}
         SET validation_token = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [validationToken, requestData.id]
      );
      return updateResult.rows[0];
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }

  throw new Error('Gagal membuat token validasi surat.');
};

const buildLetterHtml = async (type, requestData, req) => {
  const config = letterConfig[type];
  if (!config) {
    throw new Error('Jenis surat tidak valid.');
  }

  const tuSettings = await getTuSettingsPayload();
  const semesterMeta = getSemesterMeta(tuSettings.currentSemesterCode);
  const assetKey = LETTER_TYPE_TO_CLIENT_KEY[type];
  const backgroundImage = requestData.backgroundImageBase64 || getSharedLetterBackground(tuSettings.letterBackgrounds).imageBase64 || '';
  const letterLayout = requestData.layout || normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
  const templatePath = path.join(__dirname, '..', 'lettersTU', config.template);
  let htmlContent = await fs.readFile(templatePath, 'utf-8');

  const validationToken = requestData.validation_token || requestData.validationToken;
  const letterNumberVal = requestData.letter_number || requestData.letterNumber;
  const letterGeneratedAt = requestData.letter_generated_at || requestData.letterGeneratedAt;

  const tanggalSurat = letterGeneratedAt
    ? new Date(letterGeneratedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const validationUrl = buildPublicValidationUrl(req, validationToken);
  const validationQrImage = await createQrSvgDataUrl(validationUrl);

  const draftWatermarkHtml = requestData.status === 'pending'
    ? '<div class="draft-watermark">DRAFT / PENDING</div>'
    : '';

  const ccRaw = requestData.carbon_copies || requestData.carbonCopies || [];
  let ccArray = [];
  if (typeof ccRaw === 'string') {
    try {
      ccArray = JSON.parse(ccRaw);
    } catch (e) {
      console.error('Failed to parse carbon copies string:', e);
    }
  } else if (Array.isArray(ccRaw)) {
    ccArray = ccRaw;
  }

  let tembusanHtml = '';
  if (ccArray && ccArray.length > 0) {
    const listItems = ccArray
      .map(cc => `<li style="list-style: none; margin: 0; padding: 0 0 0 2mm; text-indent: -2mm;">- ${cc.role || cc.jabatan || ''}${cc.name || cc.nama ? ` - ${cc.name || cc.nama}` : ''}</li>`)
      .join('\n');
    tembusanHtml = `
      <div class="carbon-copy-block" style="margin-top: 8mm; font-size: 9.5pt; line-height: 1.3;">
          <p style="margin: 0; font-weight: bold;">Tembusan Kepada Yth:</p>
          <ul style="margin: 1mm 0 0 0; padding: 0; list-style: none;">
              ${listItems}
          </ul>
      </div>
    `;
  }

  htmlContent = htmlContent
    .replace(/{{name}}/g, requestData.name || '')
    .replace(/{{nim}}/g, requestData.nim || '')
    .replace(/{{tanggalSurat}}/g, tanggalSurat)
    .replace(/{{signatureImage}}/g, '')
    .replace(/{{stampImage}}/g, '')
    .replace(/{{validationUrl}}/g, escapeXml(validationUrl))
    .replace(/{{validationQrImage}}/g, validationQrImage)
    .replace(/{{backgroundImage}}/g, backgroundImage)
    .replace(/{{marginTopMm}}/g, String(letterLayout.marginTopMm))
    .replace(/{{marginRightMm}}/g, String(letterLayout.marginRightMm))
    .replace(/{{marginBottomMm}}/g, String(letterLayout.marginBottomMm))
    .replace(/{{marginLeftMm}}/g, String(letterLayout.marginLeftMm))
    .replace(/{{draftWatermark}}/g, draftWatermarkHtml)
    .replace(/{{tembusanBlock}}/g, tembusanHtml);

  const placeholders = config.getPlaceholders({
    data: requestData,
    letterNumber: letterNumberVal || '-',
    semesterMeta
  });

  const resolvedPlaceholders = await placeholders;
  for (const key in resolvedPlaceholders) {
    htmlContent = htmlContent.replace(new RegExp(key, 'g'), resolvedPlaceholders[key]);
  }

  return htmlContent;
};

const buildLetterPdfBuffer = async (type, requestData, req) => {
  const htmlContent = await buildLetterHtml(type, requestData, req);
  return generatePdfBuffer(htmlContent);
};

const buildObservationPdfBuffer = async (requestData, req) => {
  const requestWithToken = await ensureLetterValidationToken(pool, 'observation', requestData);
  return buildLetterPdfBuffer('observation', requestWithToken, req);
};

const ensureObservationAccessCode = async (client, requestData) => {
  if (requestData.access_code) {
    return requestData;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const accessCode = createObservationAccessCode();
      const updateResult = await client.query(
        `UPDATE observation_requests
         SET access_code = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [accessCode, requestData.id]
      );
      return updateResult.rows[0];
    } catch (err) {
      if (err?.code === '23505') {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Gagal membuat kode akses surat observasi.');
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
         study_program_name = $9, student_members = $10::jsonb, status = $11, carbon_copies = $12::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [
        data.name, data.email, data.recipient_name, data.company_address, data.purpose || null,
        data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), newStatus,
        JSON.stringify(data.carbon_copies || []),
        existing.id
      ]
    );
    return updateResult.rows[0];
  } else {
    const id = `OBS-${Date.now()}`;
    const insertResult = await client.query(
      `INSERT INTO observation_requests (
          id, name, nim, email, recipient_name, company_address, company,
          purpose, course_name, lecturer_name, head_of_program_name, study_program_level, study_program_name, student_members, status, carbon_copies
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb)
      RETURNING *`,
      [
        id, data.name, data.nim, data.email, data.recipient_name, data.company_address, data.company, 
        data.purpose || null, data.course_name, data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), targetStatus,
        JSON.stringify(data.carbon_copies || [])
      ]
    );
    return insertResult.rows[0];
  }
};

router.post('/tu/preview-html', verifyRole([...TU_ACCESS_ROLES, 'Mahasiswa']), async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).send('Parameter type dan data diperlukan.');
  }
  try {
    const html = await buildLetterHtml(type, data, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Preview HTML error:', err);
    res.status(500).send('Gagal membuat pratinjau surat.');
  }
});

router.get('/tu/requests/:type/:id/preview-html', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];
  if (!config) {
    return res.status(400).send('Jenis surat tidak valid.');
  }
  try {
    const result = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Pengajuan tidak ditemukan.');
    }
    const requestData = result.rows[0];
    const html = await buildLetterHtml(type, requestData, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Saved preview HTML error:', err);
    res.status(500).send('Gagal membuat pratinjau surat.');
  }
});

router.get('/tu/public/letter-validation/:token/preview-html', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).send('Token validasi tidak valid.');
  }
  try {
    await ensureTuInfrastructure();
    const [activeResult, observationResult, suRekResult] = await Promise.all([
      pool.query(`SELECT * FROM active_student_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM observation_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM su_rek_requests WHERE validation_token = $1 LIMIT 1`, [token])
    ]);
    const type = activeResult.rows.length > 0 ? 'active-student' : observationResult.rows.length > 0 ? 'observation' : suRekResult.rows.length > 0 ? 'su-rek' : null;
    const requestData = activeResult.rows[0] || observationResult.rows[0] || suRekResult.rows[0];
    if (!type || !requestData) {
      return res.status(404).send('Surat tidak ditemukan atau token validasi tidak terdaftar.');
    }
    const html = await buildLetterHtml(type, requestData, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Public validation preview HTML error:', err);
    res.status(500).send('Gagal memvalidasi surat.');
  }
});

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
    faculty,
    university,
    transcriptBase64,
    transcriptName,
    carbonCopies
  } = req.body;

  try {
    await ensureTuInfrastructure();
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
         status,
         carbon_copies
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13::jsonb)`,
      [
        id,
        formatStudentName(name),
        nim,
        email,
        birthPlace || null,
        birthDate || null,
        studyProgram.studyProgramLevel,
        studyProgram.studyProgramName,
        faculty || DEFAULT_FACULTY,
        university || DEFAULT_UNIVERSITY,
        transcriptBase64,
        transcriptName,
        JSON.stringify(carbonCopies || [])
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
  const { carbonCopies } = req.body;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM active_student_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'active-student', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'active-student', numberedRequest);
    const updateResult = await client.query(
      `UPDATE active_student_requests
       SET status = 'verified',
           carbon_copies = COALESCE($1::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [carbonCopies ? JSON.stringify(carbonCopies) : null, id]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      letterNumber: numberedRequest.letter_number || updateResult.rows[0]?.letter_number || '',
      validationToken: numberedRequest.validation_token || updateResult.rows[0]?.validation_token || ''
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan.' });
  } finally {
    client.release();
  }
});

// ==========================================
// SURAT REKOMENDASI AFIRMASI CEMERLANG (su-rek)
// ==========================================

const mapSuRekRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  recipientName: row.recipient_name,
  berdasarkanNo: row.berdasarkan_no,
  perihal: row.perihal,
  lampiran: row.lampiran,
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  accessCode: row.access_code,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
  createdAt: row.created_at
});

const buildSuRekAccessPayload = (row) => ({
  id: row.id,
  accessCode: row.access_code,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  status: row.status,
  letterGeneratedAt: row.letter_generated_at,
  data: {
    name: row.name,
    nim: row.nim,
    email: row.email,
    recipientName: row.recipient_name || '',
    berdasarkanNo: row.berdasarkan_no || '',
    perihal: row.perihal || '',
    lampiran: row.lampiran || '',
    carbonCopies: row.carbon_copies || []
  }
});

const upsertSuRekRequest = async (client, data, targetStatus) => {
  const recentDuplicate = await client.query(
    `SELECT * FROM su_rek_requests 
     WHERE nim = $1 
       AND created_at > NOW() - INTERVAL '1 day'
     ORDER BY created_at DESC LIMIT 1`,
    [data.nim]
  );

  if (recentDuplicate.rows.length > 0) {
    const existing = recentDuplicate.rows[0];
    const accessCode = existing.access_code || createSuRekAccessCode();
    const statusPriority = { 'pending': 1, 'verified': 2, 'sent': 3 };
    const currentStatusLevel = statusPriority[existing.status] || 0;
    const targetStatusLevel = statusPriority[targetStatus] || 0;
    const newStatus = targetStatusLevel > currentStatusLevel ? targetStatus : existing.status;

    const updateResult = await client.query(
      `UPDATE su_rek_requests SET 
         name = $1, email = $2, recipient_name = $3, berdasarkan_no = $4,
         perihal = $5, lampiran = $6, status = $7, carbon_copies = $8::jsonb,
         access_code = COALESCE(access_code, $9),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        data.name, data.email, data.recipient_name, data.berdasarkan_no,
        data.perihal, data.lampiran, newStatus,
        JSON.stringify(data.carbon_copies || []),
        accessCode,
        existing.id
      ]
    );
    return updateResult.rows[0];
  } else {
    const id = `REQ-${Date.now()}`;
    const accessCode = createSuRekAccessCode();
    const insertResult = await client.query(
      `INSERT INTO su_rek_requests (
          id, name, nim, email, recipient_name, berdasarkan_no, perihal, lampiran, status, carbon_copies, access_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      RETURNING *`,
      [
        id, data.name, data.nim, data.email, data.recipient_name, data.berdasarkan_no,
        data.perihal, data.lampiran, targetStatus,
        JSON.stringify(data.carbon_copies || []),
        accessCode
      ]
    );
    return insertResult.rows[0];
  }
};

router.post('/su-rek-requests', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const { name, nim, email } = req.body;
  const recipientEmail = String(email || '').trim();

  if (!name || !nim) {
    return res.status(400).json({ error: 'Nama dan NIM/No Formulir wajib diisi.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({ error: 'Email aktif wajib diisi agar kode akses dapat dikirim.' });
  }

  try {
    await ensureTuInfrastructure();
    const studyProgram = await getStudyProgramByNim(nim);
    if (!studyProgram) {
      return res.status(400).json({ error: 'Kode program studi dari NIM/No Formulir belum terdaftar di database.' });
    }

    const settingsPayload = await getTuSettingsPayload();

    const client = await pool.connect();
    try {
      const requestData = await upsertSuRekRequest(client, {
        name: formatStudentName(name),
        nim: nim.trim(),
        email: recipientEmail,
        recipient_name: settingsPayload.suRekYangTerhormat,
        berdasarkan_no: settingsPayload.suRekBerdasarkanNo,
        perihal: settingsPayload.suRekPerihal,
        lampiran: settingsPayload.suRekLampiran,
        carbon_copies: Array.isArray(settingsPayload.suRekTembusan) ? settingsPayload.suRekTembusan : []
      }, 'pending');

      let accessEmail = { sent: false, error: null, previewUrl: null };
      try {
        const emailInfo = await sendSuRekAccessCodeEmail(requestData, req);
        accessEmail = {
          sent: true,
          error: null,
          previewUrl: emailInfo.previewUrl || null
        };
      } catch (emailErr) {
        console.error('Send su-rek access code email error:', emailErr);
        accessEmail = {
          sent: false,
          error: 'Permohonan tersimpan, tetapi email kode akses gagal dikirim. Simpan kode akses yang tampil di layar.',
          previewUrl: null
        };
      }

      res.json({
        success: true,
        id: requestData.id,
        accessCode: requestData.access_code,
        email: requestData.email,
        accessEmail
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Insert su-rek request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan rekomendasi.' });
  }
});

router.delete('/tu/requests/su-rek/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM su_rek_requests WHERE id = $1 RETURNING id, name, nim, letter_generated_at`, [id]);
    if (result.rowCount === 0) {
      return res.json({ success: true, deleted: null, alreadyDeleted: true });
    }
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await pool.query(
        `UPDATE tu_letter_number_counters
         SET last_sequence = GREATEST(last_sequence - 1, 0)
         WHERE letter_type = 'su-rek' AND year = $1 AND month = $2`,
        [date.getFullYear(), date.getMonth() + 1]
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete su-rek error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengajuan.' });
  }
});

router.post('/tu/requests/su-rek/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM su_rek_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );
    
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        await pool.query(
          `UPDATE tu_letter_number_counters
           SET last_sequence = GREATEST(last_sequence - 1, 0)
           WHERE letter_type = 'su-rek' AND year = $1 AND month = $2`,
          [date.getFullYear(), date.getMonth() + 1]
        );
      }
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete su-rek error:', err);
    res.status(500).json({ error: 'Gagal menghapus data secara batch.' });
  }
});

router.get('/su-rek-requests', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM su_rek_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapSuRekRow) });
  } catch (err) {
    console.error('Get su-rek requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan.' });
  }
});

router.put('/su-rek-requests/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { recipientName, berdasarkanNo, perihal, lampiran, carbonCopies } = req.body;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM su_rek_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'su-rek', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'su-rek', numberedRequest);

    const updateResult = await client.query(
      `UPDATE su_rek_requests
       SET status = 'verified',
           recipient_name = COALESCE($1, recipient_name),
           berdasarkan_no = COALESCE($2, berdasarkan_no),
           perihal = COALESCE($3, perihal),
           lampiran = COALESCE($4, lampiran),
           carbon_copies = COALESCE($5::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        recipientName || null,
        berdasarkanNo || null,
        perihal || null,
        lampiran || null,
        carbonCopies ? JSON.stringify(carbonCopies) : null,
        id
      ]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      letterNumber: numberedRequest.letter_number || updateResult.rows[0]?.letter_number || '',
      validationToken: numberedRequest.validation_token || updateResult.rows[0]?.validation_token || ''
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify su-rek request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan.' });
  } finally {
    client.release();
  }
});

router.post('/tu/public/su-rek/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildSuRekAccessPayload(result.rows[0]) });
  } catch (err) {
    console.error('Public su-rek access lookup error:', err);
    res.status(500).json({ error: 'Gagal membuka surat rekomendasi.' });
  }
});

router.post('/tu/public/su-rek/download', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan.' });
    }

    const requestData = result.rows[0];
    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat rekomendasi belum berstatus resmi/diverifikasi oleh TU.' });
    }

    const pdfBuffer = await buildLetterPdfBuffer('su-rek', requestData, req);
    const safeLetterNumber = (requestData.letter_number || 'surat_rekomendasi').replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public su-rek access download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh PDF surat rekomendasi.' });
  }
});

router.post('/tu/public/su-rek/send-email', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  const config = letterConfig['su-rek'];

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan.' });
    }

    let requestData = result.rows[0];
    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat rekomendasi belum diverifikasi oleh TU.' });
    }

    requestData = await ensureLetterValidationToken(pool, 'su-rek', requestData);
    const pdfBuffer = await buildLetterPdfBuffer('su-rek', requestData, req);
    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME;
    const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: requestData.email,
      subject: `${config.subject} - ${requestData.name}`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
          ${config.emailBody}
          <p><strong>Kode akses surat:</strong> ${escapeXml(requestData.access_code)}</p>
          <p><strong>Validasi surat:</strong> <a href="${validationUrl}">${validationUrl}</a></p>
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
      ]
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[Mailer] Mock Email Preview (Public SuRek):', previewUrl);
    } else {
      console.log(`[Mailer] Surat rekomendasi terkirim ke ${requestData.email} | MessageID: ${info.messageId}`);
    }

    await pool.query(`UPDATE su_rek_requests SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [requestData.id]);

    res.json({
      success: true,
      message: 'Surat rekomendasi berhasil dikirim ke email terdaftar.',
      previewUrl: previewUrl || null,
      validationUrl
    });
  } catch (err) {
    console.error('Public su-rek send-email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email surat rekomendasi.' });
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
    const resolvedName = formatStudentName(name || primaryStudent.name || req.user?.nama || 'Mahasiswa Observasi');
    const resolvedNim = String(nim || primaryStudent.nim || fallbackId).trim();
    const resolvedEmail = String(email || req.user?.email || '').trim() || 'arsip-observasi@core.fti';
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let requestData = await upsertObservationRequest(client, {
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
      }, 'verified');

      requestData = await ensureLetterNumber(client, 'observation', requestData);
      requestData = await ensureLetterValidationToken(client, 'observation', requestData);
      requestData = await ensureObservationAccessCode(client, requestData);

      await client.query('COMMIT');
      res.json({
        success: true,
        id: requestData.id,
        letterNumber: requestData.letter_number,
        validationToken: requestData.validation_token,
        accessCode: requestData.access_code
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
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
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM observation_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'observation', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'observation', numberedRequest);
    await client.query(
      `UPDATE observation_requests
       SET status = 'verified',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ success: true, letterNumber: numberedRequest.letter_number || '', validationToken: numberedRequest.validation_token || '' });
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
    students,
    carbonCopies,
    carbon_copies
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM observation_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Pengajuan observasi tidak ditemukan.' });

    const resolvedCompany = company || companyName || null;
    const normalizedStudents = students ? normalizeObservationStudents(students) : undefined;
    const incomingCc = carbonCopies || carbon_copies;
    const stringifiedCc = incomingCc ? JSON.stringify(incomingCc) : undefined;

    const updateResult = await pool.query(
      `UPDATE observation_requests
       SET recipient_name       = COALESCE($1, recipient_name),
           company              = COALESCE($2, company),
           company_address      = COALESCE($3, company_address),
           course_name          = COALESCE($4, course_name),
           lecturer_name        = COALESCE($5, lecturer_name),
           head_of_program_name = COALESCE($6, head_of_program_name),
           student_members      = COALESCE($7::jsonb, student_members),
           carbon_copies        = COALESCE($8::jsonb, carbon_copies),
           updated_at           = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        recipientName ?? null,
        resolvedCompany,
        companyAddress ?? null,
        courseName ?? null,
        lecturerName ?? null,
        headOfProgramName ?? null,
        normalizedStudents ? JSON.stringify(normalizedStudents) : null,
        stringifiedCc ?? null,
        id
      ]
    );

    res.json({ success: true, data: mapObservationRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch observation request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data surat observasi.' });
  }
});

// Edit data surat rekomendasi (hanya field konten, tidak ubah nomor surat dan status)
router.patch('/tu/requests/su-rek/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const {
    recipientName,
    berdasarkanNo,
    perihal,
    lampiran,
    carbonCopies,
    carbon_copies
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM su_rek_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Pengajuan rekomendasi tidak ditemukan.' });

    const incomingCc = carbonCopies || carbon_copies;
    const stringifiedCc = incomingCc ? JSON.stringify(incomingCc) : undefined;

    const updateResult = await pool.query(
      `UPDATE su_rek_requests
       SET recipient_name = COALESCE($1, recipient_name),
           berdasarkan_no = COALESCE($2, berdasarkan_no),
           perihal = COALESCE($3, perihal),
           lampiran = COALESCE($4, lampiran),
           carbon_copies = COALESCE($5::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        recipientName ?? null,
        berdasarkanNo ?? null,
        perihal ?? null,
        lampiran ?? null,
        stringifiedCc ?? null,
        id
      ]
    );

    res.json({ success: true, data: mapSuRekRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch su-rek request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data surat rekomendasi.' });
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
  const {
    signatureBase64,
    stampBase64,
    currentSemesterCode,
    suRekYangTerhormat,
    suRekBerdasarkanNo,
    suRekPerihal,
    suRekLampiran,
    suRekTembusan,
    letterBackgrounds,
    letterLayouts
  } = req.body;

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
    await upsertSystemSetting(client, 'tu_su_rek_yang_terhormat', suRekYangTerhormat || '');
    await upsertSystemSetting(client, 'tu_su_rek_berdasarkan_no', suRekBerdasarkanNo || '');
    await upsertSystemSetting(client, 'tu_su_rek_perihal', suRekPerihal || '');
    await upsertSystemSetting(client, 'tu_su_rek_lampiran', suRekLampiran || '');
    await upsertSystemSetting(client, 'tu_su_rek_tembusan', JSON.stringify(suRekTembusan || []));
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
      requestData = await ensureLetterValidationToken(client, type, requestData);
      await client.query('COMMIT');
      client.release();
    } catch (txErr) {
      await client.query('ROLLBACK');
      client.release();
      throw txErr;
    }

    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);

    const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME;
    const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;
    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const accessCodeBlock = requestData.access_code
      ? `<p><strong>Kode akses surat:</strong> ${escapeXml(requestData.access_code)}</p>`
      : '';
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: requestData.email,
      subject: `${config.subject} - ${requestData.name}`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Halo, ${requestData.name} (${requestData.nim})</h2>
          ${config.emailBody}
          ${accessCodeBlock}
          <p><strong>Validasi surat:</strong> <a href="${validationUrl}">${validationUrl}</a></p>
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

    res.json({
      success: true,
      message: 'Email berhasil dikirim',
      letterNumber: requestData.letter_number,
      validationToken: requestData.validation_token,
      validationUrl
    });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email. Pastikan konfigurasi SMTP di .env sudah benar.' });
  }
});

router.post('/tu/requests/:type/:id/validation-token', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
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

    if (!['verified', 'sent'].includes(result.rows[0].status)) {
      return res.status(400).json({ error: 'Token validasi hanya dapat dibuat untuk surat yang sudah diverifikasi.' });
    }

    const requestData = await ensureLetterValidationToken(pool, type, result.rows[0]);
    res.json({
      success: true,
      validationToken: requestData.validation_token,
      validationUrl: buildPublicValidationUrl(req, requestData.validation_token)
    });
  } catch (err) {
    console.error('Create validation token error:', err);
    res.status(500).json({ error: 'Gagal membuat token validasi surat.' });
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
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    await client.query('COMMIT');

    res.json({ success: true, letterNumber: requestData.letter_number, accessCode: requestData.access_code, validationToken: requestData.validation_token });
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
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Observation-Access-Code', requestData.access_code || '');
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
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    res.json({
      success: true,
      qrUrl: validationUrl,
      validationUrl,
      validationToken: requestData.validation_token,
      accessCode: requestData.access_code,
      letterNumber: requestData.letter_number,
      expiresAt: null
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
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    const config = letterConfig.observation;
    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const pdfFilename = `SuratObservasi_${safeCompanyName}_${requestData.letter_number?.replace(/\//g, '_') || requestData.nim}.pdf`;

    const fromName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME;
    const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: targetEmail,
      subject: `${config.subject} - ${resolvedCompanyName || 'Observasi'}`,
      text: `Halo, ${resolvedName} (${resolvedNim})\n\nPermohonan Surat Pengantar Observasi Anda telah disetujui dan diproses oleh Tata Usaha. Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.\n\nValidasi surat: ${validationUrl}\nKode akses surat: ${requestData.access_code}\nSimpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.\n\nSalam,\nBagian Tata Usaha\nFakultas Teknologi Informasi UKSW`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Halo, ${resolvedName} (${resolvedNim})</h2>
          ${config.emailBody}
          <p><strong>Validasi surat:</strong> <a href="${validationUrl}">${validationUrl}</a></p>
          <p><strong>Kode akses surat:</strong> ${requestData.access_code}</p>
          <p>Simpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.</p>
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
      letterNumber: requestData.letter_number,
      accessCode: requestData.access_code,
      validationToken: requestData.validation_token,
      validationUrl
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Mailer] Observation send-email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email surat observasi. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

router.get('/tu/public/letter-validation/:token', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).json({ error: 'Token validasi tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const [activeResult, observationResult, suRekResult] = await Promise.all([
      pool.query(`SELECT * FROM active_student_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM observation_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM su_rek_requests WHERE validation_token = $1 LIMIT 1`, [token])
    ]);

    const tuSettings = await getTuSettingsPayload();
    const backgroundImageBase64 = getSharedLetterBackground(tuSettings.letterBackgrounds).imageBase64 || '';

    if (activeResult.rows.length > 0) {
      let deanName = 'Nama Dekan Belum Diatur';
      let deanTitle = 'Dekan';
      try {
        const deanResult = await pool.query(`
          SELECT nama, jabatan
          FROM lecturer
          WHERE jabatan ILIKE 'Dekan%' OR jabatan ILIKE 'Wakil Dekan%'
          ORDER BY CASE WHEN jabatan ILIKE 'Dekan%' THEN 0 ELSE 1 END, nama ASC
          LIMIT 1
        `);
        if (deanResult.rows.length > 0) {
          deanName = deanResult.rows[0].nama;
          deanTitle = deanResult.rows[0].jabatan;
        }
      } catch (e) {
        console.error('Failed to fetch Dean data:', e);
      }

      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['active-student'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('active-student', activeResult.rows[0], req);
      letterPayload.signer = { name: deanName, title: deanTitle };
      const html = await buildLetterHtml('active-student', activeResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (observationResult.rows.length > 0) {
      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['observation'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('observation', observationResult.rows[0], req);
      letterPayload.signer = { name: observationResult.rows[0].lecturer_name || 'Dosen Pengampu', title: 'Pengampu Mata Kuliah' };
      const html = await buildLetterHtml('observation', observationResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (suRekResult.rows.length > 0) {
      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['su-rek'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('su-rek', suRekResult.rows[0], req);

      letterPayload.signer = await getRecommendationSigner();
      const html = await buildLetterHtml('su-rek', suRekResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    return res.status(404).json({ error: 'Surat tidak ditemukan atau token validasi tidak terdaftar.' });
  } catch (err) {
    console.error('Public letter validation error:', err);
    res.status(500).json({ error: 'Gagal memvalidasi surat.' });
  }
});

router.get('/tu/public/letter-validation/:token/download', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).json({ error: 'Token validasi tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const [activeResult, observationResult, suRekResult] = await Promise.all([
      pool.query(`SELECT * FROM active_student_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM observation_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM su_rek_requests WHERE validation_token = $1 LIMIT 1`, [token])
    ]);

    const type = activeResult.rows.length > 0 ? 'active-student' : observationResult.rows.length > 0 ? 'observation' : suRekResult.rows.length > 0 ? 'su-rek' : null;
    const requestData = activeResult.rows[0] || observationResult.rows[0] || suRekResult.rows[0];

    if (!type || !requestData) {
      return res.status(404).json({ error: 'Surat tidak ditemukan atau token validasi tidak terdaftar.' });
    }

    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat belum berstatus resmi.' });
    }

    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);
    const config = letterConfig[type];
    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public letter validation download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh surat tervalidasi.' });
  }
});

router.post('/tu/public/observation-letter/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM observation_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildObservationAccessPayload(result.rows[0]) });
  } catch (err) {
    console.error('Public observation access lookup error:', err);
    res.status(500).json({ error: 'Gagal membuka surat observasi.' });
  }
});

router.patch('/tu/public/observation-letter/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    carbonCopies,
    carbon_copies
  } = req.body;

  try {
    await ensureTuInfrastructure();
    // Update konten surat saja; letter_number tidak akan berubah.
    const updateResult = await pool.query(
      `UPDATE observation_requests
       SET recipient_name = $1,
           company = $2,
           company_address = $3,
           course_name = $4,
           lecturer_name = $5,
           head_of_program_name = $6,
           student_members = $7::jsonb,
           carbon_copies = $8::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE access_code = $9
       RETURNING *`,
      [
        String(recipientName || '').trim() || null,
        String(companyName || '').trim() || null,
        String(companyAddress || '').trim() || null,
        String(courseName || '').trim() || null,
        String(lecturerName || '').trim() || null,
        String(headOfProgramName || '').trim() || null,
        JSON.stringify(normalizeObservationStudents(students)),
        JSON.stringify(carbonCopies || carbon_copies || []),
        accessCode
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildObservationAccessPayload(updateResult.rows[0]) });
  } catch (err) {
    console.error('Public observation access update error:', err);
    res.status(500).json({ error: 'Gagal menyimpan perubahan surat observasi.' });
  }
});

router.post('/tu/public/observation-letter/download', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM observation_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    const requestData = result.rows[0];
    const pdfBuffer = await buildObservationPdfBuffer(requestData, req);
    const safeCompanyName = (requestData.company || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public observation access download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh ulang surat observasi.' });
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

    const requestData = await ensureLetterValidationToken(client, 'observation', result.rows[0]);
    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
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
    if (!['verified', 'sent'].includes(result.rows[0].status)) {
      return res.status(403).json({ error: 'Surat belum berstatus resmi.' });
    }

    const requestData = await ensureLetterValidationToken(pool, type, result.rows[0]);
    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);

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

router.get('/su-rek/summary', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT status, COUNT(*) as count FROM su_rek_requests GROUP BY status`);

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
    console.error('Get su-rek summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil data ringkasan surat rekomendasi.' });
  }
});

export default router;
