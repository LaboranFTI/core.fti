import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ValidationQrCode.tsx', import.meta.url), 'utf8');

describe('ValidationQrCode', () => {
  it('uses a circular white logo container in the QR center', () => {
    assert.match(source, /rounded-full bg-white/);
    assert.doesNotMatch(source, /rounded-md bg-white/);
  });
});
