import express from 'express';
import {
  pool,
  verifyRole,
  TU_SUBMIT_ROLES,
  TU_ADMIN_ROLES,
  ensureTuInfrastructure,
  getTuSettingsPayload,
  isValidEmailAddress,
  getStudyProgramByNim,
  formatStudentName,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  mapObservationRow,
  ensureLetterNumber,
  recalculateLetterCounter,
  ensureLetterValidationToken,
  buildPublicValidationUrl,
  letterConfig,
  buildLetterPdfBuffer,
  normalizeObservationStudents,
  upsertObservationRequest,
  ensureObservationAccessCode,
  normalizeObservationAccessCode
} from './core.js';

import { sendMail, buildProfessionalEmail, getStandardEmailAttachments } from '../../utils/mailer.js';

const router = express.Router();

const escapeXml = (unsafe) => {
  return String(unsafe || '')
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
};

router.post('/observation-requests', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    name,
    nim,
    email,
    recipientName,
    companyAddress,
    purpose,
    company,
    companyName,
    courseName,
    lecturerName,
    headOfProgramName,
    students
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const fallbackId = `OBS-${Date.now()}`;
    const normalizedStudents = normalizeObservationStudents(students);
    const primaryStudent = normalizedStudents[0] || { name: '', nim: '' };
    const resolvedName = formatStudentName(name || primaryStudent.name || req.user?.nama || 'Mahasiswa Observasi');
    const resolvedNim = String(nim || primaryStudent.nim || fallbackId).trim();
    const resolvedEmail = String(email || req.user?.email || '').trim() || 'arsip-observasi@core.fti';
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        purpose: purpose || null,
        company: company || companyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: null,
        study_program_name: null,
        student_members: normalizedStudents
      }, 'verified');

      requestData = await ensureLetterNumber(client, 'observation', requestData);
      requestData = await ensureLetterValidationToken(client, 'observation', requestData);
      requestData = await ensureObservationAccessCode(client, requestData);

      await client.query('COMMIT');
      res.json({
        success: true,
        id: requestData.id,
        letterNumber: requestData.letter_number,
        validationToken: requestData.validation_token,
        accessCode: requestData.access_code
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Insert observation request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan observasi.' });
  }
});

router.get('/observation-requests', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM observation_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapObservationRow) });
  } catch (err) {
    console.error('Get observation requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan observasi.' });
  }
});

router.put('/observation-requests/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM observation_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'observation', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'observation', numberedRequest);
    await client.query(
      `UPDATE observation_requests
       SET status = 'verified',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ success: true, letterNumber: numberedRequest.letter_number || '', validationToken: numberedRequest.validation_token || '' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify observation request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan observasi.' });
  } finally {
    client.release();
  }
});

router.patch('/tu/requests/observation/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const {
    recipientName,
    company,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    carbonCopies,
    carbon_copies
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM observation_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Pengajuan observasi tidak ditemukan.' });

    const resolvedCompany = company || companyName || null;
    const normalizedStudents = students ? normalizeObservationStudents(students) : undefined;
    const incomingCc = carbonCopies || carbon_copies;
    const stringifiedCc = incomingCc ? JSON.stringify(incomingCc) : undefined;

    const updateResult = await pool.query(
      `UPDATE observation_requests
       SET recipient_name       = COALESCE($1, recipient_name),
           company              = COALESCE($2, company),
           company_address      = COALESCE($3, company_address),
           course_name          = COALESCE($4, course_name),
           lecturer_name        = COALESCE($5, lecturer_name),
           head_of_program_name = COALESCE($6, head_of_program_name),
           student_members      = COALESCE($7::jsonb, student_members),
           carbon_copies        = COALESCE($8::jsonb, carbon_copies),
           updated_at           = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        recipientName ?? null,
        resolvedCompany,
        companyAddress ?? null,
        courseName ?? null,
        lecturerName ?? null,
        headOfProgramName ?? null,
        normalizedStudents ? JSON.stringify(normalizedStudents) : null,
        stringifiedCc ?? null,
        id
      ]
    );

    res.json({ success: true, data: mapObservationRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch observation request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data surat observasi.' });
  }
});

router.delete('/tu/requests/observation/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM observation_requests WHERE id = $1 RETURNING id, name, nim, company, letter_generated_at`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await recalculateLetterCounter(
        'observation', 'observation_requests', null,
        date.getFullYear(), date.getMonth() + 1
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete observation error:', err);
    res.status(500).json({ error: 'Gagal menghapus surat observasi.' });
  }
});

