import { pool } from './db-infrastructure.js';
import { buildObservationAccessPayload } from './data-mappers.js';
import { generatePdfBuffer, getTuSettingsPayload } from './letter-number.js';
import { createObservationAccessCode, normalizeObservationAccessCode } from './tokens.js';
import { ensureLetterValidationToken, buildLetterPdfBuffer } from './letter-html.js';
import { getQrCenterLogoDataUrl } from './qr.js';
import { clampMarginMm } from './letterLayout.js';
import { escapeXml } from './sanitize.js';

const buildObservationPdfBuffer = async (requestData, req) => {
  const requestWithToken = await ensureLetterValidationToken(pool, 'observation', requestData);
  return buildLetterPdfBuffer('observation', requestWithToken, req);
};

const ensureObservationAccessCode = async (client, requestData) => {
  if (requestData.access_code) {
    return requestData;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const accessCode = createObservationAccessCode();
      const updateResult = await client.query(
        `UPDATE observation_requests
         SET access_code = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [accessCode, requestData.id]
      );
      return updateResult.rows[0];
    } catch (err) {
      if (err?.code === '23505') {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Gagal membuat kode akses surat observasi.');
};

const upsertObservationRequest = async (client, data, targetStatus) => {
  const recentDuplicate = await client.query(
    `SELECT * FROM observation_requests 
     WHERE nim = $1 
       AND company IS NOT DISTINCT FROM $2 
       AND course_name IS NOT DISTINCT FROM $3 
       AND created_at > NOW() - INTERVAL '1 day'
     ORDER BY created_at DESC LIMIT 1`,
    [data.nim, data.company, data.course_name]
  );

  if (recentDuplicate.rows.length > 0) {
    const existing = recentDuplicate.rows[0];
    const statusPriority = { 'pending': 1, 'verified': 2, 'sent': 3 };
    const currentStatusLevel = statusPriority[existing.status] || 0;
    const targetStatusLevel = statusPriority[targetStatus] || 0;
    const newStatus = targetStatusLevel > currentStatusLevel ? targetStatus : existing.status;

    const updateResult = await client.query(
      `UPDATE observation_requests SET 
         name = $1, email = $2, recipient_name = $3, company_address = $4,
         purpose = $5, lecturer_name = $6, head_of_program_name = $7, study_program_level = $8,
         study_program_name = $9, student_members = $10::jsonb, status = $11, carbon_copies = $12::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [
        data.name, data.email, data.recipient_name, data.company_address, data.purpose || null,
        data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), newStatus,
        JSON.stringify(data.carbon_copies || []),
        existing.id
      ]
    );
    return updateResult.rows[0];
  } else {
    const id = `OBS-${Date.now()}`;
    const insertResult = await client.query(
      `INSERT INTO observation_requests (
          id, name, nim, email, recipient_name, company_address, company,
          purpose, course_name, lecturer_name, head_of_program_name, study_program_level, study_program_name, student_members, status, carbon_copies
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb)
      RETURNING *`,
      [
        id, data.name, data.nim, data.email, data.recipient_name, data.company_address, data.company, 
        data.purpose || null, data.course_name, data.lecturer_name, data.head_of_program_name, data.study_program_level, 
        data.study_program_name, JSON.stringify(data.student_members || []), targetStatus,
        JSON.stringify(data.carbon_copies || [])
      ]
    );
    return insertResult.rows[0];
  }
};


const normalizeObservationStudents = (students) => {
  if (!Array.isArray(students)) return [];

  return students
    .map((student) => ({
      name: String(student?.name || '').trim(),
      nim: String(student?.nim || '').trim()
    }))
    .filter((student) => student.name || student.nim);
};

const buildObservationStudentRowsHtml = (students) => {
  const normalizedStudents = normalizeObservationStudents(students);

  if (normalizedStudents.length === 0) {
    return `
      <tr>
        <td colspan="2" style="font-style: italic; color: gray; padding-top: 0.8mm; padding-bottom: 0.8mm;">Data mahasiswa belum ditambahkan</td>
      </tr>
    `;
  }

  return normalizedStudents
    .map((student) => `
      <tr>
        <td style="padding-top: 0.8mm; padding-bottom: 0.8mm;">${student.name || '-'}</td>
        <td style="padding-top: 0.8mm; padding-bottom: 0.8mm;">${student.nim || '-'}</td>
      </tr>
    `)
    .join('');
};









export {
  normalizeObservationStudents,
  buildObservationStudentRowsHtml,
  buildObservationPdfBuffer,
  ensureObservationAccessCode,
  upsertObservationRequest
};
