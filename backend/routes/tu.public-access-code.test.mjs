import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const routeSource = readFileSync(new URL('./tu.routes.v2.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../middleware/auth.js', import.meta.url), 'utf8');

describe('TU public observation access-code routes', () => {
  it('allows the TU public route family through token middleware', () => {
    assert.match(authSource, /'\/tu\/public'/);
    assert.doesNotMatch(authSource, /'\/tu\/public\/qr-download'\]/);
  });

  it('looks up one observation letter by normalized access code without exposing archive lists', () => {
    assert.match(routeSource, /const normalizeObservationAccessCode\s*=/);
    assert.match(routeSource, /router\.post\('\/tu\/public\/observation-letter\/access'/);
    assert.match(routeSource, /WHERE access_code = \$1\s+LIMIT 1/);
    assert.match(routeSource, /buildObservationAccessPayload\(result\.rows\[0\]\)/);
    assert.doesNotMatch(routeSource, /router\.get\('\/tu\/public\/observation-requests'/);
  });

  it('updates only the letter content for the supplied access code', () => {
    assert.match(routeSource, /router\.patch\('\/tu\/public\/observation-letter\/access'/);
    assert.match(routeSource, /WHERE access_code = \$(8|9)/);
    assert.match(routeSource, /letter_number tidak akan berubah/i);
  });

  it('downloads the accessed letter PDF by access code', () => {
    assert.match(routeSource, /router\.post\('\/tu\/public\/observation-letter\/download'/);
    assert.match(routeSource, /const pdfBuffer = await buildObservationPdfBuffer\(requestData,\s*req\)/);
    assert.match(routeSource, /SuratObservasi_\$\{safeCompanyName\}\.pdf/);
  });
});
