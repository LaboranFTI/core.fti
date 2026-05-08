export const DEFAULT_FACULTY = 'Teknologi Informasi';
export const DEFAULT_UNIVERSITY = 'Kristen Satya Wacana';

const STUDY_PROGRAM_MAP = Object.freeze({
  '56': { studyProgramLevel: 'Diploma Tiga', studyProgramName: 'Teknik Informatika' },
  '60': { studyProgramLevel: 'Sarjana', studyProgramName: 'Hubungan Masyarakat' },
  '67': { studyProgramLevel: 'Sarjana', studyProgramName: 'Teknik Informatika' },
  '68': { studyProgramLevel: 'Sarjana', studyProgramName: 'Sistem Informasi' },
  '69': { studyProgramLevel: 'Sarjana', studyProgramName: 'Desain Komunikasi Visual' },
  '70': { studyProgramLevel: 'Sarjana', studyProgramName: 'Pendidikan Teknik Informatika dan Komputer' },
  '74': { studyProgramLevel: 'Sarjana', studyProgramName: 'Perpustakaan dan Sains Informasi' },
  '84': { studyProgramLevel: 'Sarjana', studyProgramName: 'Bisnis Digital' },
  '97': { studyProgramLevel: 'Magister', studyProgramName: 'Sistem Informasi' },
  '98': { studyProgramLevel: 'Doktor', studyProgramName: 'Ilmu Komputer' }
});

export const deriveStudyProgramFromNim = (nim = '') => {
  const normalizedNim = String(nim).replace(/\s+/g, '');
  return STUDY_PROGRAM_MAP[normalizedNim.slice(0, 2)] || null;
};

export const formatStudentName = (rawName) => {
  if (!rawName) return '';

  return String(rawName)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s'-])([a-zà-ÿ])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
};

export const formatBirthDateId = (rawDate) => {
  if (!rawDate) return '';

  const normalized = String(rawDate).trim();
  const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return normalized;

  const [, year, month, day] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsedDate);
};

export const buildBirthPlaceAndDate = (birthPlace, birthDate) => {
  const parts = [birthPlace, formatBirthDateId(birthDate)]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return parts.join(', ');
};
