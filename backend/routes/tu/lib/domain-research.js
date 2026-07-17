import { pool } from './db-infrastructure.js';
import { buildResearchAccessPayload } from './data-mappers.js';
import { ensureLetterNumber, getTuSettingsPayload } from './letter-number.js';
import { buildResearchSignerList } from './signers.js';
import { ensureLetterValidationToken } from './letter-html.js';
import { getRecommendationSigner, getDeanSigner, getStudyProgramByNim } from './university.js';
import { createResearchAccessCode, normalizeResearchAccessCode } from './tokens.js';
import { RESEARCH_LETTER_KIND, INTERVIEW_LETTER_KIND, PERMISSION_LETTER_KIND } from './constants.js';
import { escapeXml } from './sanitize.js';

const normalizeResearchPayload = async (payload = {}) => {
  const nim = String(payload.nim || '').trim();
  const studyProgram = nim ? await getStudyProgramByNim(nim) : null;
  const settingsPayload = await getTuSettingsPayload();
  const researchDefaults = normalizeResearchDefaults(settingsPayload);
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const hasDestinationPlace = hasOwn('destinationPlace') || hasOwn('destination_place');
  const hasDestinationAddress = hasOwn('destinationAddress') || hasOwn('destination_address');
  const researchPlace = String(payload.researchPlace || payload.research_place || '').trim();
  const researchAddress = String(payload.researchAddress || payload.research_address || '').trim();
  const destinationPlace = hasDestinationPlace
    ? String(payload.destinationPlace || payload.destination_place || '').trim()
    : researchPlace;
  const destinationAddress = hasDestinationAddress
    ? String(payload.destinationAddress || payload.destination_address || '').trim()
    : researchAddress;
  const rawLetterKind = payload.letterKind || payload.letter_kind;
  const letterKind = rawLetterKind === INTERVIEW_LETTER_KIND
    ? INTERVIEW_LETTER_KIND
    : rawLetterKind === PERMISSION_LETTER_KIND
      ? PERMISSION_LETTER_KIND
      : RESEARCH_LETTER_KIND;

  return {
    letter_kind: letterKind,
    name: formatStudentName(payload.name || ''),
    nim,
    email: String(payload.email || '').trim(),
    recipient_name: String(payload.recipientName || payload.recipient_name || '').trim(),
    recipient_title: String(payload.recipientTitle || payload.recipient_title || '').trim(),
    destination_place: destinationPlace,
    destination_address: destinationAddress,
    research_place: researchPlace,
    research_address: researchAddress,
    assignment_type: researchDefaults.assignmentType,
    research_title: String(payload.researchTitle || payload.research_title || '').trim(),
    permission_purpose: String(payload.permissionPurpose || payload.permission_purpose || '').trim(),
    contact_person: String(payload.contactPerson || payload.contact_person || '').trim(),
    study_program_level: payload.studyProgramLevel || payload.study_program_level || studyProgram?.studyProgramLevel || null,
    study_program_name: payload.studyProgramName || payload.study_program_name || studyProgram?.studyProgramName || null,
    advisors: normalizeResearchAdvisors(payload.advisors, researchDefaults, { preserveCustomTitle: false }),
    include_research_place: true,
    carbon_copies: Array.isArray(payload.carbonCopies || payload.carbon_copies) ? (payload.carbonCopies || payload.carbon_copies) : []
  };
};

const validateResearchPayload = (data) => {
  if (!data.name) return 'Nama mahasiswa wajib diisi.';
  if (!data.nim) return 'NIM mahasiswa wajib diisi.';
  if (!data.recipient_title) return 'Jabatan penerima surat wajib diisi.';
  if (!data.destination_place) return 'Instansi atau tempat tujuan surat wajib diisi.';
  if (!data.destination_address) return 'Alamat tujuan surat wajib diisi.';
  if (data.letter_kind === PERMISSION_LETTER_KIND && !data.permission_purpose) return 'Keperluan izin wajib diisi.';
  if (!data.research_place) return data.letter_kind === INTERVIEW_LETTER_KIND ? 'Tempat wawancara wajib diisi.' : data.letter_kind === PERMISSION_LETTER_KIND ? 'Lokasi atau instansi perizinan wajib diisi.' : 'Tempat penelitian wajib diisi.';
  if (!data.study_program_name) return 'Program studi wajib diisi.';
  if (!data.research_title) return data.letter_kind === INTERVIEW_LETTER_KIND ? 'Topik atau judul wawancara wajib diisi.' : data.letter_kind === PERMISSION_LETTER_KIND ? 'Judul tugas akhir wajib diisi.' : 'Judul penelitian wajib diisi.';
  return null;
};

