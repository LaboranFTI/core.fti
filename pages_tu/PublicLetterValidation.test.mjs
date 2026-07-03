import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./PublicLetterValidation.tsx', import.meta.url), 'utf8');

describe('PublicLetterValidation visual safeguards', () => {
  it('keeps the public page stable on mobile viewports', () => {
    assert.match(source, /min-h-dvh/);
    assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
    assert.match(source, /min-w-0 space-y-6/);
    assert.doesNotMatch(source, /min-h-screen|h-screen|backdrop-blur|transition-all|duration-300/);
  });

  it('prevents long public validation values from overflowing cards', () => {
    assert.match(source, /break-words/);
    assert.match(source, /aria-label="Tautan verifikasi surat"/);
    assert.match(source, /aria-label="Token digital surat"/);
    assert.match(source, /Salin tautan verifikasi/);
    assert.match(source, /Salin token digital/);
  });

  it('uses accessible compact tabs and a contained A4 preview region', () => {
    assert.match(source, /role="tablist"/);
    assert.match(source, /role="tab"/);
    assert.match(source, /aria-selected=\{activeTab === 'summary'\}/);
    assert.match(source, /aria-selected=\{activeTab === 'preview'\}/);
    assert.match(source, /role="region"/);
    assert.match(source, /max-h-\[75dvh\]/);
    assert.match(source, /w-max max-w-none/);
    assert.match(source, /renderDownloadCard\('lg:hidden'\)/);
  });
});
