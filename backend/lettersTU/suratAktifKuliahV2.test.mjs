import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratAktifKuliahV2.html', import.meta.url), 'utf8');
const previewSource = readFileSync(new URL('../../pages_tu/components/ActiveStudentLetter.tsx', import.meta.url), 'utf8');
const titleBlock = template.match(/\.title\s*\{[\s\S]*?\}/)?.[0] || '';

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
