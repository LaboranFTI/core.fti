import { LetterAsset, LetterLayout, TULetterBackgrounds, TULetterLayouts } from '../types';

export type LetterLayoutKey = 'activeStudent' | 'observation' | 'counseling' | 'research' | 'interview' | 'permission' | 'suRek';

export const DEFAULT_COUNSELING_SUBJECT = 'Pengantar Konseling';
export const DEFAULT_COUNSELING_RECIPIENT_NAME = [
  'Pusat Layanan Konseling',
  'Fakultas Psikologi',
  'Universitas Kristen Satya Wacana',
  'Salatiga'
].join('\n');
export const DEFAULT_COUNSELING_REFERRAL_UNIT = 'Pusat Layanan Psikologi Universitas Kristen Satya Wacana.';
export const DEFAULT_RESEARCH_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
export const DEFAULT_RESEARCH_ADVISOR_TITLE = 'Dosen Pembimbing';
export const DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
export const DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';
export const DEFAULT_INTERVIEW_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
export const DEFAULT_INTERVIEW_ADVISOR_TITLE = 'Dosen Pembimbing';
export const DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
export const DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';
export const DEFAULT_PERMISSION_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
export const DEFAULT_PERMISSION_ADVISOR_TITLE = 'Dosen Pembimbing';
export const DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
export const DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';

export const DEFAULT_LETTER_LAYOUTS: Record<LetterLayoutKey, LetterLayout> = {
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  counseling: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  research: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  interview: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  permission: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  suRek: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
};

const PREVIEW_LETTER_TYPE_CODES: Record<Exclude<LetterLayoutKey, 'suRek'>, string> = {
  activeStudent: 'S.Ket',
  observation: 'FTI-OBS',
  counseling: 'FTI',
  research: 'FTI/Penelitian',
  interview: 'FTI/Wawancara',
  permission: 'FTI/Perizinan'
};

export const createEmptyLetterAsset = (): LetterAsset => ({
  imageBase64: '',
  fileName: '',
  mimeType: 'image/png'
});

export const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  document: createEmptyLetterAsset(),
  activeStudent: createEmptyLetterAsset(),
  observation: createEmptyLetterAsset(),
  counseling: createEmptyLetterAsset(),
  research: createEmptyLetterAsset(),
  suRek: createEmptyLetterAsset()
});

export const getDefaultLetterLayout = (key: LetterLayoutKey): LetterLayout => ({
  ...DEFAULT_LETTER_LAYOUTS[key]
});

export const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: getDefaultLetterLayout('activeStudent'),
  observation: getDefaultLetterLayout('observation'),
  counseling: getDefaultLetterLayout('counseling'),
  research: getDefaultLetterLayout('research'),
  interview: getDefaultLetterLayout('interview'),
  permission: getDefaultLetterLayout('permission'),
  suRek: getDefaultLetterLayout('suRek')
});

export const normalizeLetterLayouts = (layouts?: Partial<TULetterLayouts>): TULetterLayouts => ({
  activeStudent: { ...getDefaultLetterLayout('activeStudent'), ...layouts?.activeStudent },
  observation: { ...getDefaultLetterLayout('observation'), ...layouts?.observation },
  counseling: { ...getDefaultLetterLayout('counseling'), ...layouts?.counseling },
  research: { ...getDefaultLetterLayout('research'), ...layouts?.research },
  interview: { ...getDefaultLetterLayout('interview'), ...layouts?.interview },
  permission: { ...getDefaultLetterLayout('permission'), ...layouts?.permission },
  suRek: { ...getDefaultLetterLayout('suRek'), ...layouts?.suRek }
});

export const normalizeLetterBackgrounds = (backgrounds?: Partial<TULetterBackgrounds>): TULetterBackgrounds => {
  const empty = createEmptyLetterBackgrounds();
  const sharedBackground = backgrounds?.document?.imageBase64
    ? backgrounds.document
    : backgrounds?.activeStudent?.imageBase64
      ? backgrounds.activeStudent
      : backgrounds?.observation?.imageBase64
        ? backgrounds.observation
        : backgrounds?.counseling?.imageBase64
          ? backgrounds.counseling
          : backgrounds?.research?.imageBase64
            ? backgrounds.research
            : backgrounds?.suRek?.imageBase64
              ? backgrounds.suRek
              : empty.document;

  return {
    document: { ...empty.document, ...sharedBackground },
    activeStudent: { ...empty.activeStudent, ...sharedBackground },
    observation: { ...empty.observation, ...sharedBackground },
    counseling: { ...empty.counseling, ...sharedBackground },
    research: { ...empty.research, ...sharedBackground },
    suRek: { ...empty.suRek, ...sharedBackground }
  };
};

export const formatPreviewLetterNumber = (key: LetterLayoutKey, sequence: number, date = new Date()) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (key === 'suRek') {
    return `${paddedSequence}/FTI/Su.Rek/${month}/${year}`;
  }
  if (key === 'counseling') {
    return `${paddedSequence}/FTI/${month}/${year}`;
  }

  return `${paddedSequence}/${PREVIEW_LETTER_TYPE_CODES[key]}/${String(month).padStart(2, '0')}/${year}`;
};

export const formatSemesterLabel = (semesterCode: string) => {
  if (!/^\d{4}[123]$/.test(semesterCode)) return 'Belum diatur';

  const year = parseInt(semesterCode.slice(0, 4), 10);
  const type = semesterCode.slice(4);

  if (type === '1') return `Ganjil ${year}/${year + 1}`;
  if (type === '2') return `Genap ${year - 1}/${year}`;
  return `Antara ${year - 1}/${year}`;
};

export const getSemesterMeta = (semesterCode: string) => {
  if (!/^\d{4}[123]$/.test(semesterCode)) {
    return { semesterName: undefined, academicYear: undefined };
  }

  const label = formatSemesterLabel(semesterCode);
  const [semesterName, academicYear] = label.split(' ');
  return { semesterName, academicYear };
};

export const letterLayoutSections: Array<{
  key: LetterLayoutKey;
  title: string;
  description: string;
}> = [
  {
    key: 'activeStudent',
    title: 'Surat Aktif Kuliah',
    description: 'Atur batas area tulisan untuk template surat aktif kuliah.'
  },
  {
    key: 'observation',
    title: 'Surat Observasi',
    description: 'Atur batas area tulisan untuk template surat observasi.'
  },
  {
    key: 'counseling',
    title: 'Surat Konseling',
    description: 'Atur batas area tulisan untuk template surat pengantar konseling.'
  },
  {
    key: 'research',
    title: 'Surat Penelitian',
    description: 'Atur batas area tulisan untuk template surat rekomendasi penelitian.'
  },
  {
    key: 'interview',
    title: 'Surat Wawancara',
    description: 'Atur batas area tulisan untuk template surat izin wawancara.'
  },
  {
    key: 'permission',
    title: 'Surat Perizinan',
    description: 'Atur batas area tulisan untuk template surat perizinan tugas akhir.'
  },
  {
    key: 'suRek',
    title: 'Surat Rekomendasi',
    description: 'Atur batas area tulisan untuk template surat rekomendasi.'
  }
];
