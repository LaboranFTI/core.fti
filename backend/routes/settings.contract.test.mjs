import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyToken } from '../middleware/auth.js';

const settingsPageSource = readFileSync(new URL('../../pages/Settings.tsx', import.meta.url), 'utf8');
const settingsRouteSource = readFileSync(new URL('./settings.routes.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');

const invokeVerifyToken = (method, path) => {
  let nextCalled = false;
  let statusCode = 200;
  let body;

  verifyToken(
    { method, path, headers: {} },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
    () => {
      nextCalled = true;
    },
  );

  return { nextCalled, statusCode, body };
};

test('settings page writes the same contract exposed by settings routes', () => {
  assert.match(
    settingsPageSource,
    /api\('\/api\/settings\/maintenance',[\s\S]{0,180}method:\s*'PUT'[\s\S]{0,180}data:\s*\{\s*enabled:\s*newState\s*\}/,
  );
  assert.match(
    settingsRouteSource,
    /router\.put\('\/settings\/maintenance'[\s\S]{0,180}const\s*\{\s*enabled\s*\}\s*=\s*req\.body/,
  );

  assert.match(
    settingsPageSource,
    /api\('\/api\/settings\/announcement',[\s\S]{0,160}method:\s*'PUT'/,
  );

  assert.match(settingsPageSource, /formData\.append\('file',\s*restoreFile!\)/);
  assert.match(settingsRouteSource, /upload\.single\('file'\)/);

  assert.match(
    settingsRouteSource,
    /const\s*\{\s*enabled,\s*clientId,\s*domain\s*\}\s*=\s*req\.body/,
  );
});

test('app-shell settings reads are owned by settings routes and public only for GET', () => {
  assert.match(settingsRouteSource, /router\.get\('\/settings\/maintenance',\s*async/);
  assert.match(settingsRouteSource, /router\.get\('\/settings\/announcement',\s*async/);
  assert.match(settingsRouteSource, /router\.get\('\/settings\/sso-config',\s*async/);

  assert.doesNotMatch(serverSource, /app\.get\('\/api\/settings\/maintenance'/);
  assert.doesNotMatch(serverSource, /app\.get\('\/api\/settings\/announcement'/);
  assert.doesNotMatch(serverSource, /app\.get\('\/api\/settings\/sso-config'/);

  for (const path of [
    '/settings/maintenance',
    '/settings/announcement',
    '/settings/sso-config',
  ]) {
    assert.equal(invokeVerifyToken('GET', path).nextCalled, true, `${path} GET should be public`);
    assert.equal(invokeVerifyToken('PUT', path).statusCode, 401, `${path} PUT should require a token`);
  }
});
