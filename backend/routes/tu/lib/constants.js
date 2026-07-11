export const TU_ACCESS_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];
export const TU_ADMIN_ROLES = ['Admin', 'Admin TU'];
export const TU_SUBMIT_ROLES = ['Admin', 'Laboran', 'Dosen', 'Supervisor', 'User TU', 'Admin TU'];

export const TU_SETTINGS_KEYS = [
  'tu_dean_signature_base64',
  'tu_faculty_stamp_base64',
  'tu_current_semester_code',
  'tu_counseling_subject',
  'tu_counseling_recipient_name',
  'tu_counseling_referral_unit',
  'tu_research_assignment_type',
  'tu_research_advisor_title',
  'tu_research_advisor_title_first',
  'tu_research_advisor_title_second',
  'tu_interview_assignment_type',
  'tu_interview_advisor_title',
  'tu_interview_advisor_title_first',
  'tu_interview_advisor_title_second',
  'tu_permission_assignment_type',
  'tu_permission_advisor_title',
  'tu_permission_advisor_title_first',
  'tu_permission_advisor_title_second',
  'tu_su_rek_yang_terhormat',
  'tu_su_rek_berdasarkan_no',
  'tu_su_rek_perihal',
  'tu_su_rek_lampiran',
  'tu_su_rek_tembusan'
];

export const QR_DOWNLOAD_TOKEN_TTL_HOURS = 24;

export const LETTER_TYPE_TO_CLIENT_KEY = {
  'active-student': 'activeStudent',
  observation: 'observation',
  counseling: 'counseling',
  research: 'research',
  interview: 'interview',
  permission: 'permission',
  'su-rek': 'suRek'
};

export const SHARED_LETTER_BACKGROUND_TYPE = 'document';

export const LETTER_TYPE_TO_CODE = {
  'active-student': 'S.Ket',
  observation: 'FTI-OBS',
  counseling: 'FTI',
  research: 'FTI/Penelitian',
  interview: 'FTI/Wawancara',
  permission: 'FTI/Perizinan',
  'su-rek': 'Su.Rek'
};

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

export const RESEARCH_LETTER_KIND = 'research';
export const INTERVIEW_LETTER_KIND = 'interview';
export const PERMISSION_LETTER_KIND = 'permission';
export const OBSERVATION_ACCESS_CODE_PREFIX = 'OBS';
export const RESEARCH_ACCESS_CODE_PREFIX = 'PEN';
export const PERMISSION_ACCESS_CODE_PREFIX = 'IZN';
export const SUREK_ACCESS_CODE_PREFIX = 'REK';
export const OBSERVATION_ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const VALIDATION_TOKEN_BYTES = 24;
