import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./LetterArchivePanel.tsx', import.meta.url), 'utf8');
const letterSettingsSource = readFileSync(new URL('../lib/letterSettings.ts', import.meta.url), 'utf8');

describe('LetterArchivePanel su-rek archive flow', () => {
  it('keeps recommendation letters on the shared TU background payload', () => {
    assert.match(source, /normalizeLetterBackgrounds/);
    assert.match(letterSettingsSource, /suRek:\s*createEmptyLetterAsset\(\)/);
    assert.match(letterSettingsSource, /backgrounds\?\.suRek\?\.imageBase64/);
    assert.match(letterSettingsSource, /suRek:\s*\{\s*\.\.\.empty\.suRek,\s*\.\.\.sharedBackground\s*\}/);
  });

  it('does not offer official print or PDF actions until a letter is verified or sent', () => {
    assert.match(source, /const canSendEmail = item\.status === 'verified' \|\| item\.status === 'sent'/);
    assert.match(source, /onClick=\{handlePrint\} disabled=\{!canSendEmail \|\| isProcessing\}/);
    assert.match(source, /onClick=\{handleDownloadPdf\} disabled=\{!canSendEmail \|\| isProcessing\}/);
    assert.match(source, /PDF Belum Tersedia/);
  });
});
