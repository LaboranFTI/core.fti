import { pool } from '../../../config/database.js';

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
        semester VARCHAR(10),
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
        rejection_reason TEXT,
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
      ADD COLUMN IF NOT EXISTS semester VARCHAR(10),
      ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS validation_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
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
        rejection_reason TEXT,
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
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS counseling_requests (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        subject VARCHAR(255),
        recipient_name TEXT,
        referral_unit VARCHAR(255),
        study_program_level VARCHAR(100),
        study_program_name VARCHAR(255),
        faculty VARCHAR(255),
        signature_base64 TEXT,
        stamp_base64 TEXT,
        letter_number VARCHAR(100),
        letter_sequence INTEGER,
        letter_generated_at TIMESTAMP,
        validation_token VARCHAR(64),
        qr_download_token_hash VARCHAR(64),
        qr_download_token_expires_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'pending',
        rejection_reason TEXT,
          carbon_copies JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE counseling_requests
      ADD COLUMN IF NOT EXISTS subject VARCHAR(255),
      ADD COLUMN IF NOT EXISTS recipient_name TEXT,
      ADD COLUMN IF NOT EXISTS referral_unit VARCHAR(255),
      ADD COLUMN IF NOT EXISTS study_program_level VARCHAR(100),
      ADD COLUMN IF NOT EXISTS study_program_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS faculty VARCHAR(255),
      ADD COLUMN IF NOT EXISTS signature_base64 TEXT,
      ADD COLUMN IF NOT EXISTS stamp_base64 TEXT,
      ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
      ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS validation_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF to_regclass('ta_letter_requests') IS NULL
          AND to_regclass('research_requests') IS NOT NULL THEN
          ALTER TABLE research_requests RENAME TO ta_letter_requests;
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ta_letter_requests (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        nim VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        recipient_name VARCHAR(255),
        recipient_title VARCHAR(255),
        destination_place VARCHAR(255),
        destination_address TEXT,
        research_place VARCHAR(255),
        research_address TEXT,
        assignment_type VARCHAR(255),
        research_title TEXT,
        permission_purpose VARCHAR(255),
        contact_person VARCHAR(255),
        study_program_level VARCHAR(100),
        study_program_name VARCHAR(255),
        letter_kind VARCHAR(30) DEFAULT 'research',
        advisors JSONB NOT NULL DEFAULT '[]'::jsonb,
        include_research_place BOOLEAN DEFAULT TRUE,
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
        rejection_reason TEXT,
          carbon_copies JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE ta_letter_requests
      ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS recipient_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS destination_place VARCHAR(255),
      ADD COLUMN IF NOT EXISTS destination_address TEXT,
      ADD COLUMN IF NOT EXISTS research_place VARCHAR(255),
      ADD COLUMN IF NOT EXISTS research_address TEXT,
      ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS research_title TEXT,
      ADD COLUMN IF NOT EXISTS permission_purpose VARCHAR(255),
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
      ADD COLUMN IF NOT EXISTS study_program_level VARCHAR(100),
      ADD COLUMN IF NOT EXISTS study_program_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS letter_kind VARCHAR(30) DEFAULT 'research',
      ADD COLUMN IF NOT EXISTS advisors JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS include_research_place BOOLEAN DEFAULT TRUE,
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
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS carbon_copies JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_backgrounds (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('document', 'active-student', 'observation', 'counseling', 'research', 'su-rek')),
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
            AND (pg_get_constraintdef(oid) NOT LIKE '%su-rek%' OR pg_get_constraintdef(oid) NOT LIKE '%counseling%' OR pg_get_constraintdef(oid) NOT LIKE '%research%')
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
            CHECK (letter_type IN ('document', 'active-student', 'observation', 'counseling', 'research', 'su-rek'));
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_number_counters (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation', 'counseling', 'research', 'interview', 'permission', 'su-rek')),
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
            AND (pg_get_constraintdef(oid) NOT LIKE '%su-rek%' OR pg_get_constraintdef(oid) NOT LIKE '%counseling%' OR pg_get_constraintdef(oid) NOT LIKE '%research%' OR pg_get_constraintdef(oid) NOT LIKE '%interview%' OR pg_get_constraintdef(oid) NOT LIKE '%permission%')
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
            CHECK (letter_type IN ('active-student', 'observation', 'counseling', 'research', 'interview', 'permission', 'su-rek'));
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tu_letter_layouts (
        id SERIAL PRIMARY KEY,
        letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN ('active-student', 'observation', 'counseling', 'research', 'su-rek')),
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
            AND (pg_get_constraintdef(oid) NOT LIKE '%su-rek%' OR pg_get_constraintdef(oid) NOT LIKE '%counseling%' OR pg_get_constraintdef(oid) NOT LIKE '%research%')
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
            CHECK (letter_type IN ('active-student', 'observation', 'counseling', 'research', 'su-rek'));
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
        rejection_reason TEXT,
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
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
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
      DO $$
      BEGIN
        IF to_regclass('idx_ta_letter_requests_letter_number_unique') IS NULL
          AND EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = 'idx_research_requests_letter_number_unique'
              AND i.indrelid = 'ta_letter_requests'::regclass
          ) THEN
          ALTER INDEX idx_research_requests_letter_number_unique RENAME TO idx_ta_letter_requests_letter_number_unique;
        END IF;

        IF to_regclass('idx_ta_letter_requests_validation_token_unique') IS NULL
          AND EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = 'idx_research_requests_validation_token_unique'
              AND i.indrelid = 'ta_letter_requests'::regclass
          ) THEN
          ALTER INDEX idx_research_requests_validation_token_unique RENAME TO idx_ta_letter_requests_validation_token_unique;
        END IF;

        IF to_regclass('idx_ta_letter_requests_access_code_unique') IS NULL
          AND EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = 'idx_research_requests_access_code_unique'
              AND i.indrelid = 'ta_letter_requests'::regclass
          ) THEN
          ALTER INDEX idx_research_requests_access_code_unique RENAME TO idx_ta_letter_requests_access_code_unique;
        END IF;

        IF to_regclass('idx_ta_letter_requests_qr_download_token_hash') IS NULL
          AND EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indexrelid
            WHERE c.relname = 'idx_research_requests_qr_download_token_hash'
              AND i.indrelid = 'ta_letter_requests'::regclass
          ) THEN
          ALTER INDEX idx_research_requests_qr_download_token_hash RENAME TO idx_ta_letter_requests_qr_download_token_hash;
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ta_letter_requests_letter_number_unique
      ON ta_letter_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ta_letter_requests_validation_token_unique
      ON ta_letter_requests(validation_token)
      WHERE validation_token IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ta_letter_requests_access_code_unique
      ON ta_letter_requests(access_code)
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_counseling_requests_letter_number_unique
      ON counseling_requests(letter_number)
      WHERE letter_number IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_counseling_requests_validation_token_unique
      ON counseling_requests(validation_token)
      WHERE validation_token IS NOT NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_counseling_requests_qr_download_token_hash
      ON counseling_requests(qr_download_token_hash)
      WHERE qr_download_token_hash IS NOT NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_requests_qr_download_token_hash
      ON observation_requests(qr_download_token_hash)
      WHERE qr_download_token_hash IS NOT NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ta_letter_requests_qr_download_token_hash
      ON ta_letter_requests(qr_download_token_hash)
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
        ('tu_counseling_subject', 'Pengantar Konseling'),
        ('tu_counseling_recipient_name', 'Pusat Layanan Konseling\nFakultas Psikologi\nUniversitas Kristen Satya Wacana\nSalatiga'),
        ('tu_counseling_referral_unit', 'Pusat Layanan Psikologi Universitas Kristen Satya Wacana.'),
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
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_counseling_requests_updated_at'
        ) THEN
          CREATE TRIGGER update_counseling_requests_updated_at
          BEFORE UPDATE ON counseling_requests
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname IN ('update_ta_letter_requests_updated_at', 'update_research_requests_updated_at')
            AND tgrelid = 'ta_letter_requests'::regclass
        ) THEN
          CREATE TRIGGER update_ta_letter_requests_updated_at
          BEFORE UPDATE ON ta_letter_requests
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






export {
  pool,
  ensureTuInfrastructure
};
