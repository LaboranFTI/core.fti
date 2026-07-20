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
  ensureLetterNumber,
  recalculateLetterCounter,
  ensureLetterValidationToken,
  buildLetterPdfBuffer,
  buildPublicValidationUrl,
  sendSuRekAccessCodeEmail,
  letterConfig,
  getRecommendationSigner,
  buildLetterHtml,
  createSuRekAccessCode,
  normalizeSuRekAccessCode,
  publicObservationAccessLimiter
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

const mapSuRekRow = (row) => ({
  id: row.id,
  name: row.name,
  nim: row.nim,
  email: row.email,
  recipientName: row.recipient_name,
  berdasarkanNo: row.berdasarkan_no,
  perihal: row.perihal,
  lampiran: row.lampiran,
  status: row.status,
  signatureBase64: row.signature_base64,
  stampBase64: row.stamp_base64,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  accessCode: row.access_code,
  letterGeneratedAt: row.letter_generated_at,
  carbonCopies: row.carbon_copies || [],
  createdAt: row.created_at,
  // Additional fields for generalized letter
  destinationPlace: row.destination_place,
  addressStreet: row.address_street,
  addressKelurahan: row.address_kelurahan,
  addressKecamatan: row.address_kecamatan,
  addressCity: row.address_city,
  addressProvince: row.address_province,
  recipientTitle: row.recipient_title,
  assignmentType: row.assignment_type,
  permissionPurpose: row.permission_purpose,
  includeResearchPlace: row.include_research_place,
  researchPlace: row.research_place,
  researchTitle: row.research_title,
  advisors: row.advisors || [],
  students: row.students || [],
  variant: row.variant
});

const buildSuRekAccessPayload = (row) => ({
  id: row.id,
  accessCode: row.access_code,
  letterNumber: row.letter_number,
  validationToken: row.validation_token,
  status: row.status,
  letterGeneratedAt: row.letter_generated_at,
  data: {
    name: row.name,
    nim: row.nim,
    email: row.email,
    recipientName: row.recipient_name || '',
    berdasarkanNo: row.berdasarkan_no || '',
    perihal: row.perihal || '',
    lampiran: row.lampiran || '',
    carbonCopies: row.carbon_copies || []
  }
});

