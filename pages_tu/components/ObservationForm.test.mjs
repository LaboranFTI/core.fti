import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ObservationForm.tsx', import.meta.url), 'utf8');

describe('ObservationForm student limit', () => {
  it('allows up to seven students in an observation letter', () => {
    assert.match(source, /const MAX_OBSERVATION_STUDENTS = 7;/);
    assert.match(source, /\{fields\.length\}\s*\/\s*\{MAX_OBSERVATION_STUDENTS\}/);
    assert.match(source, /fields\.length < MAX_OBSERVATION_STUDENTS/);
    assert.match(source, /fields\.length >= MAX_OBSERVATION_STUDENTS/);
    assert.doesNotMatch(source, /\{fields\.length\}\s*\/\s*5/);
  });
});
