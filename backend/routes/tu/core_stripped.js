import express from 'express';
import rateLimit from 'express-rate-limit';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qr.js';
import { pool } from '../../config/database.js';
import { verifyRole } from '../../middleware/auth.js';
import { sendMail, buildProfessionalEmail, getStandardEmailAttachments } from '../../utils/mailer.js';
import { buildBirthPlaceAndDate, DEFAULT_FACULTY, DEFAULT_UNIVERSITY, formatStudentName, getStudyProgramCodeFromNim, mapStudyProgramRow } from '../../utils/activeStudentLetter.js';
import { DEFAULT_COUNSELING_RECIPIENT_NAME, DEFAULT_COUNSELING_REFERRAL_UNIT, DEFAULT_COUNSELING_SUBJECT, DEFAULT_INTERVIEW_ADVISOR_TITLE, DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST, DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND, DEFAULT_INTERVIEW_ASSIGNMENT_TYPE, DEFAULT_PERMISSION_ADVISOR_TITLE, DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST, DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND, DEFAULT_PERMISSION_ASSIGNMENT_TYPE, DEFAULT_RESEARCH_ADVISOR_TITLE, DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST, DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND, DEFAULT_RESEARCH_ASSIGNMENT_TYPE, INTERVIEW_LETTER_KIND, LETTER_TYPE_TO_CLIENT_KEY, LETTER_TYPE_TO_CODE, OBSERVATION_ACCESS_CODE_ALPHABET, OBSERVATION_ACCESS_CODE_PREFIX, PERMISSION_ACCESS_CODE_PREFIX, PERMISSION_LETTER_KIND, QR_DOWNLOAD_TOKEN_TTL_HOURS, RESEARCH_ACCESS_CODE_PREFIX, RESEARCH_LETTER_KIND, SHARED_LETTER_BACKGROUND_TYPE, SUREK_ACCESS_CODE_PREFIX, TU_ACCESS_ROLES, TU_ADMIN_ROLES, TU_SETTINGS_KEYS, TU_SUBMIT_ROLES, VALIDATION_TOKEN_BYTES } from './lib/constants.js';
import { applyOfficialLetterTypography, buildLetterBackgroundsPayload, buildLetterLayoutsPayload, clampMarginMm, createEmptyLetterBackgrounds, createEmptyLetterLayouts, DEFAULT_LETTER_LAYOUT_MM, getSharedLetterBackground, normalizeLetterLayout, OFFICIAL_LETTER_TYPOGRAPHY_CSS } from './lib/letterLayout.js';
import { createObservationAccessCode, createQrDownloadToken, createResearchAccessCode, createSuRekAccessCode, createValidationToken, getQrDownloadExpiry, hashQrDownloadToken, isValidEmailAddress, normalizeObservationAccessCode, normalizeResearchAccessCode, normalizeSuRekAccessCode, randomAccessCodeSegment } from './lib/tokens.js';
import { escapeXml, maskDate, maskEmail, maskNim } from './lib/sanitize.js';
import { createTuSettingsService } from './services/settings.service.js';
import { ensureTuInfrastructure } from './lib/db-infrastructure.js';
import { letterConfig } from './lib/letter-config.js';
import { reserveLetterNumber, formatLetterNumber, ensureLetterNumber, generatePdfBuffer, getTuSettingsPayload, saveLetterBackgrounds, saveLetterLayouts, sendSuRekAccessCodeEmail, upsertSystemSetting } from './lib/letter-number.js';
import { buildObservationPdfBuffer, ensureObservationAccessCode, upsertObservationRequest } from './lib/domain-observation.js';
import { normalizeResearchPayload, validateResearchPayload, ensureResearchAccessCode, upsertResearchRequest, createFinalResearchRequest } from './lib/domain-research.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);









































































