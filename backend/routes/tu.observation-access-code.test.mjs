import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./tu.routes.v2.js', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../database_schema.sql', import.meta.url), 'utf8');

const postRouteSource = (routePath, nextRoutePath) => {
  const start = source.indexOf(`router.post('${routePath}'`);
  assert.notEqual(start, -1, `Route ${routePath} should exist`);
  const end = nextRoutePath ? source.indexOf(`router.post('${nextRoutePath}'`, start + 1) : -1;
  return source.slice(start, end === -1 ? undefined : end);
};

describe('TU observation access codes', () => {
  it('adds an access code column for observation self-service retrieval', () => {
    assert.match(source, /access_code\s+VARCHAR\(20\)/);
    assert.match(source, /ADD COLUMN IF NOT EXISTS access_code VARCHAR\(20\)/);
    assert.match(source, /idx_observation_requests_access_code_unique/);
    assert.match(source, /ADD COLUMN IF NOT EXISTS qr_download_token_hash VARCHAR\(64\)/);
    assert.match(source, /ADD COLUMN IF NOT EXISTS qr_download_token_expires_at TIMESTAMPTZ/);
    assert.match(schema, /access_code\s+VARCHAR\(20\)/);
    assert.match(schema, /idx_observation_requests_access_code_unique/);
  });

  it('generates stable random observation access codes', () => {
    assert.match(source, /const OBSERVATION_ACCESS_CODE_PREFIX\s*=\s*'OBS'/);
    assert.match(source, /const createObservationAccessCode\s*=/);
    assert.match(source, /crypto\.randomInt\(0,\s*OBSERVATION_ACCESS_CODE_ALPHABET\.length\)/);
    assert.match(source, /\$\{OBSERVATION_ACCESS_CODE_PREFIX\}-\$\{randomAccessCodeSegment\(\)\}-\$\{randomAccessCodeSegment\(\)\}/);
  });

  it('returns the access code from QR generation together with the public validation URL', () => {
    const qrRoute = postRouteSource(
      '/tu/observation-letter/generate-qr-link',
      '/tu/observation-letter/send-email'
    );

    assert.match(qrRoute, /requestData\s*=\s*await ensureObservationAccessCode\(client,\s*requestData\)/);
    assert.match(qrRoute, /requestData\s*=\s*await ensureLetterValidationToken\(client,\s*'observation',\s*requestData\)/);
    assert.match(qrRoute, /validationUrl/);
    assert.match(qrRoute, /validationToken:\s*requestData\.validation_token/);
    assert.match(qrRoute, /accessCode:\s*requestData\.access_code/);
    assert.match(qrRoute, /expiresAt:\s*null/);
  });

  it('includes the access code in observation emails and API responses', () => {
    const emailRoute = postRouteSource(
      '/tu/observation-letter/send-email',
      undefined
    );

    assert.match(emailRoute, /requestData\s*=\s*await ensureObservationAccessCode\(client,\s*requestData\)/);
    assert.match(emailRoute, /Kode akses surat/);
    assert.match(emailRoute, /accessCode:\s*requestData\.access_code/);
  });
});
