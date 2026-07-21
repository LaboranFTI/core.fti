/**
 * requests.ta.js
 * Sub-router for Final Assignment (TA) letter requests:
 *   - Research (Penelitian)
 *   - Interview (Wawancara)
 *   - Permission (Perizinan)
 *
 * Also handles the generic /:type/:id routes that cover all letter types
 * (send-email, validation-token, preview-html, download).
 */

import express from 'express';
import { sendMail, buildProfessionalEmail, getStandardEmailAttachments } from '../../utils/mailer.js';
import {
  pool,
  verifyRole,
  TU_ADMIN_ROLES,
  TU_ACCESS_ROLES,
  TU_SUBMIT_ROLES,
  publicObservationAccessLimiter,
  ensureTuInfrastructure,
  letterConfig,
  ensureLetterNumber,
  ensureLetterValidationToken,
  buildLetterPdfBuffer,
  buildPublicValidationUrl,
  buildLetterHtml,
  buildLetterValidationPayload,
  getResearchLetterType,
  createFinalResearchRequest,
  normalizeResearchAccessCode,
  buildResearchAccessPayload,
  buildResearchSignerList,
  mapResearchRow,
  mapActiveStudentRow,
  mapObservationRow,
  mapCounselingRow,
  
  isValidEmailAddress,
  escapeXml,
  INTERVIEW_LETTER_KIND,
  PERMISSION_LETTER_KIND,
  RESEARCH_LETTER_KIND,
  getTuSettingsPayload,
  getSharedLetterBackground,
  LETTER_TYPE_TO_CLIENT_KEY,
  normalizeLetterLayout,
  DEFAULT_LETTER_LAYOUT_MM,
  recalculateLetterCounter
} from './core.js';

const router = express.Router();

// ─── Generic: send-email via DB record ────────────────────────────────────────

function mapGenericRow(type, row) {
  if (!row) return row;
  switch (type) {
    case 'active-student': return mapActiveStudentRow(row);
    case 'observation': return mapObservationRow(row);
    case 'counseling': return mapCounselingRow(row);
    case 'research':
    case 'interview':
    case 'permission':
    case 'ta': return mapResearchRow(row);
    default: return row;
  }
}

router.post('/tu/requests/:type/:id/send-email', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { type, id } = req.params;
  const config = letterConfig[type];

  if (!config) {
    return res.status(400).json({ error: 'Jenis surat tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const client = await pool.connect();
    let requestData;

    try {
      await client.query('BEGIN');
      const result = await client.query(`SELECT * FROM ${config.table} WHERE id = $1 FOR UPDATE`, [id]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
      }

      const status = result.rows[0].status;
      if (status === 'pending' || status === 'rejected') {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Hanya surat yang sudah diverifikasi yang dapat dikirim email.' });
      }

      requestData = await ensureLetterNumber(client, type, result.rows[0]);
      requestData = await ensureLetterValidationToken(client, type, requestData);
      await client.query('COMMIT');
      client.release();
    } catch (txErr) {
      await client.query('ROLLBACK');
      client.release();
      throw txErr;
    }

    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const accessCodeBlock = requestData.access_code
      ? `<p style="margin-top: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${escapeXml(requestData.access_code)}</span></p>`
      : '';
      
    const emailHtml = buildProfessionalEmail({
      title: config.subject,
      contentHtml: `
        <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
        ${config.emailBody}
        <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          ${accessCodeBlock}
          <p style="margin-bottom: 0;"><strong>Validasi surat:</strong> <br/><a href="${validationUrl}" style="color: #1d4ed8; word-break: break-all;">${validationUrl}</a></p>
        </div>
      `
    });

    const attachments = getStandardEmailAttachments();
    attachments.push({
      filename: `${(requestData.letter_number || config.pdfFilename).replace(/\//g, '_')}_${requestData.nim}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });

    await sendMail({
      to: requestData.email,
      subject: `${config.subject} - ${requestData.name}`,
      html: emailHtml,
      attachments
    });

    console.log(`[Mailer] Email terkirim ke ${requestData.email}`);

    await pool.query(`UPDATE ${config.table} SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

    res.json({
        success: true,
        message: 'Email berhasil dikirim',
        letterNumber: requestData.letter_number,
        validationToken: requestData.validation_token,
        validationUrl,
        data: mapGenericRow(type, requestData)
      });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email. Pastikan konfigurasi SMTP di .env sudah benar.' });
  }
});

// ─── Generic: create/refresh validation token ────────────────────────────────

router.post('/tu/requests/:type/:id/validation-token', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
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
      return res.status(400).json({ error: 'Token validasi hanya dapat dibuat untuk surat yang sudah diverifikasi.' });
    }

    const requestData = await ensureLetterValidationToken(pool, type, result.rows[0]);
    res.json({
      success: true,
      validationToken: requestData.validation_token,
      validationUrl: buildPublicValidationUrl(req, requestData.validation_token),
      data: mapGenericRow(type, requestData)
    });
  } catch (err) {
    console.error('Create validation token error:', err);
    res.status(500).json({ error: 'Gagal membuat token validasi surat.' });
  }
});

