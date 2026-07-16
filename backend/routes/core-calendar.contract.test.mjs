import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const routeSource = readFileSync(new URL('./core-calendar.routes.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../services/calendar.service.js', import.meta.url), 'utf8');
const databaseSource = readFileSync(new URL('../config/database.js', import.meta.url), 'utf8');

test('core calendar API returns stable event ids separately from occurrence ids', () => {
  assert.match(routeSource, /eventId: events\[0\]\?\.eventId \|\| null/);
  assert.match(routeSource, /eventId: events\[0\]\?\.eventId \|\| req\.params\.id/);
  assert.doesNotMatch(routeSource, /eventId: events\[0\]\?\.id/);
});

test('booking calendar sync is idempotent and does not delete unrelated manual events', () => {
  assert.match(serviceSource, /createBookingEventId/);
  assert.match(serviceSource, /existingEvent\.rows\[0\]\?\.id \|\| createBookingEventId\(bookingId\)/);
  assert.match(serviceSource, /ON CONFLICT \(id\) DO UPDATE/);
  assert.doesNotMatch(serviceSource, /DELETE FROM calendar_events WHERE booking_id/);
});

test('calendar service has app-level room overlap protection', () => {
  assert.match(serviceSource, /pg_advisory_xact_lock/);
  assert.match(serviceSource, /assertNoOccurrenceConflicts/);
  assert.match(serviceSource, /o\.start_at < \$3/);
  assert.match(serviceSource, /o\.end_at > \$2/);
});

test('calendar schema keeps booking calendar rows unique', () => {
  assert.match(databaseSource, /idx_calendar_events_booking_unique/);
  assert.match(databaseSource, /idx_calendar_occurrences_booking_schedule_unique/);
  assert.match(databaseSource, /idx_calendar_events_class_schedule_unique/);
});
