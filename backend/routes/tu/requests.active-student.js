import express from 'express';
import {
  pool,
  verifyRole,
  TU_SUBMIT_ROLES,
  TU_ADMIN_ROLES,
  ensureTuInfrastructure,
  isValidEmailAddress,
  getStudyProgramByNim,
  formatStudentName,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  mapActiveStudentRow,
  buildLetterPdfBuffer,
  letterConfig,
  ensureLetterNumber,
  ensureLetterValidationToken,
  buildPublicValidationUrl
} from './core.js';

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

router.post('/active-student', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const {
    name,
    nim,
    email,
    birthPlace,
    birthDate,
    faculty,
    university,
    semester,
    transcriptBase64,
    transcriptName,
    carbonCopies
  } = req.body;

  try {
    await ensureTuInfrastructure();
    const recipientEmail = String(email || '').trim();

    if (!name || !nim || !recipientEmail) {
      return res.status(400).json({ error: 'Nama, NIM, dan email mahasiswa wajib diisi.' });
    }
    if (!isValidEmailAddress(recipientEmail)) {
      return res.status(400).json({ error: 'Format email mahasiswa tidak valid.' });
    }

    const id = `REQ-${Date.now()}`;
    const studyProgram = await getStudyProgramByNim(nim);

    if (!studyProgram) {
      return res.status(400).json({ error: 'Kode program studi dari NIM belum terdaftar di database.' });
    }

    await pool.query(
      `INSERT INTO active_student_requests (
         id,
         name,
         nim,
         email,
         birth_place,
         birth_date,
         study_program_level,
         study_program_name,
         faculty,
         university,
         semester,
         transcript_base64,
         transcript_name,
         status,
         carbon_copies
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14::jsonb)`,
      [
        id,
        formatStudentName(name),
        nim,
        recipientEmail,
        birthPlace || null,
        birthDate || null,
        studyProgram.studyProgramLevel,
        studyProgram.studyProgramName,
        faculty || DEFAULT_FACULTY,
        university || DEFAULT_UNIVERSITY,
        semester || null,
        transcriptBase64,
        transcriptName,
        JSON.stringify(carbonCopies || [])
      ]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Insert active student request error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengajuan.' });
  }
});

router.delete('/tu/requests/active-student/:id', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`DELETE FROM active_student_requests WHERE id = $1 RETURNING id, name, nim, letter_generated_at`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    
    const deletedRow = result.rows[0];
    if (deletedRow.letter_generated_at) {
      const date = new Date(deletedRow.letter_generated_at);
      await pool.query(
        `UPDATE tu_letter_number_counters
         SET last_sequence = GREATEST(last_sequence - 1, 0)
         WHERE letter_type = 'active-student' AND year = $1 AND month = $2`,
        [date.getFullYear(), date.getMonth() + 1]
      );
    }
    
    res.json({ success: true, deleted: deletedRow });
  } catch (err) {
    console.error('Delete active student error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengajuan.' });
  }
});

router.post('/tu/requests/active-student/batch-delete', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Daftar ID tidak valid atau kosong.' });
  }
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `DELETE FROM active_student_requests WHERE id = ANY($1::text[]) RETURNING id, name, nim, letter_generated_at`,
      [ids]
    );
    
    for (const row of result.rows) {
      if (row.letter_generated_at) {
        const date = new Date(row.letter_generated_at);
        await pool.query(
          `UPDATE tu_letter_number_counters
           SET last_sequence = GREATEST(last_sequence - 1, 0)
           WHERE letter_type = 'active-student' AND year = $1 AND month = $2`,
          [date.getFullYear(), date.getMonth() + 1]
        );
      }
    }
    
    res.json({ success: true, deletedCount: result.rowCount, deleted: result.rows });
  } catch (err) {
    console.error('Batch delete active student error:', err);
    res.status(500).json({ error: 'Gagal menghapus data secara batch.' });
  }
});

router.get('/active-student', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT * FROM active_student_requests ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows.map(mapActiveStudentRow) });
  } catch (err) {
    console.error('Get active student requests error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengajuan.' });
  }
});

router.put('/active-student/:id/verify', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  const { carbonCopies } = req.body;
  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');

    const selectResult = await client.query(`SELECT * FROM active_student_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (selectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    const currentData = selectResult.rows[0];
    if (currentData.status === 'verified' || currentData.status === 'sent') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pengajuan sudah diverifikasi sebelumnya.' });
    }

    const updatedData = await ensureLetterNumber(client, 'active-student', currentData);
    const finalizedData = await ensureLetterValidationToken(client, 'active-student', updatedData);

    const carbonCopiesJson = JSON.stringify(carbonCopies || finalizedData.carbon_copies || []);

    const updateResult = await client.query(
      `UPDATE active_student_requests
       SET status = 'verified',
           letter_number = $1,
           letter_sequence = $2,
           validation_token = $3,
           carbon_copies = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        finalizedData.letter_number,
        finalizedData.letter_sequence,
        finalizedData.validation_token,
        carbonCopiesJson,
        id
      ]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: mapActiveStudentRow(updateResult.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verify active student request error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi pengajuan.' });
  } finally {
    client.release();
  }
});

router.get('/active-student/summary', verifyRole(['Admin', 'Admin TU', 'User TU']), async (req, res) => {
  try {
    await ensureTuInfrastructure();
    const result = await pool.query(`SELECT status, COUNT(*) as count FROM active_student_requests GROUP BY status`);

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
    console.error('Get active student summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil data ringkasan.' });
  }
});

export default router;
