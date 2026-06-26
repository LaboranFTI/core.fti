import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./AdminPanel.tsx', import.meta.url), 'utf8');

describe('AdminPanel active student detail layout', () => {
  it('removes the unused transcript panel from the active student process view', () => {
    assert.doesNotMatch(source, /Transkrip Nilai/);
    assert.doesNotMatch(source, /selectedRequest\.transcriptBase64/);
    assert.doesNotMatch(source, /title="Transkrip Nilai"/);
  });

  it('uses the available width for the active student letter preview', () => {
    assert.match(source, /grid-cols-1/);
    assert.match(source, /gap-6/);
    assert.match(source, /print:block print:w-full/);
    assert.match(source, /print:m-0 print:p-0/);
    assert.doesNotMatch(source, /xl:grid-cols-12/);
    assert.doesNotMatch(source, /xl:col-span-5/);
    assert.doesNotMatch(source, /xl:col-span-7/);
  });

  it('provides a focused margin editor with live preview for the selected letter type', () => {
    assert.match(source, /selectedLayoutConfigKey/);
    assert.match(source, /setSelectedLayoutConfigKey/);
    assert.match(source, /Margin Area Tulisan \(mm\)/);
    assert.match(source, /Pratinjau Layout Margin Resmi/);
  });
});
