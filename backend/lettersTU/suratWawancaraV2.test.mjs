import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratWawancaraV2.html', import.meta.url), 'utf8');

describe('suratWawancaraV2 template', () => {
  it('uses interview permission wording with the research-like placeholders', () => {
    assert.match(template, /Surat Izin Wawancara/);
    assert.match(template, /mohon izin bagi mahasiswa tersebut untuk melakukan wawancara\{\{researchPlacePhrase\}\}/);
    assert.match(template, /<p class="research-title"><strong>&ldquo;\{\{researchTitle\}\}&rdquo;<\/strong><\/p>/);
    assert.match(template, /\{\{advisorSignatureBlock\}\}/);
  });

  it('keeps QR validation layout consistent with official TU letters', () => {
    assert.match(template, /\.signature-block\s*\{[\s\S]*grid-template-columns:\s*28mm auto;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.doesNotMatch(template, /signature-space|signatureImage|stampImage|signature-area/);
  });

  it('emphasizes recipient identity and keeps the interview topic centered', () => {
    assert.match(template, /<strong>\{\{recipientName\}\}<\/strong>/);
    assert.match(template, /<strong>\{\{recipientTitle\}\}<\/strong>/);
    assert.match(template, /<strong>\{\{destinationPlace\}\}<\/strong>/);
    assert.match(template, /\.research-title\s*\{[\s\S]*text-align:\s*center;/);
    assert.match(template, /<strong>\{\{studentName\}\}<\/strong>/);
    assert.match(template, /<strong>\{\{studentNim\}\}<\/strong>/);
    assert.match(template, /<strong>\{\{contactPerson\}\}<\/strong>/);
  });
});
