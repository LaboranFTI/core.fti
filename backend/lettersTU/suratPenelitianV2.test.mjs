import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratPenelitianV2.html', import.meta.url), 'utf8');

describe('suratPenelitianV2 template', () => {
  it('uses one QR validation block without manual signature space', () => {
    assert.match(template, /\.signature-block\s*\{[\s\S]*grid-template-columns:\s*28mm auto;/);
    assert.match(template, /\.validation-qr img\s*\{[\s\S]*width:\s*28mm;[\s\S]*height:\s*28mm;/);
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.doesNotMatch(template, /signature-space|signatureImage|stampImage|signature-area/);
  });

  it('supports optional advisor signatures beside the required dean signature', () => {
    assert.match(template, /\{\{deanName\}\}/);
    assert.match(template, /\{\{deanTitle\}\}/);
    assert.match(template, /\{\{advisorSignatureBlock\}\}/);
    assert.match(template, /\.signature-lines\.with-advisors\s*\{[\s\S]*grid-template-columns:/);
  });

  it('separates the letter destination from the actual research place', () => {
    assert.match(template, /\{\{destinationPlace\}\}/);
    assert.match(template, /\{\{destinationAddress\}\}/);
    assert.match(template, /melakukan penelitian\{\{researchPlacePhrase\}\}/);
  });
});