const ensureResearchAccessCode = async (client, requestData) => {
  if (requestData.access_code) {
    return requestData;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const accessCode = createResearchAccessCode(requestData.letter_kind);
      const updateResult = await client.query(
        `UPDATE ta_letter_requests
         SET access_code = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [accessCode, requestData.id]
      );
      return updateResult.rows[0];
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }

  throw new Error('Gagal membuat kode akses surat penelitian.');
};

const upsertResearchRequest = async (client, data, targetStatus) => {
  const recentDuplicate = await client.query(
    `SELECT * FROM ta_letter_requests
     WHERE nim = $1
       AND letter_kind IS NOT DISTINCT FROM $2
       AND research_place IS NOT DISTINCT FROM $3
       AND research_title IS NOT DISTINCT FROM $4
       AND destination_place IS NOT DISTINCT FROM $5
       AND permission_purpose IS NOT DISTINCT FROM $6
       AND created_at > NOW() - INTERVAL '1 day'
      ORDER BY created_at DESC LIMIT 1`,
    [data.nim, data.letter_kind, data.research_place, data.research_title, data.destination_place, data.permission_purpose || null]
  );

  if (recentDuplicate.rows.length > 0) {
    const existing = recentDuplicate.rows[0];
    const statusPriority = { pending: 1, verified: 2, sent: 3 };
    const currentStatusLevel = statusPriority[existing.status] || 0;
    const targetStatusLevel = statusPriority[targetStatus] || 0;
    const newStatus = targetStatusLevel > currentStatusLevel ? targetStatus : existing.status;

    const updateResult = await client.query(
      `UPDATE ta_letter_requests SET
         name = $1,
         email = $2,
         recipient_name = $3,
         recipient_title = $4,
         destination_place = $5,
         destination_address = $6,
         research_place = $7,
         research_address = $8,
         assignment_type = $9,
         research_title = $10,
         permission_purpose = $11,
         contact_person = $12,
         study_program_level = $13,
         study_program_name = $14,
         letter_kind = $15,
         advisors = $16::jsonb,
         include_research_place = $17,
         status = $18,
         carbon_copies = $19::jsonb,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $20
       RETURNING *`,
      [
        data.name,
        data.email,
        data.recipient_name,
        data.recipient_title,
        data.destination_place,
        data.destination_address,
        data.research_place,
        data.research_address,
        data.assignment_type,
        data.research_title,
        data.permission_purpose || null,
        data.contact_person,
        data.study_program_level,
        data.study_program_name,
        data.letter_kind,
        JSON.stringify(data.advisors || []),
        data.include_research_place !== false,
        newStatus,
        JSON.stringify(data.carbon_copies || []),
        existing.id
      ]
    );
    return updateResult.rows[0];
  }

  const id = `${data.letter_kind === INTERVIEW_LETTER_KIND ? 'WCR' : data.letter_kind === PERMISSION_LETTER_KIND ? 'IZN' : 'PEN'}-${Date.now()}`;
  const insertResult = await client.query(
    `INSERT INTO ta_letter_requests (
       id, name, nim, email, recipient_name, recipient_title, destination_place,
       destination_address, research_place, research_address, assignment_type,
       research_title, permission_purpose, contact_person, study_program_level, study_program_name,
       letter_kind, advisors, include_research_place, status, carbon_copies
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21::jsonb)
      RETURNING *`,
    [
      id,
      data.name,
      data.nim,
      data.email,
      data.recipient_name,
      data.recipient_title,
      data.destination_place,
      data.destination_address,
      data.research_place,
      data.research_address,
      data.assignment_type,
      data.research_title,
      data.permission_purpose || null,
      data.contact_person,
      data.study_program_level,
      data.study_program_name,
      data.letter_kind,
      JSON.stringify(data.advisors || []),
      data.include_research_place !== false,
      targetStatus,
      JSON.stringify(data.carbon_copies || [])
    ]
  );

  return insertResult.rows[0];
};

const createFinalResearchRequest = async (client, payload, targetStatus, req, letterKind = RESEARCH_LETTER_KIND) => {
  const normalized = await normalizeResearchPayload({
    ...payload,
    letterKind,
    email: payload.email || req.user?.email || ''
  });
  const resolvedEmail = normalized.email || `arsip-${normalized.nim || Date.now()}@core.fti`;
  const data = { ...normalized, email: resolvedEmail };
  const validationMessage = validateResearchPayload(data);
  if (validationMessage) {
    const error = new Error(validationMessage);
    error.statusCode = 400;
    throw error;
  }

  let requestData = await upsertResearchRequest(client, data, targetStatus);
  const letterType = getResearchLetterType(requestData);
  
  if (targetStatus === 'verified' || targetStatus === 'sent') {
    requestData = await ensureLetterNumber(client, letterType, requestData);
    requestData = await ensureLetterValidationToken(client, letterType, requestData);
  }
  
  requestData = await ensureResearchAccessCode(client, requestData);
  return requestData;
};





const getResearchLetterType = (row = {}) =>
  row.letter_kind === INTERVIEW_LETTER_KIND
    ? INTERVIEW_LETTER_KIND
    : row.letter_kind === PERMISSION_LETTER_KIND
      ? PERMISSION_LETTER_KIND
      : RESEARCH_LETTER_KIND;



















const normalizeResearchDefaults = (source = {}) => ({
  assignmentType: String(source.researchAssignmentType || source.tu_research_assignment_type || '').trim() || DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
  advisorTitle: String(source.researchAdvisorTitle || source.tu_research_advisor_title || '').trim() || DEFAULT_RESEARCH_ADVISOR_TITLE,
  advisorTitleFirst: String(source.researchAdvisorTitleFirst || source.tu_research_advisor_title_first || '').trim() || DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
  advisorTitleSecond: String(source.researchAdvisorTitleSecond || source.tu_research_advisor_title_second || '').trim() || DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND
});

const normalizeInterviewDefaults = (source = {}) => ({
  assignmentType: String(source.interviewAssignmentType || source.tu_interview_assignment_type || '').trim() || DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
  advisorTitle: String(source.interviewAdvisorTitle || source.tu_interview_advisor_title || '').trim() || DEFAULT_INTERVIEW_ADVISOR_TITLE,
  advisorTitleFirst: String(source.interviewAdvisorTitleFirst || source.tu_interview_advisor_title_first || '').trim() || DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
  advisorTitleSecond: String(source.interviewAdvisorTitleSecond || source.tu_interview_advisor_title_second || '').trim() || DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND
});

const normalizePermissionDefaults = (source = {}) => ({
  assignmentType: String(source.permissionAssignmentType || source.tu_permission_assignment_type || '').trim() || DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
  advisorTitle: String(source.permissionAdvisorTitle || source.tu_permission_advisor_title || '').trim() || DEFAULT_PERMISSION_ADVISOR_TITLE,
  advisorTitleFirst: String(source.permissionAdvisorTitleFirst || source.tu_permission_advisor_title_first || '').trim() || DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
  advisorTitleSecond: String(source.permissionPermissionAdvisorTitleSecond || source.tu_permission_advisor_title_second || '').trim() || DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND
});

const getResearchAdvisorTitle = (index, total, defaults = normalizeResearchDefaults()) => {
  if (total <= 1) return defaults.advisorTitle;
  return index === 0 ? defaults.advisorTitleFirst : defaults.advisorTitleSecond;
};

const isSystemResearchAdvisorTitle = (title, defaults = normalizeResearchDefaults()) => {
  const normalized = String(title || '').trim();
  if (!normalized) return true;
  return new Set([
    DEFAULT_RESEARCH_ADVISOR_TITLE,
    DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
    DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
    defaults.advisorTitle,
    defaults.advisorTitleFirst,
    defaults.advisorTitleSecond
  ]).has(normalized);
};

const normalizeResearchAdvisors = (advisors, defaults = normalizeResearchDefaults(), options = {}) => {
  if (!Array.isArray(advisors)) return [];

  const { preserveCustomTitle = true } = options;
  const normalizedAdvisors = advisors
    .slice(0, 2)
    .map((advisor) => ({
      name: String(advisor?.name || advisor?.nama || '').trim(),
      title: String(advisor?.title || advisor?.jabatan || '').trim()
    }))
    .filter((advisor) => advisor.name);

  return normalizedAdvisors.map((advisor, index) => {
    const defaultTitle = getResearchAdvisorTitle(index, normalizedAdvisors.length, defaults);
    if (!preserveCustomTitle || isSystemResearchAdvisorTitle(advisor.title, defaults)) {
      return { ...advisor, title: defaultTitle };
    }
    return { ...advisor, title: advisor.title || defaultTitle };
  });
};

const buildResearchAdvisorText = (advisors, defaults = normalizeResearchDefaults()) => {
  const normalizedAdvisors = normalizeResearchAdvisors(advisors, defaults);
  if (normalizedAdvisors.length === 0) return '';

  return normalizedAdvisors
    .map((advisor) => `${advisor.name} (${advisor.title})`)
    .join(', ');
};

const buildResearchAdvisorSignatureHtml = (advisors, defaults = normalizeResearchDefaults()) => {
  const normalizedAdvisors = normalizeResearchAdvisors(advisors, defaults);
  if (normalizedAdvisors.length === 0) return '';

  const advisorItems = normalizedAdvisors
    .map((advisor, index) => {
      const title = normalizedAdvisors.length === 1
        ? (advisor.title || defaults.advisorTitle)
        : (advisor.title || getResearchAdvisorTitle(index, normalizedAdvisors.length, defaults));
      return `
        <div class="advisor-item">
          <p class="signature-name">${escapeXml(advisor.name)}</p>
          <p>${escapeXml(title)}</p>
        </div>
      `;
    })
    .join('');

  return `
    <div class="signature-content advisor-column">
      <p>Mengetahui,</p>
      <div class="advisor-list">${advisorItems}</div>
    </div>

  `;
};

export {
  getResearchLetterType,
  normalizeResearchDefaults,
  normalizeInterviewDefaults,
  normalizePermissionDefaults,
  getResearchAdvisorTitle,
  isSystemResearchAdvisorTitle,
  normalizeResearchAdvisors,
  buildResearchAdvisorText,
  buildResearchAdvisorSignatureHtml,
  normalizeResearchPayload,
  validateResearchPayload,
  ensureResearchAccessCode,
  upsertResearchRequest,
  createFinalResearchRequest
};

