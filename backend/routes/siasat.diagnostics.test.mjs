import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const routeSource = readFileSync(new URL('./siasat.routes.js', import.meta.url), 'utf8');

test('SIASAT routes log safe structured diagnostics for every SOAP operation', () => {
  assert.match(routeSource, /operation:\s*'getData'/);
  assert.match(routeSource, /operation:\s*'GetKartuStudi'/);
  assert.match(routeSource, /operation:\s*'GetNamaMhs'/);
  assert.match(routeSource, /summarizeSoapResponse/);
  assert.match(routeSource, /responseDiagnostic/);
});

test('SIASAT empty biodata responses expose specific troubleshooting codes', () => {
  assert.match(routeSource, /SIASAT_PROFILE_EMPTY_RESPONSE/);
  assert.match(routeSource, /SIASAT_NAME_EMPTY_RESPONSE/);
});