// ─── Research requests ────────────────────────────────────────────────────────

router.delete('/tu/requests/research/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = $1 AND (letter_kind = 'research' OR letter_kind IS NULL) RETURNING id, name, nim, letter_generated_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await recalculateLetterCounter(
        'research', 'ta_letter_requests', 'research',
        date.getFullYear(), date.getMonth() + 1
      );
    }
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete research error:', err);
    res.status(500).json({ error: 'Gagal menghapus data penelitian.' });
  }
});

router.post('/tu/requests/research/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = ANY($1::text[]) AND (letter_kind = 'research' OR letter_kind IS NULL) RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );

    const affectedPeriods = new Set();
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        affectedPeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
      }
    }
    for (const period of affectedPeriods) {
      const [year, month] = period.split('-').map(Number);
      await recalculateLetterCounter(
        'research', 'ta_letter_requests', 'research', year, month
      );
    }

    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete research error:', err);
    res.status(500).json({ error: 'Gagal menghapus data penelitian secara batch.' });
  }
});

// ─── Interview requests ───────────────────────────────────────────────────────

router.delete('/tu/requests/interview/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = $1 AND letter_kind = 'interview' RETURNING id, name, nim, letter_generated_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await recalculateLetterCounter(
        'interview', 'ta_letter_requests', 'interview',
        date.getFullYear(), date.getMonth() + 1
      );
    }
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete interview error:', err);
    res.status(500).json({ error: 'Gagal menghapus data wawancara.' });
  }
});

router.post('/tu/requests/interview/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = ANY($1::text[]) AND letter_kind = 'interview' RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );

    const affectedPeriods = new Set();
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        affectedPeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
      }
    }
    for (const period of affectedPeriods) {
      const [year, month] = period.split('-').map(Number);
      await recalculateLetterCounter(
        'interview', 'ta_letter_requests', 'interview', year, month
      );
    }

    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete interview error:', err);
    res.status(500).json({ error: 'Gagal menghapus data wawancara secara batch.' });
  }
});

// ─── Permission requests ──────────────────────────────────────────────────────

router.delete('/tu/requests/permission/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = $1 AND letter_kind = 'permission' RETURNING id, name, nim, letter_generated_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await recalculateLetterCounter(
        'permission', 'ta_letter_requests', 'permission',
        date.getFullYear(), date.getMonth() + 1
      );
    }
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete permission error:', err);
    res.status(500).json({ error: 'Gagal menghapus data perizinan.' });
  }
});