router.post('/tu/requests/observation/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM observation_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, company, letter_generated_at`,
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
        'observation', 'observation_requests', null, year, month
      );
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete observation error:', err);
    res.status(500).json({ error: 'Gagal menghapus data observasi secara batch.' });
  }
});

router.post('/tu/observation-letter/finalize', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    await client.query('COMMIT');

    res.json({ success: true, letterNumber: requestData.letter_number, accessCode: requestData.access_code, validationToken: requestData.validation_token });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Observation letter finalize error:', err);
    res.status(500).json({ error: 'Gagal memfinalisasi surat observasi.' });
  } finally {
    client.release();
  }
});

router.post('/tu/observation-letter/generate-and-download', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Observation-Access-Code', requestData.access_code || '');
    res.send(pdfBuffer);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Observation letter download & archive error:', err);
    res.status(500).json({ error: 'Gagal membuat dan mengunduh PDF surat observasi.' });
  } finally {
    client.release();
  }
});

router.post('/tu/observation-letter/generate-qr-link', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel
  } = req.body;

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'verified');
    requestData = await ensureLetterNumber(client, 'observation', requestData);
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);
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
    await client.query('ROLLBACK');
    console.error('Observation letter QR generate error:', err);
    res.status(500).json({ error: 'Gagal membuat QR Code surat observasi.', details: err.message, stack: err.stack });
  } finally {
    client.release();
  }
});

router.post('/tu/observation-letter/send-email', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    recipientName,
    companyName,
    companyAddress,
    courseName,
    lecturerName,
    headOfProgramName,
    students,
    studyProgramName,
    studyProgramLevel,
    targetEmail
  } = req.body;

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return res.status(400).json({ error: 'Alamat email tujuan tidak valid.' });
  }

  const primaryStudent = normalizeObservationStudents(students)[0] || {};
  const resolvedName = formatStudentName(req.body.name || primaryStudent.name || req.user?.nama || 'Mahasiswa');
  const resolvedNim = String(req.body.nim || primaryStudent.nim || req.user?.identifier || '000000000').trim();
  const resolvedEmail = String(req.body.email || req.user?.email || '').trim() || `arsip-${resolvedNim}@core.fti`;

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const resolvedCompanyName = companyName || req.body.company;

    let requestData = await upsertObservationRequest(client, {
        name: resolvedName,
        nim: resolvedNim,
        email: resolvedEmail,
        recipient_name: recipientName || null,
        company_address: companyAddress || null,
        company: resolvedCompanyName || null,
        course_name: courseName || null,
        lecturer_name: lecturerName || null,
        head_of_program_name: headOfProgramName || null,
        study_program_level: studyProgramLevel || null,
        study_program_name: studyProgramName || null,
        student_members: normalizeObservationStudents(students)
    }, 'sent');
    requestData = await ensureLetterNumber(client, 'observation', requestData);
    requestData = await ensureLetterValidationToken(client, 'observation', requestData);
    requestData = await ensureObservationAccessCode(client, requestData);

    const config = letterConfig.observation;
    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
    await client.query('COMMIT');

    const safeCompanyName = (resolvedCompanyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const pdfFilename = `SuratObservasi_${safeCompanyName}_${requestData.letter_number?.replace(/\//g, '_') || requestData.nim}.pdf`;

    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);
      
      const emailHtml = buildProfessionalEmail({
        title: `${config.subject}`,
        contentHtml: `
          <h2>Halo, ${resolvedName} (${resolvedNim})</h2>
          ${config.emailBody}
          <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="margin-top: 0;"><strong>Validasi surat:</strong> <br/><a href="${validationUrl}" style="color: #1d4ed8; word-break: break-all;">${validationUrl}</a></p>
            <p style="margin-bottom: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${requestData.access_code}</span></p>
          </div>
          <p>Simpan kode ini untuk membuka atau mengunduh ulang surat melalui layanan self-service.</p>
        `
      });

      const attachments = getStandardEmailAttachments();
      attachments.push({ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' });

      await sendMail({
        to: targetEmail,
        subject: `${config.subject} - ${resolvedCompanyName || 'Observasi'}`,
        html: emailHtml,
        attachments
      });

    console.log(`[Mailer] 📧 Surat observasi terkirim ke ${targetEmail}`);

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
    console.error('[Mailer] Observation send-email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email surat observasi. Pastikan konfigurasi EMAIL di .env sudah benar.' });
  } finally {
    client.release();
  }
});

export default router;
