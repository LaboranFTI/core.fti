import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../lib/navigation.ts', import.meta.url), 'utf8');
const labGuardRoutesSource = readFileSync(new URL('../backend/routes/labguard.routes.js', import.meta.url), 'utf8');

describe('LabGuard access control', () => {
  it('limits the LabGuard route to Admin, Laboran, and Supervisor', () => {
    const routeBlock = appSource.match(/<Route path="\/labguard"[\s\S]*?\}\s*\/>/)?.[0] || '';

    assert.match(routeBlock, /allowedRoles=\{\[Role\.ADMIN,\s*Role\.LABORAN,\s*Role\.SUPERVISOR\]\}/);
    assert.doesNotMatch(routeBlock, /Role\.DOSEN/);
    assert.doesNotMatch(routeBlock, /Role\.MAHASISWA/);
    assert.doesNotMatch(routeBlock, /Role\.ADMIN_TU/);
    assert.doesNotMatch(routeBlock, /Role\.USER_TU/);
    assert.doesNotMatch(routeBlock, /Role\.LEMBAGA_KEMAHASISWAAN/);
  });

  it('shows LabGuard navigation only for Admin, Laboran, and Supervisor', () => {
    const navBlock = navigationSource.match(/id:\s*"labguard"[\s\S]*?\n\s*\},\n\];/)?.[0] || '';

    assert.match(navBlock, /Role\.ADMIN/);
    assert.match(navBlock, /Role\.LABORAN/);
    assert.match(navBlock, /Role\.SUPERVISOR/);
    assert.doesNotMatch(navBlock, /Role\.DOSEN/);
    assert.doesNotMatch(navBlock, /Role\.MAHASISWA/);
    assert.doesNotMatch(navBlock, /Role\.ADMIN_TU/);
    assert.doesNotMatch(navBlock, /Role\.USER_TU/);
    assert.doesNotMatch(navBlock, /Role\.LEMBAGA_KEMAHASISWAAN/);
  });

  it('protects every LabGuard API endpoint with the same role whitelist', () => {
    assert.match(labGuardRoutesSource, /const LABGUARD_ROLES = \['Admin', 'Laboran', 'Supervisor'\];/);
    assert.match(labGuardRoutesSource, /router\.use\(verifyRole\(LABGUARD_ROLES\)\);/);
    assert.doesNotMatch(labGuardRoutesSource, /LABGUARD_ROLES[\s\S]*?'Dosen'/);
  });
});
