import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./LetterArchivePanel.tsx', import.meta.url), 'utf8');
const letterSettingsSource = readFileSync(new URL('../lib/letterSettings.ts', import.meta.url), 'utf8');
const statusBadgeSource = readFileSync(new URL('./archive/ArchiveStatusBadge.tsx', import.meta.url), 'utf8');
const detailRowSource = readFileSync(new URL('./archive/DetailRow.tsx', import.meta.url), 'utf8');
const archiveFiltersSource = readFileSync(new URL('./archive/archiveFilters.ts', import.meta.url), 'utf8');

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

  it('keeps archive detail presentation extracted from the panel shell', () => {
    assert.match(source, /<ArchiveStatusBadge status=\{item\.status\} \/>/);
    assert.match(source, /<DetailRow label="Nama" value=\{item\.name\} \/>/);
    assert.doesNotMatch(source, /getStatusBadge/);
    assert.doesNotMatch(source, /function DetailRow/);
    assert.match(statusBadgeSource, /Menunggu/);
    assert.match(statusBadgeSource, /Terverifikasi/);
    assert.match(statusBadgeSource, /Terkirim/);
    assert.match(detailRowSource, /interface DetailRowProps/);
  });

  it('keeps archive filtering and status counts outside the panel shell', () => {
    assert.match(source, /filterArchiveRequests/);
    assert.match(source, /countArchiveStatuses/);
    assert.doesNotMatch(source, /const matchesQuery/);
    assert.doesNotMatch(source, /const normalizedQuery/);
    assert.match(archiveFiltersSource, /export function filterArchiveRequests/);
    assert.match(archiveFiltersSource, /export function countArchiveStatuses/);
    assert.match(archiveFiltersSource, /filteredSuRekRequests/);
    assert.match(archiveFiltersSource, /totalArchiveCount/);
  });
});
