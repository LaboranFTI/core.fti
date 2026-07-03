/**
 * tu.routes.v2.js — Backward-compatible re-export wrapper
 *
 * This file previously contained all TU (Tata Usaha) route handlers inline (~5 500 lines).
 * It has been modularized into backend/routes/tu/ with the following sub-modules:
 *
 *   core.js                   — shared setup: DB, rate-limiters, helpers, HTML builders
 *   settings.js               — GET/POST /tu/settings, GET /tu/letter-backgrounds
 *   validation.js             — public letter-validation endpoints
 *   requests.active-student.js — active student requests
 *   requests.counseling.js    — counseling requests
 *   requests.su-rek.js        — recommendation letter requests
 *   requests.observation.js   — observation letter requests
 *   requests.ta.js            — research / interview / permission letter requests
 *   index.js                  — aggregator: mounts all sub-routers + generic routes
 *
 * All route handlers are now in index.js. This file is kept for backward
 * compatibility with any import that already uses 'tu.routes.v2.js'.
 */

export { default } from './tu/index.js';
