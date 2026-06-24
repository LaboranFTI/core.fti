import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratObservasiV2.html', import.meta.url), 'utf8');

describe('suratObservasiV2 template', () => {
  it('matches the direct-print name and QR validation layout', () => {
    assert.match(template, /\.signatures-wrapper\s*\{[\s\S]*margin-top:\s*16mm;/);
    assert.match(template, /\.signatures-wrapper\s*\{[\s\S]*grid-template-columns:\s*1fr\s+28mm\s+1fr;/);
    assert.doesNotMatch(template, /\.signatures-wrapper\s*\{[\s\S]*padding:\s*0\s+6mm;/);
    assert.match(template, /\.signatures-wrapper\s+p\s*\{[\s\S]*margin:\s*0;/);
    assert.match(template, /\.signature-space\s*\{[\s\S]*height:\s*18mm;/);
    assert.match(template, /\.signature-name\s*\{[\s\S]*font-weight:\s*bold;[\s\S]*text-decoration:\s*underline;/);
    assert.match(template, /\.validation-qr img\s*\{[\s\S]*width:\s*24mm;[\s\S]*height:\s*24mm;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.doesNotMatch(template, /signatureImage|stampImage|signature-area/);
  });
});
