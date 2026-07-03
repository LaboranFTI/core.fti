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
  DEFAULT_COUNSELING_SUBJECT,
  DEFAULT_COUNSELING_RECIPIENT_NAME,
  DEFAULT_COUNSELING_REFERRAL_UNIT,
  mapCounselingRow,
  ensureLetterNumber,
  ensureLetterValidationToken
} from './core.js';

const router = express.Router();

const normalizeCounselingPayload = async (payload = {}) => {
  const nim = String(payload.nim || '').trim();
  const studyProgram = nim ? await getStudyProgramByNim(nim) : null;
  const defaultLetterContent = payload.defaultLetterContent || {};
  const allowLetterContentOverride = payload.allowLetterContentOverride !== false;
  const subjectSource = allowLetterContentOverride ? payload.subject : defaultLetterContent.subject;
  const recipientSource = allowLetterContentOverride ? payload.recipientName : defaultLetterContent.recipientName;
  const referralSource = allowLetterContentOverride ? payload.referralUnit : defaultLetterContent.referralUnit;

  return {
    name: formatStudentName(payload.name || ''),
    nim,
    email: String(payload.email || '').trim(),
    subject: String(subjectSource || defaultLetterContent.subject || '').trim() || DEFAULT_COUNSELING_SUBJECT,
    recipient_name: String(recipientSource || defaultLetterContent.recipientName || '').trim() || DEFAULT_COUNSELING_RECIPIENT_NAME,
    referral_unit: String(referralSource || defaultLetterContent.referralUnit || '').trim() || DEFAULT_COUNSELING_REFERRAL_UNIT,
    study_program_level: payload.studyProgramLevel || studyProgram?.studyProgramLevel || null,
    study_program_name: payload.studyProgramName || studyProgram?.studyProgramName || null,
    faculty: String(payload.faculty || '').trim() || 'FTI',
    carbon_copies: Array.isArray(payload.carbonCopies || payload.carbon_copies) ? (payload.carbonCopies || payload.carbon_copies) : []
  };
};

router.post('/counseling-requests', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const settingsPayload = await getTuSettingsPayload();
    const data = await normalizeCounselingPayload({
      ...req.body,
      allowLetterContentOverride: false,
      defaultLetterContent: {
        subject: settingsPayload.counselingSubject,
        recipientName: settingsPayload.counselingRecipientName,
        referralUnit: settingsPayload.counselingReferralUnit
      }
    });

    if (!data.name || !data.nim || !data.email) {
      return res.status(400).json({ error: 'Nama, NIM, dan email mahasiswa wajib diisi.' });
    }
    if (!isValidEmailAddress(data.email)) {
      return res.status(400).json({ error: 'Format email mahasiswa tidak valid.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = `CNS-${Date.now()}`;
      const insertResult = await client.query(
        `INSERT INTO counseling_requests (
           id, name, nim, email, subject, recipient_name, referral_unit,
           study_program_level, study_program_name, faculty, status, carbon_copies
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11::jsonb)
         RETURNING *`,
        [
          id,
          data.name,
          data.nim,
          data.email,
          data.subject,
          data.recipient_name,
          data.referral_unit,
          data.study_program_level,
          data.study_program_name,
          data.faculty,
          JSON.stringify(data.carbon_copies)
        ]
      );
      await client.query('COMMIT');

      res.json({
        success: true,
        id: insertResult.rows[0].id
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Insert counseling request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan surat pengantar konseling.' });
  }
});

router.get('/counseling-requests', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM counseling_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapCounselingRow) });
  } catch (err) {
    console.error('Get counseling requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data surat konseling.' });
  }
});

router.put('/counseling-requests/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    const data = await normalizeCounselingPayload(req.body);
    await client.query('BEGIN');
    const existingResult = await client.query(`SELECT * FROM counseling_requests WHERE id = $1 FOR UPDATE`, [id]);

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Surat konseling tidak ditemukan.' });
    }

    let numberedRequest = await ensureLetterNumber(client, 'counseling', existingResult.rows[0]);
    numberedRequest = await ensureLetterValidationToken(client, 'counseling', numberedRequest);

    const updateResult = await client.query(
      `UPDATE counseling_requests
       SET status = 'verified',
           subject = COALESCE($1, subject),
           recipient_name = COALESCE($2, recipient_name),
           referral_unit = COALESCE($3, referral_unit),
           carbon_copies = COALESCE($4::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        data.subject || null,
        data.recipient_name || null,
        data.referral_unit || null,
        JSON.stringify(data.carbon_copies || []),
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
    console.error('Verify counseling request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi surat konseling.' });
  } finally {
    client.release();
  }
});

router.patch('/tu/requests/counseling/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;

  try {
    await ensureTuInfrastructure();
    const existing = await pool.query(`SELECT id FROM counseling_requests WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Surat konseling tidak ditemukan.' });

    const data = await normalizeCounselingPayload(req.body);
    const updateResult = await pool.query(
      `UPDATE counseling_requests
       SET subject = COALESCE($1, subject),
           recipient_name = COALESCE($2, recipient_name),
           referral_unit = COALESCE($3, referral_unit),
           carbon_copies = COALESCE($4::jsonb, carbon_copies),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        data.subject || null,
        data.recipient_name || null,
        data.referral_unit || null,
        JSON.stringify(data.carbon_copies || []),
        id
      ]
    );

    res.json({ success: true, data: mapCounselingRow(updateResult.rows[0]) });
  } catch (err) {
    console.error('Patch counseling request error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data surat konseling.' });
  }
});

router.delete('/tu/requests/counseling/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM counseling_requests WHERE id = $1 RETURNING id, name, nim, letter_generated_at`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Surat konseling tidak ditemukan.' });

    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await pool.query(
        `UPDATE tu_letter_number_counters
         SET last_sequence = GREATEST(last_sequence - 1, 0)
         WHERE letter_type = 'counseling' AND year = $1 AND month = $2`,
        [date.getFullYear(), date.getMonth() + 1]
      );
    }

    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete counseling error:', err);
    res.status(500).json({ error: 'Gagal menghapus surat konseling.' });
  }
});

router.post('/tu/requests/counseling/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM counseling_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );

    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        await pool.query(
          `UPDATE tu_letter_number_counters
           SET last_sequence = GREATEST(last_sequence - 1, 0)
           WHERE letter_type = 'counseling' AND year = $1 AND month = $2`,
          [date.getFullYear(), date.getMonth() + 1]
        );
      }
    }

    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete counseling error:', err);
    res.status(500).json({ error: 'Gagal menghapus data konseling secara batch.' });
  }
});

export default router;
