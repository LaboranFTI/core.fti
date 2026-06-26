import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratRekomendasiAfirmasiV2.html', import.meta.url), 'utf8');
const signatureBlock = template.match(/\.signature-block\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureContentBlock = template.match(/\.signature-content\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrBlock = template.match(/\.validation-qr\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrImageBlock = template.match(/\.validation-qr img\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureSpaceBlock = template.match(/\.signature-space\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureNameBlock = template.match(/\.signature-name\s*\{[\s\S]*?\}/)?.[0] || '';

describe('suratRekomendasiAfirmasiV2 template', () => {
  it('matches the required placeholders and structure', () => {
    assert.match(template, /\{\{nomorSurat\}\}/);
    assert.match(template, /\{\{lampiran\}\}/);
    assert.match(template, /\{\{perihal\}\}/);
    assert.match(template, /\{\{recipientName\}\}/);
    assert.match(template, /\{\{berdasarkanNo\}\}/);
    assert.match(template, /\{\{name\}\}/);
    assert.match(template, /\{\{nim\}\}/);
    assert.match(template, /\{\{tahunAkademikDashed\}\}/);
    assert.match(template, /\{\{programStudi\}\}/);
    assert.match(template, /\{\{validationQrImage\}\}/);
    assert.match(template, /\{\{dekanNama\}\}/);
    assert.match(template, /\{\{dekanTitle\}\}/);
    assert.match(template, /\{\{tembusanBlock\}\}/);
  });

  it('keeps student name and form number values unbolded', () => {
    assert.match(template, /<td>\{\{name\}\}<\/td>/);
    assert.match(template, /<td>\{\{nim\}\}<\/td>/);
    assert.doesNotMatch(template, /<td style="font-weight:\s*bold;">\{\{name\}\}<\/td>/);
    assert.doesNotMatch(template, /<td style="font-weight:\s*bold;">\{\{nim\}\}<\/td>/);
  });

  it('has correct styling properties', () => {
    assert.match(signatureBlock, /margin-top:\s*10mm;/);
    assert.match(signatureBlock, /display:\s*grid;/);
    assert.match(signatureBlock, /grid-template-columns:\s*28mm max-content;/);
    assert.match(signatureBlock, /justify-content:\s*start;/);
    assert.match(signatureBlock, /column-gap:\s*8mm;/);
    assert.match(signatureContentBlock, /min-width:\s*58mm;/);
    assert.match(signatureContentBlock, /min-height:\s*28mm;/);
    assert.match(signatureContentBlock, /display:\s*flex;/);
    assert.match(template, /\.signature-block p\s*\{[\s\S]*margin:\s*0;/);
    assert.match(signatureSpaceBlock, /flex:\s*1 1 auto;/);
    assert.match(signatureSpaceBlock, /min-height:\s*8mm;/);
    assert.match(signatureNameBlock, /font-weight:\s*bold;/);
    assert.match(validationQrBlock, /width:\s*28mm;/);
    assert.match(validationQrImageBlock, /display:\s*block;/);
    assert.match(validationQrImageBlock, /width:\s*28mm;/);
    assert.match(validationQrImageBlock, /height:\s*28mm;/);
    assert.doesNotMatch(template, /signatureImage|stampImage|signature-area/);
  });
});
