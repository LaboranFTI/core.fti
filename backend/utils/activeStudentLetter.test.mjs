import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getStudyProgramCodeFromNim,
  mapStudyProgramRow
} from './activeStudentLetter.js';

describe('active student letter utilities', () => {
  it('derives only the study-program code from NIM input', () => {
    assert.equal(getStudyProgramCodeFromNim(' 67 2020 001 '), '67');
    assert.equal(getStudyProgramCodeFromNim(''), '');
  });

  it('maps study_programs rows to active-student letter fields', () => {
    assert.deepEqual(
      mapStudyProgramRow({ level: 'Sarjana', name: 'Sistem Informasi' }),
      { studyProgramLevel: 'Sarjana', studyProgramName: 'Sistem Informasi' }
    );
    assert.equal(mapStudyProgramRow(null), null);
  });
});
