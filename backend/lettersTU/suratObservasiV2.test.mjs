import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratObservasiV2.html', import.meta.url), 'utf8');

describe('suratObservasiV2 template', () => {
  it('matches the direct-print name and QR validation layout', () => {
    assert.match(template, /\.signature-block\s*\{[\s\S]*margin-top:\s*14mm;/);
    assert.match(template, /\.signature-block\s*\{[\s\S]*gap:\s*4mm;/);
    assert.match(template, /\.signature-block p\s*\{[\s\S]*margin:\s*0;/);
    assert.match(template, /\.signature-space\s*\{[\s\S]*height:\s*6mm;/);
    assert.match(template, /\.signature-name\s*\{[\s\S]*font-weight:\s*bold;/);
    assert.match(template, /\.validation-qr img\s*\{[\s\S]*width:\s*28mm;[\s\S]*height:\s*28mm;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.doesNotMatch(template, /signatureImage|stampImage|signature-area/);
  });
});
