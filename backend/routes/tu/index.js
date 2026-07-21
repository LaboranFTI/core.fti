/**
 * index.js — TU Routes Aggregator
 *
 * This module is the single entry point for all TU (Tata Usaha) routes.
 * It composes all sub-routers and handles the few remaining generic routes
 * that don't belong to any specific domain sub-router:
 *   - /tu/preview-html (inline HTML preview from form data)
 *   - /tu/requests/:type/:id/preview-html (preview saved request)
 *   - /tu/requests/:type/:id/download (admin PDF download)
 *   - /tu/letter-numbering (admin view of letter counters)
 *   - /upload-session (ephemeral file upload staging)
 */

import express from 'express';

import {
  pool,
  verifyRole,
  TU_ACCESS_ROLES,
  TU_ADMIN_ROLES,
  publicValidationLimiter,
  uploadSessions,
  ensureTuInfrastructure,
  letterConfig,
  buildLetterHtml,
  buildLetterPdfBuffer,
  ensureLetterValidationToken,
  getResearchLetterType
} from './core.js';

// Sub-routers
import settingsRouter from './settings.js';
import validationRouter from './validation.js';
import activeStudentRouter from './requests.active-student.js';
import counselingRouter from './requests.counseling.js';
import suRekRouter from './requests.su-rek.js';
import observationRouter from './requests.observation.js';
import taRouter from './requests.ta.js';

const router = express.Router();

// ─── Mount all sub-routers ────────────────────────────────────────────────────

router.use(settingsRouter);
router.use(validationRouter);
router.use(activeStudentRouter);
router.use(counselingRouter);
router.use(suRekRouter);
router.use(observationRouter);
router.use(taRouter);

// ─── Generic: inline preview-html from form data ─────────────────────────────

router.post('/tu/preview-html', verifyRole([...TU_ACCESS_ROLES, 'Mahasiswa']), async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).send('Parameter type dan data diperlukan.');
  }
  try {
    const html = await buildLetterHtml(type, data, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Preview HTML error:', err);
    res.status(500).send('Gagal membuat pratinjau surat.');
  }
});

router.post('/tu/preview-pdf', verifyRole([...TU_ACCESS_ROLES, 'Mahasiswa']), async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).send('Parameter type dan data diperlukan.');
  }
  try {
    const pdfBuffer = await buildLetterPdfBuffer(type, data, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Preview PDF error:', err);
    res.status(500).send('Gagal membuat pratinjau surat.');
  }
});

// ─── Generic: preview saved request as HTML ──────────────────────────────────

router.get('/tu/requests/:type/:id/preview-html', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];
  if (!config) {
    return res.status(400).send('Jenis surat tidak valid.');
  }
  try {
    const result = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Pengajuan tidak ditemukan.');
    }
    const requestData = result.rows[0];
    const html = await buildLetterHtml(type, requestData, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Saved preview HTML error:', err);
    res.status(500).send('Gagal membuat pratinjau surat.');
  }
});

// ─── Public: preview validation HTML (duplicate of validation.js coverage)
//     Included here so the monolith export still works correctly.

router.get('/tu/public/letter-validation/:token/preview-html', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).send('Token validasi tidak valid.');
  }
  try {
    await ensureTuInfrastructure();
    const [activeResult, observationResult, counselingResult, researchResult, suRekResult] = await Promise.all([
      pool.query(`SELECT * FROM active_student_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM observation_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM counseling_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM ta_letter_requests WHERE validation_token = $1 LIMIT 1`, [token]),
      pool.query(`SELECT * FROM su_rek_requests WHERE validation_token = $1 LIMIT 1`, [token])
    ]);
    const type = activeResult.rows.length > 0
      ? 'active-student'
      : observationResult.rows.length > 0
        ? 'observation'
        : counselingResult.rows.length > 0
          ? 'counseling'
          : researchResult.rows.length > 0
            ? getResearchLetterType(researchResult.rows[0])
            : suRekResult.rows.length > 0
              ? 'su-rek'
              : null;
    const requestData = activeResult.rows[0] || observationResult.rows[0] || counselingResult.rows[0] || researchResult.rows[0] || suRekResult.rows[0];
    if (!type || !requestData) {
      return res.status(404).send('Surat tidak ditemukan atau token validasi tidak terdaftar.');
    }
    const html = await buildLetterHtml(type, requestData, req);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Public validation preview HTML error:', err);
    res.status(500).send('Gagal memvalidasi surat.');
  }
});

// ─── Admin: letter numbering history ─────────────────────────────────────────

router.get('/tu/letter-numbering', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT letter_type, year, month, last_sequence, last_letter_number, last_generated_at, updated_at
       FROM tu_letter_number_counters
       ORDER BY year DESC, month DESC, letter_type ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get TU letter numbering error:', err);
    res.status(500).json({ error: 'Gagal mengambil data nomor surat TU.' });
  }
});

// ─── Generic: admin PDF download for any verified letter ─────────────────────

router.get('/tu/requests/:type/:id/download', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];

  if (!config) {
    return res.status(400).json({ error: 'Jenis surat tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }
    if (!['verified', 'sent'].includes(result.rows[0].status)) {
      return res.status(403).json({ error: 'Surat belum berstatus resmi.' });
    }

    const requestData = await ensureLetterValidationToken(pool, type, result.rows[0]);
    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);

    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download PDF error:', err);
    res.status(500).json({ error: 'Gagal mendownload PDF dokumen.' });
  }
});

// ─── Upload session (ephemeral base64 staging for mobile QR download) ────────

router.post('/upload-session', async (req, res) => {
  const sessionId = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  uploadSessions.set(sessionId, { status: 'pending', fileBase64: null, fileName: null });
  setTimeout(() => uploadSessions.delete(sessionId), 15 * 60 * 1000);
  res.json({ success: true, sessionId });
});

router.post('/upload-session/:id', async (req, res) => {
  const { id } = req.params;
  const { fileBase64, fileName } = req.body;

  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah kadaluarsa' });
  }

  uploadSessions.set(id, { status: 'completed', fileBase64, fileName });
  res.json({ success: true });
});

router.get('/upload-session/:id', async (req, res) => {
  const { id } = req.params;

  if (!uploadSessions.has(id)) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan' });
  }

  const sessionData = uploadSessions.get(id);
  res.json({ success: true, data: sessionData });

  if (sessionData.status === 'completed') {
    uploadSessions.delete(id);
  }
});

export default router;
