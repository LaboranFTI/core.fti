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

describe('TU observation QR download tokens', () => {
  it('generates random hashed QR tokens with a 24 hour TTL', () => {
    assert.match(source, /crypto\.randomBytes\(32\)\.toString\('base64url'\)/);
    assert.match(source, /createHash\('sha256'\)/);
    assert.match(source, /QR_DOWNLOAD_TOKEN_TTL_HOURS\s*=\s*24/);
    assert.match(source, /qr_download_token_hash\s*=\s*\$\d+/);
    assert.match(source, /qr_download_token_expires_at\s*=\s*\$\d+/);
    assert.doesNotMatch(source, /const token\s*=\s*requestData\.id/);
  });

  it('persists the hashed QR token in the generate QR link endpoint', () => {
    const qrRoute = routeSource(
      '/tu/observation-letter/generate-qr-link',
      '/tu/observation-letter/send-email'
    );

    assert.match(qrRoute, /const qrDownloadToken\s*=\s*createQrDownloadToken\(\)/);
    assert.match(qrRoute, /const qrDownloadTokenHash\s*=\s*hashQrDownloadToken\(qrDownloadToken\)/);
    assert.match(qrRoute, /qr_download_token_hash\s*=\s*\$1/);
    assert.match(qrRoute, /qr_download_token_expires_at\s*=\s*\$2/);
    assert.match(qrRoute, /\/api\/tu\/public\/qr-download\/\$\{qrDownloadToken\}/);
  });

  it('resolves public downloads by non-expired token hash instead of request id', () => {
    assert.match(source, /qr_download_token_hash\s*=\s*\$\d+/);
    assert.match(source, /qr_download_token_expires_at\s*>\s*CURRENT_TIMESTAMP/);
    assert.doesNotMatch(source, /SELECT \* FROM observation_requests WHERE id = \$1`\s*,\s*\[token\]/);
  });
});