router.post('/tu/requests/permission/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM ta_letter_requests WHERE id = ANY($1::text[]) AND letter_kind = 'permission' RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );

    const affectedPeriods = new Set();
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        affectedPeriods.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
      }
    }
    for (const period of affectedPeriods) {
      const [year, month] = period.split('-').map(Number);
      await recalculateLetterCounter(
        'permission', 'ta_letter_requests', 'permission', year, month
      );
    }

    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete permission error:', err);
    res.status(500).json({ error: 'Gagal menghapus data perizinan secara batch.' });
  }
});

router.put('/tu/requests/ta/:id/reject', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM ta_letter_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }
    if (existingResult.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Hanya pengajuan dengan status pending yang dapat ditolak.' });
    }
    
    let requestData = existingResult.rows[0];
    const reason = rejection_reason || 'Tidak ada alasan yang diberikan.';
    
    await client.query(
      `UPDATE ta_letter_requests
       SET status = 'rejected',
           rejection_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, id]
    );
    await client.query('COMMIT');
    
    if (isValidEmailAddress(requestData.email)) {
       let letterName = 'Penelitian';
       if (requestData.letter_kind === 'interview') letterName = 'Wawancara';
       else if (requestData.letter_kind === 'permission') letterName = 'Perizinan';
       
       const emailHtml = buildProfessionalEmail({
         title: 'Penolakan Pengajuan Surat',
         contentHtml: `
           <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
           <p>Maaf, pengajuan surat <b>${escapeXml(letterName)}</b> Anda ditolak dengan alasan:</p>
           <div style="padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; margin-top: 16px;">
             ${escapeXml(reason)}
           </div>
           <p style="margin-top: 16px;">Silakan ajukan ulang surat Anda setelah memperbaiki hal tersebut.</p>
         `
       });
       const attachments = getStandardEmailAttachments();
       await sendMail({
         to: requestData.email,
         subject: 'Pengajuan Surat Ditolak',
         html: emailHtml,
         attachments
       }).catch(console.error);
    }
    
    res.json({ success: true, message: 'Surat berhasil ditolak.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Reject TA letter error:', err);
    res.status(500).json({ error: 'Gagal menolak pengajuan surat.' });
  } finally {
    client.release();
  }
});

// ─── Research letter actions ──────────────────────────────────────────────────

router.post('/tu/research-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, RESEARCH_LETTER_KIND);
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat penelitian berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit research letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengajukan surat penelitian.' });
  } finally {
    client.release();
  }
});

router.post('/tu/interview-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, INTERVIEW_LETTER_KIND);
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat wawancara berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit interview letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengajukan surat wawancara.' });
  } finally {
    client.release();
  }
});

router.post('/tu/permission-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, PERMISSION_LETTER_KIND);
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat perizinan berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit permission letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengajukan surat perizinan.' });
  } finally {
    client.release();
  }
});




router.post('/tu/research-letter/generate-and-download', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req);
    const pdfBuffer = await buildLetterPdfBuffer('research', requestData, req);
    await client.query('COMMIT');

    const safeName = (requestData.research_place || requestData.name || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratPenelitian_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Research-Access-Code', requestData.access_code || '');
    res.send(pdfBuffer);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Research letter download & archive error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal membuat dan mengunduh PDF surat penelitian.' });
  } finally {
    client.release();
  }
});

router.post('/tu/research-letter/generate-qr-link', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    res.json({
      success: true,
      qrUrl: validationUrl,
      validationUrl,
      validationToken: requestData.validation_token,
      accessCode: requestData.access_code,
      letterNumber: requestData.letter_number,
      expiresAt: null
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Research letter QR generate error:', err);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Gagal membuat QR Code surat penelitian.',
      details: err.message
    });
  } finally {
    client.release();
  }
});

router.post('/tu/research-letter/send-email', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const targetEmail = String(req.body?.targetEmail || '').trim();
  if (!isValidEmailAddress(targetEmail)) {
    return res.status(400).json({ error: 'Alamat email tujuan tidak valid.' });
  }

  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'sent', req);
    const config = letterConfig.research;
    const pdfBuffer = await buildLetterPdfBuffer('research', requestData, req);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const pdfFilename = `${safeLetterNumber}_${requestData.nim}.pdf`;
    const emailHtml = buildProfessionalEmail({
      title: config.subject,
      contentHtml: `
        <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
        ${config.emailBody}
        <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="margin-top: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${escapeXml(requestData.access_code)}</span></p>
          <p style="margin-bottom: 0;"><strong>Validasi surat:</strong> <br/><a href="${validationUrl}" style="color: #1d4ed8; word-break: break-all;">${validationUrl}</a></p>
        </div>
        <p>Simpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.</p>
      `
    });

    const attachments = getStandardEmailAttachments();
    attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' });

    await sendMail({
      to: targetEmail,
      subject: `${config.subject} - ${requestData.name}`,
      html: emailHtml,
      attachments
    });

    console.log(`[Mailer] Surat penelitian terkirim ke ${targetEmail}`);

    res.json({
      success: true,
      message: `Surat berhasil dikirim ke ${targetEmail}`,
      letterNumber: requestData.letter_number,
      accessCode: requestData.access_code,
      validationToken: requestData.validation_token,
      validationUrl
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Mailer] Research send-email error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengirim email surat penelitian. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

// ─── Interview letter actions ─────────────────────────────────────────────────

router.post('/tu/interview-letter/generate-and-download', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req, INTERVIEW_LETTER_KIND);
    const pdfBuffer = await buildLetterPdfBuffer('interview', requestData, req);
    await client.query('COMMIT');

    const safeName = (requestData.research_place || requestData.name || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratWawancara_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Research-Access-Code', requestData.access_code || '');
    res.send(pdfBuffer);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Interview letter download & archive error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal membuat dan mengunduh PDF surat wawancara.' });
  } finally {
    client.release();
  }
});

router.post('/tu/interview-letter/generate-qr-link', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req, INTERVIEW_LETTER_KIND);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    res.json({
      success: true,
      qrUrl: validationUrl,
      validationUrl,
      validationToken: requestData.validation_token,
      accessCode: requestData.access_code,
      letterNumber: requestData.letter_number,
      expiresAt: null
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Interview letter QR generate error:', err);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Gagal membuat QR Code surat wawancara.',
      details: err.message
    });
  } finally {
    client.release();
  }
});

router.post('/tu/interview-letter/send-email', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const targetEmail = String(req.body?.targetEmail || '').trim();
  if (!isValidEmailAddress(targetEmail)) {
    return res.status(400).json({ error: 'Alamat email tujuan tidak valid.' });
  }

  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'sent', req, INTERVIEW_LETTER_KIND);
    const config = letterConfig.interview;
    const pdfBuffer = await buildLetterPdfBuffer('interview', requestData, req);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const pdfFilename = `${safeLetterNumber}_${requestData.nim}.pdf`;
    const emailHtml = buildProfessionalEmail({
      title: config.subject,
      contentHtml: `
        <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
        ${config.emailBody}
        <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="margin-top: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${escapeXml(requestData.access_code)}</span></p>
          <p style="margin-bottom: 0;"><strong>Validasi surat:</strong> <br/><a href="${validationUrl}" style="color: #1d4ed8; word-break: break-all;">${validationUrl}</a></p>
        </div>
        <p>Simpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.</p>
      `
    });

    const attachments = getStandardEmailAttachments();
    attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' });

    await sendMail({
      to: targetEmail,
      subject: `${config.subject} - ${requestData.name}`,
      html: emailHtml,
      attachments
    });

    console.log(`[Mailer] Surat wawancara terkirim ke ${targetEmail}`);

    res.json({
      success: true,
      message: `Surat berhasil dikirim ke ${targetEmail}`,
      letterNumber: requestData.letter_number,
      accessCode: requestData.access_code,
      validationToken: requestData.validation_token,
      validationUrl
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Mailer] Interview send-email error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengirim email surat wawancara. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

// ─── Permission letter actions ────────────────────────────────────────────────

router.post('/tu/permission-letter/generate-and-download', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req, PERMISSION_LETTER_KIND);
    const pdfBuffer = await buildLetterPdfBuffer('permission', requestData, req);
    await client.query('COMMIT');

    const safeName = (requestData.research_place || requestData.name || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratPerizinan_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Research-Access-Code', requestData.access_code || '');
    res.send(pdfBuffer);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Permission letter download & archive error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal membuat dan mengunduh PDF surat perizinan.' });
  } finally {
    client.release();
  }
});

router.post('/tu/permission-letter/generate-qr-link', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'verified', req, PERMISSION_LETTER_KIND);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    res.json({
      success: true,
      qrUrl: validationUrl,
      validationUrl,
      validationToken: requestData.validation_token,
      accessCode: requestData.access_code,
      letterNumber: requestData.letter_number,
      expiresAt: null
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Permission letter QR generate error:', err);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : 'Gagal membuat QR Code surat perizinan.',
      details: err.message
    });
  } finally {
    client.release();
  }
});

router.post('/tu/permission-letter/send-email', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const targetEmail = String(req.body?.targetEmail || '').trim();
  if (!isValidEmailAddress(targetEmail)) {
    return res.status(400).json({ error: 'Alamat email tujuan tidak valid.' });
  }

  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'sent', req, PERMISSION_LETTER_KIND);
    const config = letterConfig.permission;
    const pdfBuffer = await buildLetterPdfBuffer('permission', requestData, req);
    await client.query('COMMIT');

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const pdfFilename = `${safeLetterNumber}_${requestData.nim}.pdf`;
    const emailHtml = buildProfessionalEmail({
      title: config.subject,
      contentHtml: `
        <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
        ${config.emailBody}
        <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="margin-top: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${escapeXml(requestData.access_code)}</span></p>
          <p style="margin-bottom: 0;"><strong>Validasi surat:</strong> <br/><a href="${validationUrl}" style="color: #1d4ed8; word-break: break-all;">${validationUrl}</a></p>
        </div>
        <p>Simpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.</p>
      `
    });

    const attachments = getStandardEmailAttachments();
    attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' });

    await sendMail({
      to: targetEmail,
      subject: `${config.subject} - ${requestData.name}`,
      html: emailHtml,
      attachments
    });

    console.log(`[Mailer] Surat perizinan terkirim ke ${targetEmail}`);

    res.json({
      success: true,
      message: `Surat berhasil dikirim ke ${targetEmail}`,
      letterNumber: requestData.letter_number,
      accessCode: requestData.access_code,
      validationToken: requestData.validation_token,
      validationUrl
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Mailer] Permission send-email error:', err);
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Gagal mengirim email surat perizinan. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

// ─── Public research letter access ───────────────────────────────────────────

router.post('/tu/public/research-letter/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeResearchAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM ta_letter_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat penelitian tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildResearchAccessPayload(result.rows[0]) });
  } catch (err) {
    console.error('Public research access lookup error:', err);
    res.status(500).json({ error: 'Gagal membuka surat penelitian.' });
  }
});

router.post('/tu/public/research-letter/download', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeResearchAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM ta_letter_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat penelitian tidak ditemukan untuk kode akses tersebut.' });
    }

    const requestData = result.rows[0];
    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat penelitian belum berstatus resmi.' });
    }

    const letterType = getResearchLetterType(requestData);
    const config = letterConfig[letterType] || letterConfig.research;
    const pdfBuffer = await buildLetterPdfBuffer(letterType, requestData, req);
    const safeName = (requestData.research_place || requestData.name || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `${config.pdfFilename}_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public research access download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh ulang surat penelitian.' });
  }
});

export default router;
