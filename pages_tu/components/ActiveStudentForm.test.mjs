import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ActiveStudentForm.tsx', import.meta.url), 'utf8');

describe('ActiveStudentForm NIM controls', () => {
  it('provides a clear NIM action that resets verification state', () => {
    assert.match(source, /const handleClearNim = \(\) => \{/);
    assert.match(source, /setValue\('nim', ''/);
    assert.match(source, /resetVerifiedFields\(\);/);
    assert.match(source, /setIsVerified\(false\);/);
    assert.match(source, /aria-label="Bersihkan NIM"/);
    assert.match(source, /onClick=\{handleClearNim\}/);
  });
});
