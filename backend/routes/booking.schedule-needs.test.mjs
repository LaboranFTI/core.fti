import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const routeSource = readFileSync(new URL('./booking.routes.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../database_schema.sql', import.meta.url), 'utf8');

test('booking schedules schema stores per-schedule technical needs', () => {
  assert.match(
    schemaSource,
    /CREATE TABLE booking_schedules \([\s\S]*kebutuhan TEXT/,
  );
});

test('booking API reads and writes per-schedule technical needs', () => {
  assert.match(
    routeSource,
    /json_build_object\('date', bs2\.schedule_date, 'startTime', bs2\.start_time, 'endTime', bs2\.end_time, 'kebutuhan', bs2\.kebutuhan\)/,
  );

  const scheduleInsertMatches = routeSource.match(
    /INSERT INTO booking_schedules \(booking_id, schedule_date, start_time, end_time, kebutuhan\)/g,
  );
  assert.equal(scheduleInsertMatches?.length, 2);

  const scheduleValueMatches = routeSource.match(
    /\[bookingId, sch\.date, sch\.startTime, sch\.endTime, sch\.kebutuhan \|\| null\]|\[id, sch\.date, sch\.startTime, sch\.endTime, sch\.kebutuhan \|\| null\]/g,
  );
  assert.equal(scheduleValueMatches?.length, 2);
});
