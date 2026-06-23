export const DEFAULT_FACULTY = 'Teknologi Informasi';
export const DEFAULT_UNIVERSITY = 'Kristen Satya Wacana';

interface StudyProgramLike {
  id: string;
  name: string;
  level: string;
}

export const getStudyProgramCodeFromNim = (nim: string) => {
  const normalizedNim = String(nim || '').replace(/\s+/g, '');
  return normalizedNim.slice(0, 2);
};

export const findStudyProgramByNim = (nim: string, studyPrograms: StudyProgramLike[]) => {
  const studyProgramCode = getStudyProgramCodeFromNim(nim);
  const studyProgram = studyPrograms.find((program) => String(program.id) === studyProgramCode);

  return studyProgram
    ? { studyProgramLevel: studyProgram.level, studyProgramName: studyProgram.name }
    : null;
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
