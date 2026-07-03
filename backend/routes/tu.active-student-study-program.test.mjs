import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Source is now concatenated from all TU sub-modules (modularised from tu.routes.v2.js)
const readTu = (name) => readFileSync(new URL(`./tu/${name}`, import.meta.url), 'utf8');
const routeSource = ['core.js', 'settings.js', 'validation.js', 'requests.active-student.js',
  'requests.counseling.js', 'requests.su-rek.js', 'requests.observation.js',
  'requests.ta.js', 'index.js'].map(readTu).join('\n');
const legacyRouteSource = readFileSync(new URL('./tu.routes.js', import.meta.url), 'utf8');
const utilsSource = readFileSync(new URL('../utils/activeStudentLetter.js', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('../../pages_tu/components/ActiveStudentForm.tsx', import.meta.url), 'utf8');

const sliceBetween = (source, startText, endText) => {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `${startText} should exist`);
  const end = endText ? source.indexOf(endText, start + startText.length) : -1;
  return source.slice(start, end === -1 ? undefined : end);
};

describe('active-student study program data flow', () => {
  it('does not keep a hardcoded NIM-to-program map in active-student utilities', () => {
    assert.doesNotMatch(utilsSource, /STUDY_PROGRAM_MAP/);
    assert.match(utilsSource, /getStudyProgramCodeFromNim/);
    assert.match(utilsSource, /mapStudyProgramRow/);
  });

  it('resolves active-student program data from study_programs on the backend', () => {
    const activeStudentPost = sliceBetween(
      routeSource,
      "router.post('/active-student'",
      "router.delete('/tu/requests/active-student/:id'"
    );

    assert.match(routeSource, /SELECT id, name, level FROM study_programs WHERE id = \$1 LIMIT 1/);
    assert.match(activeStudentPost, /const studyProgram = await getStudyProgramByNim\(nim\)/);
    assert.match(activeStudentPost, /studyProgram\.studyProgramLevel/);
    assert.match(activeStudentPost, /studyProgram\.studyProgramName/);
    assert.doesNotMatch(activeStudentPost, /studyProgramLevel \|\|/);
    assert.doesNotMatch(activeStudentPost, /studyProgramName \|\|/);
  });

  it('fills active-student generated letters with real program and semester metadata', () => {
    const activeStudentConfig = sliceBetween(routeSource, "'active-student': {", 'observation: {');
    const downloadRoute = sliceBetween(routeSource, "router.get('/tu/requests/:type/:id/download'", "router.get('/active-student/summary'");

    assert.match(activeStudentConfig, /await getStudyProgramByNim\(data\.nim\)/);
    assert.match(activeStudentConfig, /semesterMeta\.semesterName/);
    assert.match(activeStudentConfig, /semesterMeta\.academicYear/);
    assert.match(downloadRoute, /buildLetterPdfBuffer/);
    assert.match(routeSource, /config\.getPlaceholders/);
    assert.doesNotMatch(legacyRouteSource, /Teknik Informatika \/ Sistem Informasi/);
    assert.doesNotMatch(legacyRouteSource, /Ganjil\/Genap/);
    assert.doesNotMatch(legacyRouteSource, /20XX\/20XX/);
  });

  it('uses study_programs API data in the active-student form', () => {
    assert.match(formSource, /useStudyPrograms/);
    assert.match(formSource, /findStudyProgramByNim\(nimValue,\s*programs\)/);
    assert.doesNotMatch(formSource, /deriveStudyProgramFromNim/);
  });
});
