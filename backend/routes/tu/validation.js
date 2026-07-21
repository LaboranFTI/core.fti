import express from 'express';
import {
  pool,
  publicValidationLimiter,
  publicObservationAccessLimiter,
  ensureTuInfrastructure,
  getResearchLetterType,
  getTuSettingsPayload,
  getSharedLetterBackground,
  LETTER_TYPE_TO_CLIENT_KEY,
  normalizeLetterLayout,
  DEFAULT_LETTER_LAYOUT_MM,
  buildLetterValidationPayload,
  getDeanSigner,
  buildLetterHtml,
  buildResearchSignerList,
  getRecommendationSigner,
  buildLetterPdfBuffer,
  normalizeObservationAccessCode,
  buildObservationAccessPayload,
  normalizeObservationStudents,
  buildObservationPdfBuffer,
  hashQrDownloadToken,
  qrDownloadSessions,
  letterConfig,
  ensureLetterValidationToken
} from './core.js';

const router = express.Router();

// Helper to escape XML characters (for observation access code download template)
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

router.get('/tu/public/letter-validation/:token/preview-pdf', publicValidationLimiter, async (req, res) => {
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
    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public validation preview PDF error:', err);
    res.status(500).send('Gagal memvalidasi surat.');
  }
});

router.get('/tu/public/letter-validation/:token', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).json({ error: 'Token validasi tidak valid.' });
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

    const tuSettings = await getTuSettingsPayload();
    const backgroundImageBase64 = getSharedLetterBackground(tuSettings.letterBackgrounds).imageBase64 || '';

    if (activeResult.rows.length > 0) {
      let deanName = 'Nama Dekan Belum Diatur';
      let deanTitle = 'Dekan';
      try {
        const deanResult = await pool.query(`
          SELECT nama, jabatan
          FROM lecturer
          WHERE jabatan ILIKE 'Dekan%' OR jabatan ILIKE 'Wakil Dekan%'
          ORDER BY CASE WHEN jabatan ILIKE 'Dekan%' THEN 0 ELSE 1 END, nama ASC
          LIMIT 1
        `);
        if (deanResult.rows.length > 0) {
          deanName = deanResult.rows[0].nama;
          deanTitle = deanResult.rows[0].jabatan;
        }
      } catch (e) {
        console.error('Failed to fetch Dean data:', e);
      }

      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['active-student'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('active-student', activeResult.rows[0], req);
      letterPayload.signer = { name: deanName, title: deanTitle };
      const html = await buildLetterHtml('active-student', activeResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (observationResult.rows.length > 0) {
      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['observation'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('observation', observationResult.rows[0], req);
      letterPayload.signer = { name: observationResult.rows[0].lecturer_name || 'Dosen Pengampu', title: 'Pengampu Mata Kuliah' };
      const html = await buildLetterHtml('observation', observationResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (counselingResult.rows.length > 0) {
      const assetKey = LETTER_TYPE_TO_CLIENT_KEY.counseling;
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('counseling', counselingResult.rows[0], req);
      letterPayload.signer = await getDeanSigner();
      const html = await buildLetterHtml('counseling', counselingResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (researchResult.rows.length > 0) {
      const researchLetterType = getResearchLetterType(researchResult.rows[0]);
      const assetKey = letterConfig[researchLetterType]?.assetKey || LETTER_TYPE_TO_CLIENT_KEY.research;
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload(researchLetterType, researchResult.rows[0], req);
      const signers = await buildResearchSignerList(researchResult.rows[0]);
      letterPayload.signer = signers[0] || null;
      letterPayload.signers = signers;
      const html = await buildLetterHtml(researchLetterType, researchResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    if (suRekResult.rows.length > 0) {
      const assetKey = LETTER_TYPE_TO_CLIENT_KEY['su-rek'];
      const layout = normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
      const letterPayload = buildLetterValidationPayload('su-rek', suRekResult.rows[0], req);

      letterPayload.signer = await getRecommendationSigner();
      const html = await buildLetterHtml('su-rek', suRekResult.rows[0], req);
      return res.json({
        success: true,
        letter: {
          ...letterPayload,
          backgroundImageBase64,
          layout,
          html
        }
      });
    }

    return res.status(404).json({ error: 'Surat tidak ditemukan atau token validasi tidak terdaftar.' });
  } catch (err) {
    console.error('Public letter validation error:', err);
    res.status(500).json({ error: 'Gagal memvalidasi surat.' });
  }
});

router.get('/tu/public/letter-validation/:token/download', publicValidationLimiter, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) {
    return res.status(400).json({ error: 'Token validasi tidak valid.' });
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
      return res.status(404).json({ error: 'Surat tidak ditemukan atau token validasi tidak terdaftar.' });
    }

    if (!['verified', 'sent'].includes(requestData.status)) {
      return res.status(403).json({ error: 'Surat belum berstatus resmi.' });
    }

    const pdfBuffer = await buildLetterPdfBuffer(type, requestData, req);
    const config = letterConfig[type];
    const safeLetterNumber = (requestData.letter_number || config.pdfFilename).replace(/\//g, '_');
    const filename = `${safeLetterNumber}_${requestData.nim}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public letter validation download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh surat tervalidasi.' });
  }
});

router.post('/tu/public/observation-letter/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM observation_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildObservationAccessPayload(result.rows[0]) });
  } catch (err) {
    console.error('Public observation access lookup error:', err);
    res.status(500).json({ error: 'Gagal membuka surat observasi.' });
  }
});

router.patch('/tu/public/observation-letter/access', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  const {
    recipientName,
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
    // Update konten surat saja; letter_number tidak akan berubah.
    const updateResult = await pool.query(
      `UPDATE observation_requests
       SET recipient_name = $1,
           company = $2,
           company_address = $3,
           course_name = $4,
           lecturer_name = $5,
           head_of_program_name = $6,
           student_members = $7::jsonb,
           carbon_copies = $8::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE access_code = $9
       RETURNING *`,
      [
        String(recipientName || '').trim() || null,
        String(companyName || '').trim() || null,
        String(companyAddress || '').trim() || null,
        String(courseName || '').trim() || null,
        String(lecturerName || '').trim() || null,
        String(headOfProgramName || '').trim() || null,
        JSON.stringify(normalizeObservationStudents(students)),
        JSON.stringify(carbonCopies || carbon_copies || []),
        accessCode
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    res.json({ success: true, letter: buildObservationAccessPayload(updateResult.rows[0]) });
  } catch (err) {
    console.error('Public observation access update error:', err);
    res.status(500).json({ error: 'Gagal menyimpan perubahan surat observasi.' });
  }
});

router.post('/tu/public/observation-letter/download', publicObservationAccessLimiter, async (req, res) => {
  const accessCode = normalizeObservationAccessCode(req.body?.accessCode);
  if (!accessCode) {
    return res.status(400).json({ error: 'Kode akses tidak valid.' });
  }

  try {
    await ensureTuInfrastructure();
    const result = await pool.query(
      `SELECT * FROM observation_requests
       WHERE access_code = $1
       LIMIT 1`,
      [accessCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Surat observasi tidak ditemukan untuk kode akses tersebut.' });
    }

    const requestData = result.rows[0];
    const pdfBuffer = await buildObservationPdfBuffer(requestData, req);
    const safeCompanyName = (requestData.company || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public observation access download error:', err);
    res.status(500).json({ error: 'Gagal mengunduh ulang surat observasi.' });
  }
});

router.get('/tu/public/qr-download/:token', async (req, res) => {
  const token = req.params.token;
  if (token.startsWith('QR-')) {
    const session = qrDownloadSessions.get(token);
    if (!session) {
      return res.status(404).send('Link download tidak valid atau sudah kadaluarsa (maksimal 10 menit).');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', session.buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${session.filename}"`);
    return res.send(session.buffer);
  }

  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    const tokenHash = hashQrDownloadToken(token);
    const result = await client.query(
      `SELECT * FROM observation_requests
       WHERE qr_download_token_hash = $1
         AND qr_download_token_expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Link download tidak valid atau sudah kadaluarsa (maksimal 24 jam).');
    }

    const requestData = await ensureLetterValidationToken(client, 'observation', result.rows[0]);
    const pdfBuffer = await buildLetterPdfBuffer('observation', requestData, req);
    const safeCompanyName = (requestData.company || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = `SuratObservasi_${safeCompanyName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public QR download error:', err);
    res.status(500).send('Gagal mengunduh surat.');
  } finally {
    client.release();
  }
});

export default router;