export {
  getRecommendationSigner,
  getDeanSigner,
  getStudyProgramByNim,
  formatFacultyProgram,
  normalizeResearchDefaults,
  normalizeInterviewDefaults,
  normalizePermissionDefaults,
  normalizeResearchAdvisors,
  getResearchAdvisorTitle,
  buildResearchAdvisorSignatureHtml,
  verifyRole,
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  formatStudentName,
  getStudyProgramCodeFromNim,
  mapStudyProgramRow,
  QR_CENTER_LOGO_PATH,
  uploadSessions,
  qrDownloadSessions,
  TU_ACCESS_ROLES,
  TU_ADMIN_ROLES,
  TU_SUBMIT_ROLES,
  TU_SETTINGS_KEYS,
  QR_DOWNLOAD_TOKEN_TTL_HOURS,
  publicObservationAccessLimiter,
  publicValidationLimiter,
  LETTER_TYPE_TO_CLIENT_KEY,
  SHARED_LETTER_BACKGROUND_TYPE,
  LETTER_TYPE_TO_CODE,
  DEFAULT_COUNSELING_SUBJECT,
  DEFAULT_COUNSELING_RECIPIENT_NAME,
  DEFAULT_COUNSELING_REFERRAL_UNIT,
  DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
  DEFAULT_RESEARCH_ADVISOR_TITLE,
  DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
  DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
  DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
  DEFAULT_INTERVIEW_ADVISOR_TITLE,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND,
  DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
  DEFAULT_PERMISSION_ADVISOR_TITLE,
  DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
  DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND,
  RESEARCH_LETTER_KIND,
  INTERVIEW_LETTER_KIND,
  PERMISSION_LETTER_KIND,
  OBSERVATION_ACCESS_CODE_PREFIX,
  RESEARCH_ACCESS_CODE_PREFIX,
  PERMISSION_ACCESS_CODE_PREFIX,
  SUREK_ACCESS_CODE_PREFIX,
  OBSERVATION_ACCESS_CODE_ALPHABET,
  VALIDATION_TOKEN_BYTES,
  createQrDownloadToken,
  hashQrDownloadToken,
  getQrDownloadExpiry,
  createValidationToken,
  randomAccessCodeSegment,
  createObservationAccessCode,
  normalizeObservationAccessCode,
  createResearchAccessCode,
  normalizeResearchAccessCode,
  createSuRekAccessCode,
  normalizeSuRekAccessCode,
  isValidEmailAddress,
  escapeXml,
  createEmptyLetterBackgrounds,
  DEFAULT_LETTER_LAYOUT_MM,
  OFFICIAL_LETTER_TYPOGRAPHY_CSS,
  createEmptyLetterLayouts,
  clampMarginMm,
  normalizeLetterLayout,
  applyOfficialLetterTypography,
  ensureTuInfrastructure,
  getQrCenterLogoDataUrl,
  createQrSvgDataUrl,
  maskNim,
  normalizeObservationStudents,
  getTuSettingsPayload,
  getSemesterMeta,
  getSharedLetterBackground,
  reserveLetterNumber,
  formatPublicDate,
  buildPublicValidationUrl,
  buildPublicAppBaseUrl,
  letterConfig,
  ensureLetterNumber,
  ensureLetterValidationToken,
  generatePdfBuffer,
  buildLetterHtml,
  getResearchLetterType,
  ensureResearchAccessCode,
  upsertResearchRequest,
  createFinalResearchRequest,
  upsertSystemSetting,
  saveLetterBackgrounds,
  saveLetterLayouts,
  buildLetterValidationPayload,
  buildResearchSignerList,
  buildObservationAccessPayload,
  buildResearchAccessPayload,
  buildObservationPdfBuffer,
  buildLetterPdfBuffer,
  mapActiveStudentRow,
  mapObservationRow,
  mapCounselingRow,
  mapResearchRow,
  sendSuRekAccessCodeEmail,
  upsertObservationRequest,
  ensureObservationAccessCode,
  isSystemResearchAdvisorTitle,
  buildResearchAdvisorText,
  pool,
  buildLetterBackgroundsPayload,
  buildLetterLayoutsPayload,
  sendMail,
  buildProfessionalEmail,
  getStandardEmailAttachments
};
