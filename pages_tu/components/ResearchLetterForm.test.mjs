import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('./ResearchLetterForm.tsx', import.meta.url), 'utf8');

describe('ResearchLetterForm admin-controlled defaults', () => {
  it('keeps assignment type and advisor titles controlled by TU settings', () => {
    assert.match(source, /api\('\/api\/tu\/letter-backgrounds'\)/);
    assert.match(source, /json\.researchAssignmentType/);
    assert.match(source, /json\.researchAdvisorTitle/);
    assert.match(source, /assignmentType:\s*researchDefaults\.assignmentType/);
    assert.match(source, /title:\s*getResearchAdvisorTitle\(index, advisors\.length, researchDefaults\)/);
  });

  it('does not expose assignment type or advisor title as editable request fields', () => {
    assert.match(source, /<input type="hidden" \{\.\.\.register\('assignmentType'\)\} \/>/);
    assert.match(source, /<input type="hidden" \{\.\.\.register\(`advisors\.\$\{index\}\.title` as const\)\} \/>/);
    assert.doesNotMatch(source, /<Input id="assignmentType"/);
    assert.doesNotMatch(source, />Label Jabatan</);
  });

  it('supports permission letters with a required purpose field', () => {
    assert.match(source, /type ResearchLetterVariant = 'research' \| 'interview' \| 'permission'/);
    assert.match(source, /endpointBase:\s*'\/api\/tu\/permission-letter'/);
    assert.match(source, /id="permissionPurpose"/);
    assert.match(source, /Keperluan izin wajib diisi\./);
  });
});
