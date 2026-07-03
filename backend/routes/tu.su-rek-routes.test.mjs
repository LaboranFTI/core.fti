import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Source is now concatenated from all TU sub-modules (modularised from tu.routes.v2.js)
const readTu = (name) => readFileSync(new URL(`./tu/${name}`, import.meta.url), 'utf8');
const source = ['core.js', 'settings.js', 'validation.js', 'requests.active-student.js',
  'requests.counseling.js', 'requests.su-rek.js', 'requests.observation.js',
  'requests.ta.js', 'index.js'].map(readTu).join('\n');
const recommendationTemplate = readFileSync(new URL('../lettersTU/suratRekomendasiAfirmasiV2.html', import.meta.url), 'utf8');

const sliceBetween = (startText, endText) => {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `${startText} should exist`);
  const end = endText ? source.indexOf(endText, start + startText.length) : -1;
  return source.slice(start, end === -1 ? undefined : end);
};

describe('su-rek admin routes', () => {
  it('emails access codes when a recommendation request is created', () => {
    const createRoute = sliceBetween(
      "router.post('/su-rek-requests'",
      "router.delete('/tu/requests/su-rek/:id'"
    );

    assert.match(source, /const sendSuRekAccessCodeEmail\s*=\s*async/);
    assert.match(createRoute, /const \{ name, nim, email \} = req\.body/);
    assert.match(createRoute, /Email aktif wajib diisi agar kode akses dapat dikirim/);
    assert.match(createRoute, /email:\s*recipientEmail/);
    assert.match(createRoute, /sendSuRekAccessCodeEmail\(requestData,\s*req\)/);
    assert.match(createRoute, /accessEmail/);
  });

  it('uses configurable default carbon copies for new recommendation requests', () => {
    const createRoute = sliceBetween(
      "router.post('/su-rek-requests'",
      "router.delete('/tu/requests/su-rek/:id'"
    );

    assert.match(createRoute, /settingsPayload\.suRekTembusan/);
    assert.match(createRoute, /carbon_copies:\s*Array\.isArray\(settingsPayload\.suRekTembusan\) \? settingsPayload\.suRekTembusan : \[\]/);
    assert.doesNotMatch(createRoute, /Direktur penjaringan Beasiswa dan CSR/);
  });

  it('exposes public resend by access code after verification', () => {
    const sendEmailRoute = sliceBetween(
      "router.post('/tu/public/su-rek/send-email'",
      "router.post('/observation-requests'"
    );

    assert.match(sendEmailRoute, /normalizeSuRekAccessCode\(req\.body\?\.accessCode\)/);
    assert.match(sendEmailRoute, /WHERE access_code = \$1/);
    assert.match(sendEmailRoute, /Surat rekomendasi belum diverifikasi oleh TU/);
    assert.match(sendEmailRoute, /buildLetterPdfBuffer\('su-rek', requestData, req\)/);
    assert.match(sendEmailRoute, /transporter\.sendMail/);
    assert.match(sendEmailRoute, /SET status = 'sent'/);
  });

  it('uses database Wakil Dekan data for recommendation preview and PDF rendering', () => {
    const helperBlock = sliceBetween(
      'const getRecommendationSigner = async () => {',
      'const getDeanSigner = async () => {'
    );
    const recommendationConfig = sliceBetween(
      "'su-rek': {",
      'const ensureLetterNumber'
    );
    const previewRoute = sliceBetween(
      "router.post('/tu/preview-html'",
      "router.get('/tu/requests/:type/:id/preview-html'"
    );
    const savedPreviewRoute = sliceBetween(
      "router.get('/tu/requests/:type/:id/preview-html'",
      "router.get('/tu/public/letter-validation/:token/preview-html'"
    );
    const publicValidationRoute = sliceBetween(
      "router.get('/tu/public/letter-validation/:token'",
      "router.get('/tu/public/letter-validation/:token/download'"
    );

    assert.match(helperBlock, /FROM lecturer/);
    assert.match(helperBlock, /WHERE jabatan ILIKE 'Wakil Dekan%'/);
    assert.doesNotMatch(helperBlock, /jabatan ILIKE 'Dekan%'\s+OR/);
    assert.match(recommendationConfig, /await getRecommendationSigner\(\)/);
    assert.match(recommendationConfig, /'\{\{dekanNama\}\}': escapeXml\(recommendationSigner\.name\)/);
    assert.match(recommendationConfig, /'\{\{dekanTitle\}\}': escapeXml\(recommendationSigner\.title\)/);
    assert.doesNotMatch(recommendationConfig, /getDeanSigner\(\)/);
    assert.match(previewRoute, /buildLetterHtml\(type, data, req\)/);
    assert.match(savedPreviewRoute, /buildLetterHtml\(type, requestData, req\)/);
    assert.match(publicValidationRoute, /letterPayload\.signer = await getRecommendationSigner\(\)/);
    assert.match(source, /const html = await buildLetterHtml\('su-rek', suRekResult\.rows\[0\], req\)/);
    assert.match(source, /const pdfBuffer = await buildLetterPdfBuffer\('su-rek', requestData, req\)/);
  });

  it('rate-limits public validation downloads and blocks draft archive downloads', () => {
    assert.match(source, /router\.get\('\/tu\/public\/letter-validation\/:token\/download', publicValidationLimiter/);

    const archiveDownloadRoute = sliceBetween(
      "router.get('/tu/requests/:type/:id/download'",
      "router.get('/active-student/summary'"
    );

    assert.match(archiveDownloadRoute, /!\['verified', 'sent'\]\.includes\(result\.rows\[0\]\.status\)/);
    assert.match(archiveDownloadRoute, /Surat belum berstatus resmi/);
    assert.match(archiveDownloadRoute, /const requestData = await ensureLetterValidationToken\(pool, type, result\.rows\[0\]\)/);
  });

  it('only bolds the Wakil Dekan name in the recommendation signature', () => {
    assert.match(recommendationTemplate, /<p class="signature-name">\{\{dekanNama\}\}<\/p>/);
    assert.match(recommendationTemplate, /<p>\{\{dekanTitle\}\}<\/p>/);
    assert.doesNotMatch(recommendationTemplate, /<strong>\{\{dekanTitle\}\}<\/strong>/);
  });

  it('keeps single delete idempotent for stale admin lists', () => {
    const deleteRoute = sliceBetween(
      "router.delete('/tu/requests/su-rek/:id'",
      "router.post('/tu/requests/su-rek/batch-delete'"
    );

    assert.match(deleteRoute, /DELETE FROM su_rek_requests WHERE id = \$1 RETURNING/);
    assert.match(deleteRoute, /result\.rowCount === 0/);
    assert.match(deleteRoute, /alreadyDeleted:\s*true/);
    assert.doesNotMatch(deleteRoute, /res\.status\(404\)\.json\(\{\s*error:\s*'Pengajuan tidak ditemukan\.'\s*\}\)/);
  });
});
