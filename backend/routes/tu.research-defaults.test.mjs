import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Source is now concatenated from all TU sub-modules (modularised from tu.routes.v2.js)
const readTu = (name) => readFileSync(new URL(`./tu/${name}`, import.meta.url), 'utf8');
const source = ['core.js', 'settings.js', 'validation.js', 'requests.active-student.js',
  'requests.counseling.js', 'requests.su-rek.js', 'requests.observation.js',
  'requests.ta.js', 'index.js'].map(readTu).join('\n');

describe('TU research letter defaults', () => {
  it('stores research assignment and advisor labels in TU settings', () => {
    assert.match(source, /'tu_research_assignment_type'/);
    assert.match(source, /'tu_research_advisor_title'/);
    assert.match(source, /'tu_research_advisor_title_first'/);
    assert.match(source, /'tu_research_advisor_title_second'/);
    assert.match(source, /researchAssignmentType:\s*settings\.tu_research_assignment_type/);
    assert.match(source, /researchAdvisorTitle:\s*settings\.tu_research_advisor_title/);
    assert.match(source, /await upsertSystemSetting\(client, 'tu_research_assignment_type', researchAssignmentType \|\| ''\)/);
  });

  it('uses admin defaults when normalizing new research requests and rendering letters', () => {
    assert.match(source, /assignment_type:\s*researchDefaults\.assignmentType/);
    assert.match(source, /normalizeResearchAdvisors\(payload\.advisors, researchDefaults, \{ preserveCustomTitle: false \}\)/);
    assert.match(source, /\{\{assignmentType\}\}': escapeXml\(data\.assignment_type \|\| data\.assignmentType \|\| researchDefaults\.assignmentType\)/);
    assert.match(source, /buildResearchAdvisorSignatureHtml\(advisors, researchDefaults\)/);
  });

  it('supports permission letters as a separate final-task letter type', () => {
    assert.match(source, /const PERMISSION_LETTER_KIND = 'permission'/);
    assert.match(source, /permission:\s*'FTI\/Perizinan'/);
    assert.match(source, /template:\s*'suratPerizinanV2\.html'/);
    assert.match(source, /permission_purpose:\s*String\(payload\.permissionPurpose/);
    assert.match(source, /PERMISSION_ACCESS_CODE_PREFIX = 'IZN'/);
    assert.match(source, /\/tu\/permission-letter\/generate-and-download/);
  });

  it('uses the renamed TA letter request table for final-task letters', () => {
    assert.doesNotMatch(source, /(SELECT \* FROM|INSERT INTO|UPDATE|DELETE FROM)\s+research_requests/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS ta_letter_requests/);
    assert.match(source, /table:\s*'ta_letter_requests'/);
    assert.match(source, /SELECT \* FROM ta_letter_requests/);
    assert.match(source, /INSERT INTO ta_letter_requests/);
  });

  it('keeps a startup migration path from the old research request table name', () => {
    assert.match(source, /ALTER TABLE research_requests RENAME TO ta_letter_requests/);
    assert.match(source, /ALTER INDEX idx_research_requests_letter_number_unique RENAME TO idx_ta_letter_requests_letter_number_unique/);
    assert.match(source, /update_research_requests_updated_at/);
  });
});
