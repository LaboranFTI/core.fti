import express from 'express';
import {
  pool,
  verifyRole,
  TU_ADMIN_ROLES,
  TU_ACCESS_ROLES,
  getTuSettingsPayload,
  ensureTuInfrastructure,
  upsertSystemSetting,
  saveLetterBackgrounds,
  saveLetterLayouts
} from './core.js';

const router = express.Router();

router.get('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  try {
    res.json(await getTuSettingsPayload());
  } catch (err) {
    console.error('Get TU settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan TU.' });
  }
});

router.get('/tu/letter-backgrounds', verifyRole(TU_ACCESS_ROLES), async (req, res) => {
  try {
    const {
      letterBackgrounds,
      letterLayouts,
      counselingSubject,
      counselingRecipientName,
      counselingReferralUnit,
      researchAssignmentType,
      researchAdvisorTitle,
      researchAdvisorTitleFirst,
      researchAdvisorTitleSecond,
      interviewAssignmentType,
      interviewAdvisorTitle,
      interviewAdvisorTitleFirst,
      interviewAdvisorTitleSecond,
      permissionAssignmentType,
      permissionAdvisorTitle,
      permissionAdvisorTitleFirst,
      permissionAdvisorTitleSecond
    } = await getTuSettingsPayload();
    res.json({
      success: true,
      letterBackgrounds,
      letterLayouts,
      counselingSubject,
      counselingRecipientName,
      counselingReferralUnit,
      researchAssignmentType,
      researchAdvisorTitle,
      researchAdvisorTitleFirst,
      researchAdvisorTitleSecond,
      interviewAssignmentType,
      interviewAdvisorTitle,
      interviewAdvisorTitleFirst,
      interviewAdvisorTitleSecond,
      permissionAssignmentType,
      permissionAdvisorTitle,
      permissionAdvisorTitleFirst,
      permissionAdvisorTitleSecond
    });
  } catch (err) {
    console.error('Get TU letter backgrounds error:', err);
    res.status(500).json({ error: 'Gagal mengambil background surat TU.' });
  }
});

router.post('/tu/settings', verifyRole(TU_ADMIN_ROLES), async (req, res) => {
  const {
    signatureBase64,
    stampBase64,
    currentSemesterCode,
    counselingSubject,
    counselingRecipientName,
    counselingReferralUnit,
    researchAssignmentType,
    researchAdvisorTitle,
    researchAdvisorTitleFirst,
    researchAdvisorTitleSecond,
    interviewAssignmentType,
    interviewAdvisorTitle,
    interviewAdvisorTitleFirst,
    interviewAdvisorTitleSecond,
    permissionAssignmentType,
    permissionAdvisorTitle,
    permissionAdvisorTitleFirst,
    permissionAdvisorTitleSecond,
    suRekYangTerhormat,
    suRekBerdasarkanNo,
    suRekPerihal,
    suRekLampiran,
    suRekTembusan,
    letterBackgrounds,
    letterLayouts
  } = req.body;

  if (currentSemesterCode && !/^\d{4}[123]$/.test(String(currentSemesterCode))) {
    return res.status(400).json({ error: 'Format semester berjalan tidak valid. Gunakan format seperti 20251, 20252, atau 20253.' });
  }

  const client = await pool.connect();

  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    await upsertSystemSetting(client, 'tu_dean_signature_base64', signatureBase64 || '');
    await upsertSystemSetting(client, 'tu_faculty_stamp_base64', stampBase64 || '');
    await upsertSystemSetting(client, 'tu_current_semester_code', currentSemesterCode || '');
    await upsertSystemSetting(client, 'tu_counseling_subject', counselingSubject || '');
    await upsertSystemSetting(client, 'tu_counseling_recipient_name', counselingRecipientName || '');
    await upsertSystemSetting(client, 'tu_counseling_referral_unit', counselingReferralUnit || '');
    await upsertSystemSetting(client, 'tu_research_assignment_type', researchAssignmentType || '');
    await upsertSystemSetting(client, 'tu_research_advisor_title', researchAdvisorTitle || '');
    await upsertSystemSetting(client, 'tu_research_advisor_title_first', researchAdvisorTitleFirst || '');
    await upsertSystemSetting(client, 'tu_research_advisor_title_second', researchAdvisorTitleSecond || '');
    await upsertSystemSetting(client, 'tu_interview_assignment_type', interviewAssignmentType || '');
    await upsertSystemSetting(client, 'tu_interview_advisor_title', interviewAdvisorTitle || '');
    await upsertSystemSetting(client, 'tu_interview_advisor_title_first', interviewAdvisorTitleFirst || '');
    await upsertSystemSetting(client, 'tu_interview_advisor_title_second', interviewAdvisorTitleSecond || '');
    await upsertSystemSetting(client, 'tu_permission_assignment_type', permissionAssignmentType || '');
    await upsertSystemSetting(client, 'tu_permission_advisor_title', permissionAdvisorTitle || '');
    await upsertSystemSetting(client, 'tu_permission_advisor_title_first', permissionAdvisorTitleFirst || '');
    await upsertSystemSetting(client, 'tu_permission_advisor_title_second', permissionAdvisorTitleSecond || '');
    await upsertSystemSetting(client, 'tu_su_rek_yang_terhormat', suRekYangTerhormat || '');
    await upsertSystemSetting(client, 'tu_su_rek_berdasarkan_no', suRekBerdasarkanNo || '');
    await upsertSystemSetting(client, 'tu_su_rek_perihal', suRekPerihal || '');
    await upsertSystemSetting(client, 'tu_su_rek_lampiran', suRekLampiran || '');
    await upsertSystemSetting(client, 'tu_su_rek_tembusan', JSON.stringify(suRekTembusan || []));
    await saveLetterBackgrounds(client, letterBackgrounds);
    await saveLetterLayouts(client, letterLayouts);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save TU settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan TU.' });
  } finally {
    client.release();
  }
});

export default router;
