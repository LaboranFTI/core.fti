// core.js — Facade: re-exports every public symbol from lib/ modules.
// Each identifier is exported exactly once from its canonical source.

export { escapeXml } from './lib/sanitize.js';
export { mapActiveStudentRow, mapObservationRow, mapCounselingRow, mapResearchRow, buildObservationAccessPayload, buildResearchAccessPayload, buildLetterValidationPayload } from './lib/data-mappers.js';
export { pool, ensureTuInfrastructure } from './lib/db-infrastructure.js';
export { normalizeObservationStudents, buildObservationStudentRowsHtml, buildObservationPdfBuffer, ensureObservationAccessCode, upsertObservationRequest } from './lib/domain-observation.js';
export { getResearchLetterType, normalizeResearchDefaults, normalizeInterviewDefaults, normalizePermissionDefaults, getResearchAdvisorTitle, isSystemResearchAdvisorTitle, normalizeResearchAdvisors, buildResearchAdvisorText, buildResearchAdvisorSignatureHtml, normalizeResearchPayload, validateResearchPayload, ensureResearchAccessCode, upsertResearchRequest, createFinalResearchRequest } from './lib/domain-research.js';
export { letterConfig } from './lib/letter-config.js';
export { ensureLetterValidationToken, buildLetterHtml, buildLetterPdfBuffer } from './lib/letter-html.js';
export { reserveLetterNumber, formatLetterNumber, ensureLetterNumber, recalculateLetterCounter, generatePdfBuffer, getTuSettingsPayload, saveLetterBackgrounds, saveLetterLayouts, sendSuRekAccessCodeEmail, upsertSystemSetting } from './lib/letter-number.js';
export { QR_CENTER_LOGO_PATH, getQrCenterLogoDataUrl, createQrSvgDataUrl } from './lib/qr.js';
export { publicObservationAccessLimiter, publicValidationLimiter } from './lib/rate-limiters.js';
export { uploadSessions, qrDownloadSessions } from './lib/sessions.js';
export { buildResearchSignerList } from './lib/signers.js';
export { formatProgramLevelShort, formatFacultyProgram, getSemesterMeta, getStudyProgramByNim, getRecommendationSigner, getDeanSigner } from './lib/university.js';
export { formatPublicDate, buildPublicAppBaseUrl, buildPublicValidationUrl } from './lib/url-builders.js';

export {
  DEFAULT_COUNSELING_RECIPIENT_NAME, DEFAULT_COUNSELING_REFERRAL_UNIT, DEFAULT_COUNSELING_SUBJECT,
  INTERVIEW_LETTER_KIND, LETTER_TYPE_TO_CLIENT_KEY, PERMISSION_LETTER_KIND, RESEARCH_LETTER_KIND,
  TU_ACCESS_ROLES, TU_ADMIN_ROLES, TU_SUBMIT_ROLES
} from './lib/constants.js';

export {
  DEFAULT_LETTER_LAYOUT_MM, getSharedLetterBackground, normalizeLetterLayout
} from './lib/letterLayout.js';

export {
  createSuRekAccessCode, normalizeObservationAccessCode, normalizeResearchAccessCode,
  normalizeSuRekAccessCode, hashQrDownloadToken, isValidEmailAddress
} from './lib/tokens.js';

export { DEFAULT_FACULTY, DEFAULT_UNIVERSITY, formatStudentName } from '../../utils/activeStudentLetter.js';
export { verifyRole } from '../../middleware/auth.js';
