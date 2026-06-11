import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const calendarSource = readFileSync(new URL('./RoomCalendar.tsx', import.meta.url), 'utf8');
const googleCalendarHookSource = readFileSync(new URL('../hooks/useGoogleCalendar.ts', import.meta.url), 'utf8');

test('Admin TU can authenticate to read private room calendars without management access', () => {
  assert.match(
    calendarSource,
    /const canAuthenticate = canManage \|\| role === Role\.ADMIN_TU;/,
  );
  assert.match(calendarSource, /\{canAuthenticate && \(\s*<div className="flex items-center">/);
  assert.doesNotMatch(
    calendarSource,
    /const canManage = [^;]*Role\.ADMIN_TU/,
  );
  assert.match(
    googleCalendarHookSource,
    /role === Role\.ADMIN \|\| role === Role\.LABORAN\) \? SCOPES\.READWRITE : SCOPES\.READONLY/,
  );
});

test('room calendar reloads events after Google authentication changes', () => {
  assert.match(
    calendarSource,
    /\[selectedRoom, isGapiInitialized, isAuthenticated, currentDate, viewMode\]/,
  );
});
