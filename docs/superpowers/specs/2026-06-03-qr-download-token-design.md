# QR Download Token Design

## Goal

Replace public QR download tokens that expose `observation_requests.id` with unguessable random tokens that are stored only as hashes and expire after a maximum of 24 hours.

## Current Behavior

`POST /api/tu/observation-letter/generate-qr-link` creates or updates an observation request, then returns a public QR URL whose token is `requestData.id`. `GET /api/tu/public/qr-download/:token` falls back to querying `observation_requests WHERE id = $1`, which makes the public request id a valid download credential.

## Selected Approach

Store one active QR download token per observation request:

- Generate a random 32-byte token with Node `crypto`.
- Return only the raw token in the public QR URL.
- Store `sha256(rawToken)` in `observation_requests.qr_download_token_hash`.
- Store `NOW + 24 hours` in `observation_requests.qr_download_token_expires_at`.
- Resolve public downloads by token hash and expiry, never by request id.

This keeps the change scoped to observation QR downloads while avoiding a separate token table until broader public download support is needed.

## Data Changes

Add nullable columns to `observation_requests`:

- `qr_download_token_hash VARCHAR(64)`
- `qr_download_token_expires_at TIMESTAMPTZ`

Add an index on `qr_download_token_hash` for lookup speed. The runtime TU infrastructure initializer and `database_schema.sql` should both include the new columns.

## API Behavior

`POST /api/tu/observation-letter/generate-qr-link`:

- Continues to require `TU_SUBMIT_ROLES`.
- Issues a fresh random token every time a QR link is generated.
- Persists the token hash and 24-hour expiry in the same transaction as the request update.
- Returns `{ success, qrUrl, token, expiresAt }`.

`GET /api/tu/public/qr-download/:token`:

- Hashes the supplied token.
- Finds an observation request where the stored hash matches and expiry is still in the future.
- Returns 404 with an expiry-oriented message when missing or expired.
- Does not accept `OBS-...` ids as valid public download credentials.

Existing in-memory `QR-...` download sessions can remain temporarily if other legacy code depends on them, but the observation-request fallback by id must be removed.

## Testing

Add a focused backend source-level regression test first:

- QR generation must not assign `requestData.id` to `token`.
- QR generation must hash a random token and persist an expiry.
- Public QR download lookup must use `qr_download_token_hash` and `qr_download_token_expires_at`.
- Public QR download must not query `observation_requests WHERE id = $1` for non-`QR-` tokens.

Then run the new test and a production build.
