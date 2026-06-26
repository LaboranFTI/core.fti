import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./tu.routes.v2.js', import.meta.url), 'utf8');

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
