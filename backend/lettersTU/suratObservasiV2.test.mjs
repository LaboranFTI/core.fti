import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratObservasiV2.html', import.meta.url), 'utf8');

describe('suratObservasiV2 template', () => {
  it('matches the direct-print signature spacing and name styling', () => {
    assert.match(template, /\.signatures-wrapper\s*\{[\s\S]*margin-top:\s*16mm;/);
    assert.doesNotMatch(template, /\.signatures-wrapper\s*\{[\s\S]*padding:\s*0\s+6mm;/);
    assert.match(template, /\.signatures-wrapper\s+p\s*\{[\s\S]*margin:\s*0;/);
    assert.match(template, /\.signature-area\s*\{[\s\S]*height:\s*24mm;[\s\S]*margin:\s*0;/);
    assert.match(template, /\.signature-name\s*\{[\s\S]*font-weight:\s*bold;[\s\S]*text-decoration:\s*underline;/);
  });
});
