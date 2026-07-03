import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const template = readFileSync(new URL('./suratPerizinanV2.html', import.meta.url), 'utf8');

describe('suratPerizinanV2 template', () => {
  it('renders permission purpose in subject and body placeholders', () => {
    assert.match(template, /Surat Perizinan/);
    assert.match(template, /\{\{letterPurpose\}\}/);
    assert.match(template, /untuk \{\{permissionPurpose\}\}\{\{researchPlacePhrase\}\}/);
    assert.match(template, /<p class="research-title"><strong>&ldquo;\{\{researchTitle\}\}&rdquo;<\/strong><\/p>/);
  });

  it('keeps QR validation and advisor signature placeholders', () => {
    assert.match(template, /src="\{\{validationQrImage\}\}"/);
    assert.match(template, /\{\{advisorSignatureBlock\}\}/);
  });
});
