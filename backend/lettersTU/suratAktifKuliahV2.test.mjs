import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratAktifKuliahV2.html', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('../../pages_tu/components/ActiveStudentLetter.tsx', import.meta.url), 'utf8');
const titleBlock = template.match(/\.title\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureContentBlock = template.match(/\.signature-content\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrBlock = template.match(/\.validation-qr\s*\{[\s\S]*?\}/)?.[0] || '';
const validationQrImageBlock = template.match(/\.validation-qr img\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureNameBlock = template.match(/\.signature-name\s*\{[\s\S]*?\}/)?.[0] || '';

describe('suratAktifKuliah title styling', () => {
  it('keeps the email PDF title bold without underline and aligned with preview sizing', () => {
    assert.match(titleBlock, /font-size:\s*15pt;/);
    assert.match(titleBlock, /font-weight:\s*bold;/);
    assert.doesNotMatch(titleBlock, /text-decoration:\s*underline;/);
  });

  it('keeps the React preview title bold without underline', () => {
    assert.match(previewSource, /<h3 className="text-\[15pt\] font-bold uppercase">/);
    assert.doesNotMatch(previewSource, /<h3 className="[^"]*underline/);
  });
});

describe('suratAktifKuliah dean signature layout', () => {
  it('keeps the PDF dean name centered with the signature block on one line at 11pt', () => {
    assert.match(signatureContentBlock, /width:\s*48%;/);
    assert.match(signatureNameBlock, /font-size:\s*11pt;/);
    assert.match(signatureNameBlock, /white-space:\s*nowrap;/);
    assert.match(signatureNameBlock, /width:\s*max-content;/);
    assert.match(signatureNameBlock, /left:\s*50%;/);
    assert.match(signatureNameBlock, /transform:\s*translateX\(-50%\);/);
  });

  it('keeps the preview dean name centered with the signature block on one line at 11pt', () => {
    assert.match(previewSource, /className="w-\[48%\] leading-tight text-center"/);
    assert.match(
      previewSource,
      /className="relative left-1\/2 w-max -translate-x-1\/2 whitespace-nowrap text-\[11pt\] font-bold underline underline-offset-4"/
    );
  });

  it('uses QR validation instead of manual signature and faculty stamp assets', () => {
    assert.match(validationQrBlock, /margin:\s*4mm\s+0\s+3mm;/);
    assert.match(validationQrImageBlock, /width:\s*24mm;/);
    assert.match(validationQrImageBlock, /height:\s*24mm;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.match(previewSource, /<ValidationQrCode value=\{validationUrl\} size=\{92\} \/>/);
    assert.doesNotMatch(template, /stamp-image/);
    assert.doesNotMatch(previewSource, /stampBase64/);
  });
});
