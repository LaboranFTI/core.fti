import { pool } from './db-infrastructure.js';
import { getStudyProgramCodeFromNim, mapStudyProgramRow } from '../../../utils/activeStudentLetter.js';

const formatProgramLevelShort = (level) => {
  const map = {
    'Diploma Tiga': 'D3',
    Sarjana: 'S1',
    Magister: 'S2',
    Doktor: 'S3'
  };
  return map[level] || level || '';
};

const formatFacultyProgram = ({ faculty, studyProgramLevel, studyProgramName }) => {
  const facultyLabel = faculty || 'FTI';
  const programParts = [formatProgramLevelShort(studyProgramLevel), studyProgramName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return `${facultyLabel}${programParts.length ? ` - ${programParts.join(' ')}` : ''}`;
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

const getDeanSigner = async () => {
  let name = 'Nama Dekan Belum Diatur';
  let title = 'Dekan';

  try {
    const result = await pool.query(`
      SELECT nama, jabatan
      FROM lecturer
      WHERE jabatan ILIKE 'Dekan%' OR jabatan ILIKE 'Wakil Dekan%'
      ORDER BY CASE WHEN jabatan ILIKE 'Dekan%' THEN 0 ELSE 1 END, nama ASC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      name = result.rows[0].nama;
      title = result.rows[0].jabatan;
    }
  } catch (e) {
    console.error('Failed to fetch Dean data:', e);
  }

  return { name, title };
};






export {
  formatProgramLevelShort,
  formatFacultyProgram,
  getSemesterMeta,
  getStudyProgramByNim,
  getRecommendationSigner,
  getDeanSigner
};
