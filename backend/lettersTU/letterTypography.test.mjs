import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const templateNames = [
  'suratAktifKuliahV2.html',
  'suratKonselingV2.html',
  'suratObservasiV2.html',
  'suratPenelitianV2.html',
  'suratWawancaraV2.html',
  'suratRekomendasiAfirmasiV2.html'
];

const templates = templateNames.map((name) => ({
  name,
  source: readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
}));

const routeSource = readFileSync(new URL('../routes/tu.routes.v2.js', import.meta.url), 'utf8');

describe('official TU letter typography', () => {
  it('uses Calibri as the document font in every letter template', () => {
    for (const { name, source } of templates) {
      assert.match(source, /font-family:\s*Calibri,\s*Arial,\s*sans-serif;/, name);
      assert.doesNotMatch(source, /Times New Roman/i, name);
    }
  });

  it('keeps generated letter body text at 11pt with 1.5 line spacing', () => {
    assert.match(routeSource, /OFFICIAL_LETTER_TYPOGRAPHY_CSS/);
    assert.match(routeSource, /\.content p,\s*[\s\S]*?\.content td,\s*[\s\S]*?\.content th,\s*[\s\S]*?\.content li\s*\{[\s\S]*?font-size:\s*11pt;[\s\S]*?line-height:\s*1\.5;/);
    assert.match(routeSource, /\.title\s*\{[\s\S]*?font-size:\s*12pt;[\s\S]*?line-height:\s*1\.5;/);
  });

  it('applies the shared typography guard to all rendered preview and PDF HTML', () => {
    assert.match(routeSource, /const applyOfficialLetterTypography\s*=/);
    assert.match(routeSource, /return applyOfficialLetterTypography\(htmlContent\);/);
    assert.match(routeSource, /const buildLetterPdfBuffer\s*=\s*async[\s\S]*?buildLetterHtml\(type, requestData, req\)/);
  });
});