const upsertSuRekRequest = async (client, data, targetStatus) => {
  const recentDuplicate = await client.query(
    `SELECT * FROM su_rek_requests 
     WHERE nim = $1 
       AND created_at > NOW() - INTERVAL '1 day'
     ORDER BY created_at DESC LIMIT 1`,
    [data.nim]
  );

  if (recentDuplicate.rows.length > 0) {
    const existing = recentDuplicate.rows[0];
    const accessCode = existing.access_code || createSuRekAccessCode();
    const statusPriority = { 'pending': 1, 'verified': 2, 'sent': 3 };
    const currentStatusLevel = statusPriority[existing.status] || 0;
    const targetStatusLevel = statusPriority[targetStatus] || 0;
    const newStatus = targetStatusLevel > currentStatusLevel ? targetStatus : existing.status;

    const updateResult = await client.query(
      `UPDATE su_rek_requests SET 
         name = $1, email = $2, recipient_name = $3, berdasarkan_no = $4,
         perihal = $5, lampiran = $6, status = $7, carbon_copies = $8::jsonb,
         access_code = COALESCE(access_code, $9),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        data.name, data.email, data.recipient_name, data.berdasarkan_no,
        data.perihal, data.lampiran, newStatus,
        JSON.stringify(data.carbon_copies || []),
        accessCode,
        existing.id
      ]
    );
    return updateResult.rows[0];
  } else {
    const id = `REQ-${Date.now()}`;
    const accessCode = createSuRekAccessCode();
    const insertResult = await client.query(
      `INSERT INTO su_rek_requests (
          id, name, nim, email, recipient_name, berdasarkan_no, perihal, lampiran, status, carbon_copies, access_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      RETURNING *`,
      [
        id, data.name, data.nim, data.email, data.recipient_name, data.berdasarkan_no,
        data.perihal, data.lampiran, targetStatus,
        JSON.stringify(data.carbon_copies || []),
        accessCode
      ]
    );
    return insertResult.rows[0];
  }
};

router.post('/su-rek-requests', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const { name, nim, email } = req.body;
  const recipientEmail = String(email || '').trim();

  if (!name || !nim) {
    return res.status(400).json({ error: 'Nama dan NIM/No Formulir wajib diisi.' });
  }
  if (!isValidEmailAddress(recipientEmail)) {
    return res.status(400).json({ error: 'Email aktif wajib diisi agar kode akses dapat dikirim.' });
  }

  try {
    await ensureTuInfrastructure();
    const studyProgram = await getStudyProgramByNim(nim);
    if (!studyProgram) {
      return res.status(400).json({ error: 'Kode program studi dari NIM/No Formulir belum terdaftar di database.' });
    }

    const settingsPayload = await getTuSettingsPayload();

    const client = await pool.connect();
    try {
      const requestData = await upsertSuRekRequest(client, {
        name: formatStudentName(name),
        nim: nim.trim(),
        email: recipientEmail,
        recipient_name: settingsPayload.suRekYangTerhormat,
        berdasarkan_no: settingsPayload.suRekBerdasarkanNo,
        perihal: settingsPayload.suRekPerihal,
        lampiran: settingsPayload.suRekLampiran,
        carbon_copies: Array.isArray(settingsPayload.suRekTembusan) ? settingsPayload.suRekTembusan : []
      }, 'pending');

      let accessEmail = { sent: false, error: null, previewUrl: null };
      try {
        const emailInfo = await sendSuRekAccessCodeEmail(requestData, req);
        accessEmail = {
          sent: true,
          error: null,
          previewUrl: emailInfo.previewUrl || null
        };
      } catch (emailErr) {
        console.error('Send su-rek access code email error:', emailErr);
        accessEmail = {
          sent: false,
          error: 'Permohonan tersimpan, tetapi email kode akses gagal dikirim. Simpan kode akses yang tampil di layar.',
          previewUrl: null
        };
      }

      res.json({
        success: true,
        id: requestData.id,
        accessCode: requestData.access_code,
        email: requestData.email,
        accessEmail
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Insert su-rek request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan rekomendasi.' });
  }
});

router.delete('/tu/requests/su-rek/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM su_rek_requests WHERE id = $1 RETURNING id, name, nim, letter_generated_at`, [id]);
    if (result.rowCount === 0) {
      return res.json({ success: true, deleted: null, alreadyDeleted: true });
    }
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await recalculateLetterCounter(
        'su-rek', 'su_rek_requests', null,
        date.getFullYear(), date.getMonth() + 1
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete su-rek error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengajuan.' });
  }
});

router.post('/tu/requests/su-rek/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM su_rek_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, letter_generated_at`,
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
        'su-rek', 'su_rek_requests', null, year, month
      );
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete su-rek error:', err);
    res.status(500).json({ error: 'Gagal menghapus data secara batch.' });
  }
});

router.get('/su-rek-requests', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM su_rek_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapSuRekRow) });
  } catch (err) {
    console.error('Get su-rek requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan.' });
  }
});

