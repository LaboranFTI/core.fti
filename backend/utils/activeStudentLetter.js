export const DEFAULT_FACULTY = 'Teknologi Informasi';
export const DEFAULT_UNIVERSITY = 'Kristen Satya Wacana';

export const getStudyProgramCodeFromNim = (nim = '') => {
  const normalizedNim = String(nim).replace(/\s+/g, '');
  return normalizedNim.slice(0, 2);
};

export const mapStudyProgramRow = (row) => {
  if (!row) return null;

  return {
    studyProgramLevel: row.level,
    studyProgramName: row.name
  };
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
