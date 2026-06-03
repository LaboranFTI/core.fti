import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const routeSource = readFileSync(new URL('./system.routes.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../database_schema.sql', import.meta.url), 'utf8');

test('staff routes maintain position period records across activation changes', () => {
  assert.match(schemaSource, /CREATE TABLE staff_position_periods/);
  assert.match(schemaSource, /period_number INT NOT NULL/);
  assert.match(schemaSource, /end_date DATE/);
  assert.match(routeSource, /syncStaffPositionPeriod/);
  assert.match(routeSource, /positionStartDate/);
  assert.match(routeSource, /positionEndDate/);
  assert.match(routeSource, /INSERT INTO staff_position_periods/);
  assert.match(routeSource, /end_date = \$\d+/);
});
