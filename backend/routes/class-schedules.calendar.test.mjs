import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const routeSource = readFileSync(new URL('./system.routes.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../services/calendar.service.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../database_schema.sql', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../pages/JadwalKuliah.tsx', import.meta.url), 'utf8');

test('class schedule mutations sync CORE Calendar transactionally', () => {
  assert.match(routeSource, /syncClassScheduleToCalendar/);
  assert.match(routeSource, /cancelCalendarEventsForClassSchedule/);
  assert.match(routeSource, /await client\.query\('BEGIN'\)/);
  assert.match(routeSource, /await syncClassScheduleToCalendar\(client, id, req\.user\?\.id\)/);
  assert.match(routeSource, /router\.delete\('\/class-schedules'/);
  assert.match(routeSource, /calendarCancelledCount/);
});

test('semester periods and lab software usage are first-class academic APIs', () => {
  assert.match(routeSource, /router\.get\('\/semester-periods'/);
  assert.match(routeSource, /router\.post\('\/semester-periods'/);
  assert.match(routeSource, /router\.get\('\/semester-lab-usage'/);
  assert.match(routeSource, /syncClassScheduleSoftware/);
  assert.match(routeSource, /applySemesterPeriodDates/);
  assert.match(routeSource, /syncClassSchedulesForSemesterPeriod/);
  assert.match(routeSource, /SET is_active = FALSE/);
  assert.match(routeSource, /MAX_CLASS_SCHEDULE_SOFTWARE_IDS/);
  assert.match(routeSource, /LAB_ROOM_CATEGORY = 'Laboratorium Komputer'/);
  assert.match(schemaSource, /CREATE TABLE semester_periods/);
  assert.match(schemaSource, /CREATE TABLE class_schedule_software/);
});

test('class schedule calendar sync uses stable internal source references and occurrences', () => {
  assert.match(serviceSource, /syncClassScheduleToCalendar/);
  assert.match(serviceSource, /createClassScheduleEventId/);
  assert.match(serviceSource, /createClassScheduleOccurrenceId/);
  assert.match(serviceSource, /source_reference_type = 'class_schedule'/);
  assert.match(serviceSource, /getClassScheduleOccurrenceDates/);
  assert.match(schemaSource, /idx_calendar_events_class_schedule_unique/);
  assert.match(schemaSource, /lecturer_id VARCHAR\(50\)/);
});

test('JadwalKuliah page no longer writes class schedules through Google Calendar', () => {
  assert.doesNotMatch(pageSource, /useGoogleCalendar/);
  assert.doesNotMatch(pageSource, /googleApi\./);
  assert.doesNotMatch(pageSource, /\/api\/calendar\/events/);
  assert.doesNotMatch(pageSource, /\.createEvent\(/);
  assert.doesNotMatch(pageSource, /\.deleteEvent\(/);
  assert.match(pageSource, /CORE Calendar/);
  assert.match(pageSource, /semesterPeriods/);
  assert.match(pageSource, /Software yang Digunakan/);
  assert.match(pageSource, /header: 'Software'/);
  assert.match(pageSource, /software bersifat opsional/);
  assert.match(pageSource, /resolveImportedSoftwareIds/);
});