router.put('/su-rek-requests/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { recipientName, berdasarkanNo, perihal, lampiran, carbonCopies } = req.body;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM su_rek_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'su-rek', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'su-rek', numberedRequest);

    const updateResult = await client.query(
      `UPDATE su_rek_requests
       SET status = 'verified',
           recipient_name = COALESCE($1, recipient_name),
           berdasarkan_no = COALESCE($2, berdasarkan_no),
           perihal = COALESCE($3, perihal),
           lampiran = COALESCE($4, lampiran),
           carbon_copies = COALESCE($5::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        recipientName || null,
        berdasarkanNo || null,
        perihal || null,
        lampiran || null,
        carbonCopies ? JSON.stringify(carbonCopies) : null,
        id
      ]
    );

    await client.query('COMMIT');
    res.json({
      success: true,
      letterNumber: numberedRequest.letter_number || updateResult.rows[0]?.letter_number || '',
      validationToken: numberedRequest.validation_token || updateResult.rows[0]?.validation_token || ''
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify su-rek request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan.' });
  } finally {
    client.release();
  }
});

router.post('/tu/public/su-rek/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildSuRekAccessPayload(result.rows[0]) });
  } catch (err) {
    console.error('Public su-rek access lookup error:', err);
    res.status(500).json({ error: 'Gagal membuka surat rekomendasi.' });
  }
});

router.post('/tu/public/su-rek/download', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan.' });
    }

    const requestData = result.rows[0];
    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat rekomendasi belum berstatus resmi/diverifikasi oleh TU.' });
    }

    const pdfBuffer = await buildLetterPdfBuffer('su-rek', requestData, req);
    const safeLetterNumber = (requestData.letter_number || 'surat_rekomendasi').replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public su-rek access download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh PDF surat rekomendasi.' });
  }
});

router.post('/tu/public/su-rek/send-email', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeSuRekAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  const config = letterConfig['su-rek'];

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM su_rek_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat rekomendasi tidak ditemukan.' });
    }

    let requestData = result.rows[0];
    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat rekomendasi belum diverifikasi oleh TU.' });
    }

    requestData = await ensureLetterValidationToken(pool, 'su-rek', requestData);
    const pdfBuffer = await buildLetterPdfBuffer('su-rek', requestData, req);
    const validationUrl = buildPublicValidationUrl(req, requestData.validation_token);

    const emailHtml = buildProfessionalEmail({
      title: config.subject,
      contentHtml: `
        <h2>Halo, ${escapeXml(requestData.name)} (${escapeXml(requestData.nim)})</h2>
        ${config.emailBody}
        <div style="margin: 24px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="margin-top: 0;"><strong>Kode akses surat:</strong> <br/><span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #1d4ed8;">${escapeXml(requestData.access_code)}</span></p>
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

    console.log(`[Mailer] Surat rekomendasi terkirim ke ${requestData.email}`);

    await pool.query(`UPDATE su_rek_requests SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [requestData.id]);

    res.json({
        success: true,
        message: 'Surat rekomendasi berhasil dikirim ke email terdaftar.',
        previewUrl: null,
        validationUrl
      });
  } catch (err) {
    console.error('Public su-rek send-email error:', err);
    res.status(500).json({ error: 'Gagal mengirim email surat rekomendasi.' });
  }
});

router.patch('/tu/requests/su-rek/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { recipientName, berdasarkanNo, perihal, lampiran, carbonCopies } = req.body;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM su_rek_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    const updateResult = await pool.query(
      `UPDATE su_rek_requests
       SET recipient_name = COALESCE($1, recipient_name),
           berdasarkan_no = COALESCE($2, berdasarkan_no),
           perihal = COALESCE($3, perihal),
           lampiran = COALESCE($4, lampiran),
           carbon_copies = COALESCE($5::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        recipientName || null,
        berdasarkanNo || null,
        perihal || null,
        lampiran || null,
        carbonCopies ? JSON.stringify(carbonCopies) : null,
        id
      ]
    );

    res.json({ success: true, data: mapSuRekRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch su-rek request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data pengajuan.' });
  }
});

router.get('/su-rek/summary', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT status, COUNT(*) as count FROM su_rek_requests GROUP BY status`);

    const summary = {
      pending: 0,
      verified: 0,
      sent: 0,
      total: 0
    };

    result.rows.forEach((row) => {
      if (row.status === 'pending') summary.pending = parseInt(row.count, 10);
      if (row.status === 'verified') summary.verified = parseInt(row.count, 10);
      if (row.status === 'sent') summary.sent = parseInt(row.count, 10);
      summary.total += parseInt(row.count, 10);
    });

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Get su-rek summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil data ringkasan surat rekomendasi.' });
  }
});

export default router;
