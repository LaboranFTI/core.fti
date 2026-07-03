import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratAktifKuliahV2.html', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('../../pages_tu/components/ActiveStudentLetter.tsx', import.meta.url), 'utf8');
const titleBlock = template.match(/\.title\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureBlock = template.match(/\.signature-block\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureContentBlock = template.match(/\.signature-content\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrBlock = template.match(/\.validation-qr\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrImageBlock = template.match(/\.validation-qr img\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureSpaceBlock = template.match(/\.signature-space\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureNameBlock = template.match(/\.signature-name\s*\{[\s\S]*?\}/)?.[0] || '';

describe('suratAktifKuliah title styling', () => {
  it('keeps the email PDF title at the official size without underline', () => {
    assert.match(titleBlock, /font-size:\s*12pt;/);
    assert.match(titleBlock, /font-weight:\s*bold;/);
    assert.doesNotMatch(titleBlock, /text-decoration:\s*underline;/);
  });

  it('renders the React preview dynamically via HTML from backend', () => {
    assert.match(previewSource, /dangerouslySetInnerHTML/);
  });
});

describe('suratAktifKuliah dean signature layout', () => {
  it('keeps the PDF dean name beside the QR block on one line at 11pt', () => {
    assert.match(signatureBlock, /display:\s*grid;/);
    assert.match(signatureBlock, /grid-template-columns:\s*28mm max-content;/);
    assert.match(signatureBlock, /justify-content:\s*start;/);
    assert.match(signatureBlock, /column-gap:\s*4mm;/);
    assert.match(signatureContentBlock, /min-width:\s*58mm;/);
    assert.match(signatureContentBlock, /min-height:\s*28mm;/);
    assert.match(signatureContentBlock, /display:\s*flex;/);
    assert.match(signatureContentBlock, /text-align:\s*left;/);
    assert.match(signatureSpaceBlock, /flex:\s*1 1 auto;/);
    assert.match(signatureSpaceBlock, /min-height:\s*6mm;/);
    assert.match(signatureNameBlock, /font-size:\s*11pt;/);
    assert.match(signatureNameBlock, /white-space:\s*nowrap;/);
    assert.match(signatureNameBlock, /width:\s*max-content;/);
  });

  it('keeps the preview layout rendering scoped via scopeHtml helper', () => {
    assert.match(previewSource, /scopeHtml/);
    assert.match(previewSource, /dangerouslySetInnerHTML/);
  });

  it('uses QR validation instead of manual signature and faculty stamp assets', () => {
    assert.match(validationQrBlock, /margin:\s*0;/);
    assert.match(validationQrBlock, /width:\s*28mm;/);
    assert.match(validationQrImageBlock, /width:\s*28mm;/);
    assert.match(validationQrImageBlock, /height:\s*28mm;/);
    assert.match(validationQrImageBlock, /display:\s*block;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.doesNotMatch(template, /stamp-image/);
    assert.doesNotMatch(previewSource, /stampBase64/);
  });
});
