import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const formSource = readFileSync(new URL('./BookingForm.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./BookingDetailModal.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../types.ts', import.meta.url), 'utf8');

test('booking form keeps technical needs on each schedule and can copy the previous schedule needs', () => {
  assert.match(formSource, /interface ScheduleEntry[\s\S]*kebutuhan: string;/);
  assert.match(formSource, /const emptySchedule[\s\S]*kebutuhan: ""/);
  assert.match(formSource, /Kebutuhan Alat\/Teknis/);
  assert.match(formSource, /Kebutuhan sama dengan jadwal sebelumnya/);
  assert.match(formSource, /copyPreviousScheduleNeeds/);
  assert.match(
    formSource,
    /schedules: [^;]*\.map\(\(\{ date, startTime, endTime, kebutuhan \}\)/s,
  );
  assert.match(typesSource, /schedules\?: \{ date: string; startTime: string; endTime: string; kebutuhan\?: string \}\[\]/);
});

test('booking form only requires a proposal PDF from non-manager roles', () => {
  assert.match(
    formSource,
    /const userRole = \(\s*sessionStorage\.getItem\("currentRole"\) \|\|\s*localStorage\.getItem\("currentRole"\)\s*\) as Role;/,
  );
  assert.match(
    formSource,
    /const canManage =[\s\S]*userRole === Role\.ADMIN \|\|[\s\S]*userRole === Role\.LABORAN \|\|[\s\S]*userRole === Role\.SUPERVISOR;/,
  );
  assert.match(formSource, /const isUploadRequired = !canManage;/);
  assert.match(
    formSource,
    /if \(isUploadRequired && !bookingFile && !proposalFileBase64 && !hasExistingFile\)/,
  );
  assert.match(formSource, /canManage \? "Opsional" : "Wajib"/);
});

test('booking detail table displays technical needs for each schedule', () => {
  assert.match(detailSource, /<TableHead[^>]*>Kebutuhan<\/TableHead>/);
  assert.match(detailSource, /s\.kebutuhan \|\| "—"/);
});
