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
    assert.match(source, /className="grid grid-cols-1 gap-6"/);
    assert.match(source, /className="print:block print:w-full print:m-0 print:p-0"/);
    assert.doesNotMatch(source, /xl:grid-cols-12/);
    assert.doesNotMatch(source, /xl:col-span-5/);
    assert.doesNotMatch(source, /xl:col-span-7/);
  });
});
