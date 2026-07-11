import {
  DEFAULT_COUNSELING_RECIPIENT_NAME,
  DEFAULT_COUNSELING_REFERRAL_UNIT,
  DEFAULT_COUNSELING_SUBJECT,
  DEFAULT_INTERVIEW_ADVISOR_TITLE,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND,
  DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
  DEFAULT_PERMISSION_ADVISOR_TITLE,
  DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
  DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND,
  DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
  DEFAULT_RESEARCH_ADVISOR_TITLE,
  DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
  DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
  DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
  LETTER_TYPE_TO_CLIENT_KEY,
  SHARED_LETTER_BACKGROUND_TYPE,
  TU_SETTINGS_KEYS
} from '../lib/constants.js';

export const createTuSettingsService = ({
  pool,
  ensureTuInfrastructure,
  buildLetterBackgroundsPayload,
  buildLetterLayoutsPayload,
  getSharedLetterBackground,
  normalizeLetterLayout,
  defaultLetterLayoutMm
}) => {
  const upsertSystemSetting = async (client, key, value) => {
    await client.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  };

  const getTuSettingsPayload = async () => {
    await ensureTuInfrastructure();
    const [settingsResult, assetResult, layoutResult] = await Promise.all([
      pool.query(`SELECT key, value FROM system_settings WHERE key = ANY($1)`, [TU_SETTINGS_KEYS]),
      pool.query(`SELECT letter_type, file_name, mime_type, image_base64 FROM tu_letter_backgrounds`),
      pool.query(`SELECT letter_type, margin_top_mm, margin_right_mm, margin_bottom_mm, margin_left_mm FROM tu_letter_layouts`)
    ]);

    const settings = settingsResult.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return {
      signatureBase64: settings.tu_dean_signature_base64 || '',
      stampBase64: settings.tu_faculty_stamp_base64 || '',
      currentSemesterCode: settings.tu_current_semester_code || '',
      counselingSubject: settings.tu_counseling_subject || DEFAULT_COUNSELING_SUBJECT,
      counselingRecipientName: settings.tu_counseling_recipient_name || DEFAULT_COUNSELING_RECIPIENT_NAME,
      counselingReferralUnit: settings.tu_counseling_referral_unit || DEFAULT_COUNSELING_REFERRAL_UNIT,
      researchAssignmentType: settings.tu_research_assignment_type || DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
      researchAdvisorTitle: settings.tu_research_advisor_title || DEFAULT_RESEARCH_ADVISOR_TITLE,
      researchAdvisorTitleFirst: settings.tu_research_advisor_title_first || DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
      researchAdvisorTitleSecond: settings.tu_research_advisor_title_second || DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
      interviewAssignmentType: settings.tu_interview_assignment_type || DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
      interviewAdvisorTitle: settings.tu_interview_advisor_title || DEFAULT_INTERVIEW_ADVISOR_TITLE,
      interviewAdvisorTitleFirst: settings.tu_interview_advisor_title_first || DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
      interviewAdvisorTitleSecond: settings.tu_interview_advisor_title_second || DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND,
      permissionAssignmentType: settings.tu_permission_assignment_type || DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
      permissionAdvisorTitle: settings.tu_permission_advisor_title || DEFAULT_PERMISSION_ADVISOR_TITLE,
      permissionAdvisorTitleFirst: settings.tu_permission_advisor_title_first || DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
      permissionAdvisorTitleSecond: settings.tu_permission_advisor_title_second || DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND,
      suRekYangTerhormat: settings.tu_su_rek_yang_terhormat || 'Wakil Rektor Bidang Kerjasama dan Kealumnian\nUniversitas Kristen Satya Wacana\ndi tempat',
      suRekBerdasarkanNo: settings.tu_su_rek_berdasarkan_no || '008/WR-KK/02/2025',
      suRekPerihal: settings.tu_su_rek_perihal || 'Beasiswa Afirmasi Cemerlang, ACPOS dan ACPA',
      suRekLampiran: settings.tu_su_rek_lampiran || '1 bendel',
      suRekTembusan: (() => { try { return JSON.parse(settings.tu_su_rek_tembusan || '[]'); } catch { return []; } })(),
      letterBackgrounds: buildLetterBackgroundsPayload(assetResult.rows),
      letterLayouts: buildLetterLayoutsPayload(layoutResult.rows)
    };
  };

  const saveLetterBackgrounds = async (client, letterBackgrounds) => {
    await ensureTuInfrastructure();
    if (!letterBackgrounds || typeof letterBackgrounds !== 'object') return;

    const asset = getSharedLetterBackground(letterBackgrounds);

    if (asset.imageBase64) {
      await client.query(
        `INSERT INTO tu_letter_backgrounds (letter_type, file_name, mime_type, image_base64)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (letter_type)
         DO UPDATE SET
           file_name = EXCLUDED.file_name,
           mime_type = EXCLUDED.mime_type,
           image_base64 = EXCLUDED.image_base64,
           updated_at = CURRENT_TIMESTAMP`,
        [SHARED_LETTER_BACKGROUND_TYPE, asset.fileName || '', asset.mimeType || 'image/png', asset.imageBase64]
      );
    } else {
      await client.query(
        `DELETE FROM tu_letter_backgrounds WHERE letter_type = $1`,
        [SHARED_LETTER_BACKGROUND_TYPE]
      );
    }

    await client.query(
      `DELETE FROM tu_letter_backgrounds WHERE letter_type = ANY($1::text[])`,
      [Object.keys(LETTER_TYPE_TO_CLIENT_KEY)]
    );
  };

  const saveLetterLayouts = async (client, letterLayouts) => {
    await ensureTuInfrastructure();

    for (const [letterType, clientKey] of Object.entries(LETTER_TYPE_TO_CLIENT_KEY)) {
      const fallback = defaultLetterLayoutMm[clientKey];
      const layout = normalizeLetterLayout(letterLayouts?.[clientKey], fallback);

      await client.query(
        `INSERT INTO tu_letter_layouts (
           letter_type,
           margin_top_mm,
           margin_right_mm,
           margin_bottom_mm,
           margin_left_mm
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (letter_type)
        DO UPDATE SET
           margin_top_mm = EXCLUDED.margin_top_mm,
           margin_right_mm = EXCLUDED.margin_right_mm,
           margin_bottom_mm = EXCLUDED.margin_bottom_mm,
           margin_left_mm = EXCLUDED.margin_left_mm,
           updated_at = CURRENT_TIMESTAMP`,
        [
          letterType,
          layout.marginTopMm,
          layout.marginRightMm,
          layout.marginBottomMm,
          layout.marginLeftMm
        ]
      );
    }
  };

  return {
    upsertSystemSetting,
    getTuSettingsPayload,
    saveLetterBackgrounds,
    saveLetterLayouts
  };
};
