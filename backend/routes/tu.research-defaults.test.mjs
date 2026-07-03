import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./tu.routes.v2.js', import.meta.url), 'utf8');

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
});
