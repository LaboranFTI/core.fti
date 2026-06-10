import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratAktifKuliahV2.html', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('../../pages_tu/components/ActiveStudentLetter.tsx', import.meta.url), 'utf8');
const titleBlock = template.match(/\.title\s*\{[\s\S]*?\}/)?.[0] || '';
const signatureContentBlock = template.match(/\.signature-content\s*\{[\s\S]*?\}/)?.[0] || '';
const stampImageBlock = template.match(/\.stamp-image\s*\{[\s\S]*?\}/)?.[0] || '';
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

  it('uses a 40mm overlapping faculty stamp in both renderers', () => {
    assert.match(stampImageBlock, /height:\s*40mm;/);
    assert.match(stampImageBlock, /z-index:\s*20;/);
    assert.match(previewSource, /className="absolute bottom-\[-6mm\] left-\[5mm\] h-\[40mm\] object-contain opacity-90 mix-blend-multiply z-20 pointer-events-none"/);
  });
});
