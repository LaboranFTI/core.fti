ALTER TABLE active_student_requests
  ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP;

ALTER TABLE observation_requests
  ADD COLUMN IF NOT EXISTS letter_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS letter_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS letter_generated_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS tu_letter_backgrounds (
  id SERIAL PRIMARY KEY,
  letter_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(100) DEFAULT 'image/png',
  image_base64 TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(letter_type)
);

INSERT INTO tu_letter_backgrounds (letter_type, file_name, mime_type, image_base64)
SELECT 'document', file_name, mime_type, image_base64
FROM tu_letter_backgrounds
WHERE letter_type IN ('active-student', 'observation')
ORDER BY CASE letter_type WHEN 'active-student' THEN 0 ELSE 1 END
LIMIT 1
ON CONFLICT (letter_type) DO NOTHING;

DELETE FROM tu_letter_backgrounds
WHERE letter_type IN ('active-student', 'observation')
  AND EXISTS (
    SELECT 1 FROM tu_letter_backgrounds WHERE letter_type = 'document'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_tu_letter_backgrounds_updated_at'
  ) THEN
    CREATE TRIGGER update_tu_letter_backgrounds_updated_at
    BEFORE UPDATE ON tu_letter_backgrounds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tu_letter_number_counters (
  id SERIAL PRIMARY KEY,
  letter_type VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  last_letter_number VARCHAR(100),
  last_generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(letter_type, year, month)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_tu_letter_number_counters_updated_at'
  ) THEN
    CREATE TRIGGER update_tu_letter_number_counters_updated_at
    BEFORE UPDATE ON tu_letter_number_counters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tu_letter_layouts (
  id SERIAL PRIMARY KEY,
  letter_type VARCHAR(50) NOT NULL,
  margin_top_mm NUMERIC(6,2) NOT NULL DEFAULT 40,
  margin_right_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
  margin_bottom_mm NUMERIC(6,2) NOT NULL DEFAULT 26,
  margin_left_mm NUMERIC(6,2) NOT NULL DEFAULT 22,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(letter_type)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_tu_letter_layouts_updated_at'
  ) THEN
    CREATE TRIGGER update_tu_letter_layouts_updated_at
    BEFORE UPDATE ON tu_letter_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_student_requests_letter_number_unique
ON active_student_requests(letter_number)
WHERE letter_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_requests_letter_number_unique
ON observation_requests(letter_number)
WHERE letter_number IS NOT NULL;
