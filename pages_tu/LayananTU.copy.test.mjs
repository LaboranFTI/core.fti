import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./LayananTU.tsx', import.meta.url), 'utf8');

describe('LayananTU active student copy', () => {
  it('does not mention the retired transcript upload flow', () => {
    assert.doesNotMatch(source, /upload transkrip/i);
    assert.match(source, /cek KST, lalu ajukan permohonan surat aktif kuliah/);
  });
});
