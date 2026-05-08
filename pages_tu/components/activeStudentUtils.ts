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

export const deriveStudyProgramFromNim = (nim: string) => {
  const normalizedNim = String(nim || '').replace(/\s+/g, '');
  return STUDY_PROGRAM_MAP[normalizedNim.slice(0, 2) as keyof typeof STUDY_PROGRAM_MAP] || null;
};

export const formatSiasatBirthDate = (rawDate?: string) => {
  if (!rawDate) return '';

  const match = String(rawDate).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return rawDate;

  const [, year, month, day] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsedDate);
};

export const buildBirthPlaceAndDate = (birthPlace?: string, birthDate?: string) => {
  return [birthPlace, formatSiasatBirthDate(birthDate)]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};
