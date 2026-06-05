import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ObservationForm.tsx', import.meta.url), 'utf8');

describe('ObservationForm student limit', () => {
  it('allows up to seven students in an observation letter', () => {
    assert.match(source, /const MAX_OBSERVATION_STUDENTS = 7;/);
    assert.match(source, /\{fields\.length\}\s*\/\s*\{MAX_OBSERVATION_STUDENTS\}/);
    assert.match(source, /fields\.length < MAX_OBSERVATION_STUDENTS/);
    assert.match(source, /fields\.length >= MAX_OBSERVATION_STUDENTS/);
    assert.doesNotMatch(source, /\{fields\.length\}\s*\/\s*5/);
  });
});

describe('ObservationForm access code UX', () => {
  it('stores access codes returned by PDF, QR, and email flows', () => {
    assert.match(source, /accessCode\?: string \| null/);
    assert.match(source, /res\.headers\.get\('X-Observation-Access-Code'\)/);
    assert.match(source, /setQrAccessCode\(json\.accessCode \|\| null\)/);
    assert.match(source, /setEmailSuccessState\(\{ email: targetEmail, letterNumber: json\.letterNumber \|\| null, accessCode: json\.accessCode \|\| null \}\)/);
  });

  it('shows the QR access code and a finish action in the QR modal', () => {
    assert.match(source, /Kode akses surat/);
    assert.match(source, /\{qrAccessCode\}/);
    assert.match(source, /Selesai & Buat Surat Baru/);
    assert.match(source, /resetSelfServiceFlow/);
  });

  it('renders QR codes locally instead of sending the secret token to a third party', () => {
    assert.match(source, /import QRCode from 'react-qr-code'/);
    assert.match(source, /<QRCode/);
    assert.doesNotMatch(source, /api\.qrserver\.com/);
  });

  it('lets public self-service users open, edit, and download one letter by access code', () => {
    assert.match(source, /accessCodeInput/);
    assert.match(source, /Buka Surat Lama dengan Kode/);
    assert.match(source, /handleOpenAccessCodeLetter/);
    assert.match(source, /handleSaveAccessCodeLetter/);
    assert.match(source, /handleDownloadAccessCodeLetter/);
    assert.match(source, /\/api\/tu\/public\/observation-letter\/access/);
    assert.match(source, /\/api\/tu\/public\/observation-letter\/download/);
  });
});
