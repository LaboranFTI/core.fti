import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const calendarSource = readFileSync(new URL('./RoomCalendar.tsx', import.meta.url), 'utf8');
const googleCalendarHookSource = readFileSync(new URL('../hooks/useGoogleCalendar.ts', import.meta.url), 'utf8');
const authContextSource = readFileSync(new URL('../src/context/GoogleAuthContext.tsx', import.meta.url), 'utf8');
const bookingManagementSource = readFileSync(new URL('../pages/PesananRuang.tsx', import.meta.url), 'utf8');

test('room calendar reads CORE Calendar first and keeps Google writes legacy-only', () => {
  assert.match(
    calendarSource,
    /fetchCoreEvents\(selectedRoom\.id, timeMin, timeMax\);/,
  );
  assert.match(
    calendarSource,
    /const canManageGoogleLegacy = canManage && googleCalendarConnected && !!selectedRoom\?\.googleCalendarUrl;/,
  );
  assert.match(
    calendarSource,
    /Event dari CORE Calendar bersifat read-only di tampilan ini\./,
  );
});

test('calendar auth metadata separates CORE Calendar from Google legacy', () => {
  assert.match(authContextSource, /coreCalendarConnected/);
  assert.match(authContextSource, /googleCalendarConnected/);
  assert.match(googleCalendarHookSource, /googleCalendarConnected: googleAuth\.googleCalendarConnected/);
});

test('booking approval workflow no longer writes to Google Calendar', () => {
  assert.doesNotMatch(bookingManagementSource, /useGoogleCalendar/);
  assert.doesNotMatch(bookingManagementSource, /\/api\/calendar\/events/);
  assert.doesNotMatch(bookingManagementSource, /googleApi\./);
  assert.match(
    bookingManagementSource,
    /api\(`\/api\/bookings\/\$\{id\}\/status`/,
  );
  assert.match(bookingManagementSource, /CORE Calendar/);
});
