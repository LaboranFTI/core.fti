import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageUrl = new URL('./ManajemenProgramStudi.tsx', import.meta.url);
const navigationSource = readFileSync(new URL('../lib/navigation.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../backend/routes/study_program.routes.js', import.meta.url), 'utf8');

test('study program management is connected to navigation and protected routing', () => {
  assert.match(navigationSource, /id:\s*['"]manajemen-program-studi['"]/);
  assert.match(navigationSource, /label:\s*['"]Program Studi['"]/);
  assert.match(appSource, /import\(['"]\.\/pages\/ManajemenProgramStudi['"]\)/);
  assert.match(appSource, /path="\/manajemen-program-studi"/);
  assert.match(appSource, /allowedRoles=\{\[Role\.ADMIN,\s*Role\.ADMIN_TU\]\}/);
});

test('study program management page reuses shared management components and CRUD API', () => {
  const pageSource = readFileSync(pageUrl, 'utf8');

  assert.match(pageSource, /useStudyPrograms/);
  assert.match(pageSource, /<PageHeader/);
  assert.match(pageSource, /<PageCard/);
  assert.match(pageSource, /<SearchBar/);
  assert.match(pageSource, /<Pagination/);
  assert.match(pageSource, /<ConfirmModal/);
  assert.match(pageSource, /usePagination\(filteredStudyPrograms,\s*10\)/);
  assert.match(pageSource, /api\(['"]\/api\/study-programs['"]/);
  assert.match(pageSource, /api\(`\/api\/study-programs\/\$\{formData\.id\}`/);
  assert.match(pageSource, /api\(`\/api\/study-programs\/\$\{studyProgramToDelete\.id\}`/);
});

test('study program API exposes protected create update and delete mutations', () => {
  assert.match(routeSource, /verifyRole/);
  assert.match(routeSource, /router\.post\(['"]\/study-programs['"],\s*verifyRole\(\[['"]Admin['"],\s*['"]Admin TU['"]\]\)/);
  assert.match(routeSource, /INSERT INTO study_programs/);
  assert.match(routeSource, /router\.put\(['"]\/study-programs\/:id['"],\s*verifyRole\(\[['"]Admin['"],\s*['"]Admin TU['"]\]\)/);
  assert.match(routeSource, /UPDATE study_programs/);
  assert.match(routeSource, /router\.delete\(['"]\/study-programs\/:id['"],\s*verifyRole\(\[['"]Admin['"],\s*['"]Admin TU['"]\]\)/);
  assert.match(routeSource, /DELETE FROM study_programs/);
});
