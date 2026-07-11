import crypto from 'crypto';
import {
  OBSERVATION_ACCESS_CODE_ALPHABET,
  OBSERVATION_ACCESS_CODE_PREFIX,
  PERMISSION_ACCESS_CODE_PREFIX,
  PERMISSION_LETTER_KIND,
  QR_DOWNLOAD_TOKEN_TTL_HOURS,
  RESEARCH_ACCESS_CODE_PREFIX,
  RESEARCH_LETTER_KIND,
  SUREK_ACCESS_CODE_PREFIX,
  VALIDATION_TOKEN_BYTES
} from './constants.js';

export const createQrDownloadToken = () => crypto.randomBytes(32).toString('base64url');

export const hashQrDownloadToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const getQrDownloadExpiry = () => new Date(Date.now() + QR_DOWNLOAD_TOKEN_TTL_HOURS * 60 * 60 * 1000);

export const createValidationToken = () => crypto.randomBytes(VALIDATION_TOKEN_BYTES).toString('base64url');

export const randomAccessCodeSegment = () =>
  Array.from(
    { length: 4 },
    () => OBSERVATION_ACCESS_CODE_ALPHABET[crypto.randomInt(0, OBSERVATION_ACCESS_CODE_ALPHABET.length)]
  ).join('');

export const createObservationAccessCode = () =>
  `${OBSERVATION_ACCESS_CODE_PREFIX}-${randomAccessCodeSegment()}-${randomAccessCodeSegment()}`;

export const normalizeObservationAccessCode = (value) => {
  const compactCode = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compactCode.length !== 11 || !compactCode.startsWith(OBSERVATION_ACCESS_CODE_PREFIX)) {
    return '';
  }

  const normalizedCode = `${compactCode.slice(0, 3)}-${compactCode.slice(3, 7)}-${compactCode.slice(7, 11)}`;
  return /^OBS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode) ? normalizedCode : '';
};

export const createResearchAccessCode = (letterKind = RESEARCH_LETTER_KIND) =>
  `${letterKind === PERMISSION_LETTER_KIND ? PERMISSION_ACCESS_CODE_PREFIX : RESEARCH_ACCESS_CODE_PREFIX}-${randomAccessCodeSegment()}-${randomAccessCodeSegment()}`;

export const normalizeResearchAccessCode = (value) => {
  const compactCode = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isKnownPrefix = compactCode.startsWith(RESEARCH_ACCESS_CODE_PREFIX) || compactCode.startsWith(PERMISSION_ACCESS_CODE_PREFIX);
  if (compactCode.length !== 11 || !isKnownPrefix) {
    return '';
  }

  const normalizedCode = `${compactCode.slice(0, 3)}-${compactCode.slice(3, 7)}-${compactCode.slice(7, 11)}`;
  return /^(PEN|IZN)-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode) ? normalizedCode : '';
};

export const createSuRekAccessCode = () =>
  `${SUREK_ACCESS_CODE_PREFIX}-${randomAccessCodeSegment()}-${randomAccessCodeSegment()}`;

export const normalizeSuRekAccessCode = (value) => {
  const compactCode = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compactCode.length !== 11 || !compactCode.startsWith(SUREK_ACCESS_CODE_PREFIX)) {
    return '';
  }

  const normalizedCode = `${compactCode.slice(0, 3)}-${compactCode.slice(3, 7)}-${compactCode.slice(7, 11)}`;
  return /^REK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode) ? normalizedCode : '';
};

export const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
