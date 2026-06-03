import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const routeSource = readFileSync(new URL('./user.routes.js', import.meta.url), 'utf8');

test('notifications API returns UI-ready fields and supports clearing notifications', () => {
  assert.match(routeSource, /isRead:\s*row\.is_read/);
  assert.match(routeSource, /timestamp:\s*formatNotificationTimestamp\(row\.created_at\)/);
  assert.match(routeSource, /router\.delete\('\/notifications'/);
  assert.match(routeSource, /DELETE FROM notifications/);
});
