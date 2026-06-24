import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./tu.routes.v2.js', import.meta.url), 'utf8');

const routeSource = (routePath, nextRoutePath) => {
  const start = source.indexOf(`router.post('${routePath}'`);
  assert.notEqual(start, -1, `Route ${routePath} should exist`);
  const end = nextRoutePath ? source.indexOf(`router.post('${nextRoutePath}'`, start + 1) : -1;
  return source.slice(start, end === -1 ? undefined : end);
};

describe('TU letter public validation tokens', () => {
  it('generates stable random validation tokens for public letter validation', () => {
    assert.match(source, /const VALIDATION_TOKEN_BYTES\s*=\s*24/);
    assert.match(source, /const createValidationToken\s*=\s*\(\)\s*=>\s*crypto\.randomBytes\(VALIDATION_TOKEN_BYTES\)\.toString\('base64url'\)/);
    assert.match(source, /validation_token\s+VARCHAR\(64\)/);
    assert.match(source, /idx_active_student_requests_validation_token_unique/);
    assert.match(source, /idx_observation_requests_validation_token_unique/);
    assert.doesNotMatch(source, /const token\s*=\s*requestData\.id/);
  });

  it('uses the shared validation URL in the generate QR link endpoint', () => {
    const qrRoute = routeSource(
      '/tu/observation-letter/generate-qr-link',
      '/tu/observation-letter/send-email'
    );

    assert.match(qrRoute, /requestData\s*=\s*await ensureObservationAccessCode\(client,\s*requestData\)/);
    assert.match(qrRoute, /requestData\s*=\s*await ensureLetterValidationToken\(client,\s*'observation',\s*requestData\)/);
    assert.match(qrRoute, /const validationUrl\s*=\s*buildPublicValidationUrl\(req,\s*requestData\.validation_token\)/);
    assert.match(qrRoute, /qrUrl:\s*validationUrl/);
    assert.match(qrRoute, /validationUrl/);
    assert.match(qrRoute, /validationToken:\s*requestData\.validation_token/);
    assert.match(qrRoute, /accessCode:\s*requestData\.access_code/);
    assert.match(qrRoute, /expiresAt:\s*null/);
  });

  it('exposes public detail and download routes by validation token', () => {
    assert.match(source, /router\.get\('\/tu\/public\/letter-validation\/:token'/);
    assert.match(source, /router\.get\('\/tu\/public\/letter-validation\/:token\/download'/);
    assert.match(source, /SELECT \* FROM active_student_requests WHERE validation_token = \$1 LIMIT 1/);
    assert.match(source, /SELECT \* FROM observation_requests WHERE validation_token = \$1 LIMIT 1/);
    assert.match(source, /buildLetterValidationPayload\('active-student',\s*activeResult\.rows\[0\],\s*req\)/);
    assert.match(source, /buildLetterValidationPayload\('observation',\s*observationResult\.rows\[0\],\s*req\)/);
  });

  it('embeds the FTI center logo in generated QR SVGs with high error correction', () => {
    assert.match(source, /QR_CENTER_LOGO_PATH\s*=\s*path\.join\(__dirname,\s*'\.\.',\s*'\.\.',\s*'src',\s*'assets',\s*'FTI_nobg\.svg'\)/);
    assert.match(source, /qrcode\(value,\s*\{\s*errorCorrectLevel:\s*qrcode\.ErrorCorrectLevel\.H\s*\}\)/);
    assert.match(source, /<image href="\$\{logoDataUrl\}"/);
    assert.match(source, /const validationQrImage = await createQrSvgDataUrl\(validationUrl\)/);
  });
});
