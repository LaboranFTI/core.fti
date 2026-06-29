import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./SuRekForm.tsx', import.meta.url), 'utf8');

describe('SuRekForm access-code flow', () => {
  it('collects email and submits it with the recommendation request', () => {
    assert.match(source, /email:\s*string/);
    assert.match(source, /id="email"/);
    assert.match(source, /type="email"/);
    assert.match(source, /\.\.\.register\("email",\s*\{\s*required:\s*true\s*\}\)/);
    assert.match(source, /email:\s*data\.email/);
  });

  it('uses the public access-code email endpoint for resend', () => {
    assert.match(source, /api\('\/api\/tu\/public\/su-rek\/send-email'/);
    assert.match(source, /JSON\.stringify\(\{\s*accessCode:\s*accessSearchResult\.accessCode\s*\}\)/);
    assert.doesNotMatch(source, /\/api\/tu\/requests\/su-rek\/\$\{accessSearchResult\.accessCode\}\/send-email/);
  });

  it('opens public print preview through the configured API base URL', () => {
    assert.match(source, /import \{ API_BASE_URL \} from '..\/..\/config'/);
    assert.match(source, /const previewUrl = `\$\{API_BASE_URL\}\/api\/tu\/public\/letter-validation\/\$\{accessSearchResult\.validationToken\}\/preview-html`/);
    assert.match(source, /window\.open\(previewUrl, '_blank'\)/);
  });

  it('does not render the recommendation letter live preview inside the request form', () => {
    assert.doesNotMatch(source, /import \{ LetterPreview \}/);
    assert.doesNotMatch(source, /type="su-rek"/);
    assert.doesNotMatch(source, /previewData/);
  });
});
