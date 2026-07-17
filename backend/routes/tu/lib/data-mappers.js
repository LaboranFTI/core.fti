import { formatPublicDate, buildPublicValidationUrl } from './url-builders.js';
import { normalizeResearchAdvisors } from './domain-research.js';
import { normalizeObservationStudents, buildObservationStudentRowsHtml } from './domain-observation.js';

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

const mapCounselingRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  subject: row.subject,
  recipientName: row.recipient_name,
  referralUnit: row.referral_unit,
  studyProgramLevel: row.study_program_level,
  studyProgramName: row.study_program_name,
  faculty: row.faculty,
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
  createdAt: row.created_at
});

const mapResearchRow = (row) => ({
  id: row.id,
  letterKind: row.letter_kind || RESEARCH_LETTER_KIND,
  name: row.name,
  nim: row.nim,
  email: row.email,
  recipientName: row.recipient_name,
  recipientTitle: row.recipient_title,
  destinationPlace: row.destination_place || row.research_place || '',
  destinationAddress: row.destination_address || row.research_address || '',
  researchPlace: row.research_place || '',
  assignmentType: row.assignment_type,
  researchTitle: row.research_title,
  permissionPurpose: row.permission_purpose,
  contactPerson: row.contact_person,
  studyProgramLevel: row.study_program_level,
  studyProgramName: row.study_program_name,
  advisors: normalizeResearchAdvisors(row.advisors),
  includeResearchPlace: row.include_research_place !== false,
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  accessCode: row.access_code,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
  rejectionReason: row.rejection_reason,
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

const buildResearchAccessPayload = (row) => ({
  accessCode: row.access_code,
  letterKind: row.letter_kind || RESEARCH_LETTER_KIND,
  letterNumber: row.letter_number,
  status: row.status,
  letterGeneratedAt: row.letter_generated_at,
  data: {
    name: row.name || '',
    nim: row.nim || '',
    email: row.email || '',
    recipientName: row.recipient_name || '',
    recipientTitle: row.recipient_title || '',
    destinationPlace: row.destination_place || row.research_place || '',
    destinationAddress: row.destination_address || row.research_address || '',
    researchPlace: row.research_place || '',
    assignmentType: row.assignment_type || '',
    researchTitle: row.research_title || '',
    permissionPurpose: row.permission_purpose || '',
    contactPerson: row.contact_person || '',
    studyProgramName: row.study_program_name || '',
    studyProgramLevel: row.study_program_level || '',
    advisors: normalizeResearchAdvisors(row.advisors),
    includeResearchPlace: row.include_research_place !== false,
    letterKind: row.letter_kind || RESEARCH_LETTER_KIND,
    carbonCopies: row.carbon_copies || []
  }
});

const buildLetterValidationPayload = (type, row, req) => {
  const isObservation = type === 'observation';
  const isCounseling = type === 'counseling';
  const isResearch = type === 'research';
  const isInterview = type === 'interview';
  const isPermission = type === 'permission';
  const isResearchLike = isResearch || isInterview || isPermission;
  const isSuRek = type === 'su-rek';
  const students = isObservation ? normalizeObservationStudents(row.student_members).map(s => ({ ...s, nim: maskNim(s.nim) })) : [];
  const primaryStudent = students[0] || { name: row.name, nim: maskNim(row.nim) };

  let typeLabel = 'Surat Keterangan Aktif Kuliah';
  if (isObservation) {
    typeLabel = 'Surat Pengantar Observasi';
  } else if (isCounseling) {
    typeLabel = 'Surat Pengantar Konseling';
  } else if (isInterview) {
    typeLabel = 'Surat Izin Wawancara';
  } else if (isPermission) {
    typeLabel = 'Surat Perizinan';
  } else if (isResearch) {
    typeLabel = 'Rekomendasi Penelitian';
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
    activeStudent: (isObservation || isCounseling || isResearchLike || isSuRek)
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
    counseling: isCounseling
      ? {
          subject: row.subject || '',
          recipientName: row.recipient_name || '',
          referralUnit: row.referral_unit || '',
          studyProgramLevel: row.study_program_level || '',
          studyProgramName: row.study_program_name || '',
          faculty: row.faculty || DEFAULT_FACULTY
      }
      : null,
    research: isResearchLike
      ? {
          recipientName: row.recipient_name || '',
          recipientTitle: row.recipient_title || '',
          destinationPlace: row.destination_place || row.research_place || '',
          destinationAddress: row.destination_address || row.research_address || '',
          researchPlace: row.research_place || '',
          assignmentType: row.assignment_type || '',
          researchTitle: row.research_title || '',
          permissionPurpose: row.permission_purpose || '',
          contactPerson: row.contact_person || '',
          studyProgramLevel: row.study_program_level || '',
          studyProgramName: row.study_program_name || '',
          advisors: normalizeResearchAdvisors(row.advisors),
          includeResearchPlace: row.include_research_place !== false,
          letterKind: row.letter_kind || type
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






export {
  mapActiveStudentRow,
  mapObservationRow,
  mapCounselingRow,
  mapResearchRow,
  buildObservationAccessPayload,
  buildResearchAccessPayload,
  buildLetterValidationPayload
};
