import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./Acara.tsx', import.meta.url), 'utf8');

test('Acara groups unique technical needs on each schedule', () => {
  assert.match(source, /interface EventScheduleOption[\s\S]*needs: string\[\];/);
  assert.match(source, /const scheduleNeeds = schedule\.kebutuhan\?\.trim\(\)/);
  assert.match(source, /existingSchedule\.needs\.includes\(scheduleNeeds\)/);
  assert.match(source, /needs: scheduleNeeds \? \[scheduleNeeds\] : \[\]/);
});

test('Acara shows selected schedule needs across list, detail, and event card', () => {
  assert.match(source, /const getScheduleNeeds = \(schedule: EventScheduleOption \| null/);
  assert.match(source, /Kebutuhan Jadwal/);
  assert.match(source, /Kebutuhan Alat/);
  assert.match(source, /activeScheduleNeeds/);
  assert.match(source, /activeSelectedScheduleNeeds/);
  assert.match(source, /Tidak ada kebutuhan khusus/);
});

test('event card needs remain customizable', () => {
  assert.match(source, /checked=\{shareConfig\.needs\}/);
  assert.match(source, /toggleConfig\('needs'\)/);
  assert.match(source, /\{shareConfig\.needs && \(/);
  assert.match(source, /const showAllShareFields = \(\) =>/);
  assert.match(source, /const useCompactShareFields = \(\) =>/);
  assert.match(source, /Tampilkan Semua/);
  assert.match(source, /Tampilan Ringkas/);
});
