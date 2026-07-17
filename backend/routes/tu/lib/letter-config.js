import { pool } from './db-infrastructure.js';
import { buildObservationStudentRowsHtml } from './domain-observation.js';
import { getRecommendationSigner, getDeanSigner, formatFacultyProgram, getStudyProgramByNim } from './university.js';
import { normalizeResearchDefaults, normalizeInterviewDefaults, normalizePermissionDefaults, getResearchAdvisorTitle, normalizeResearchAdvisors, buildResearchAdvisorText, buildResearchAdvisorSignatureHtml } from './domain-research.js';
import { DEFAULT_COUNSELING_SUBJECT, DEFAULT_COUNSELING_RECIPIENT_NAME, DEFAULT_COUNSELING_REFERRAL_UNIT } from './constants.js';
import { escapeXml } from './sanitize.js';

const letterConfig = {
  'active-student': {
    table: 'active_student_requests',
    template: 'suratAktifKuliahV2.html',
    subject: 'Surat Keterangan Aktif Kuliah',
    pdfFilename: 'Surat_Aktif_Kuliah',
    emailBody: `
      <p>Permohonan Surat Keterangan Aktif Kuliah Anda telah disetujui dan diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, semesterMeta }) => {
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

      const studyProgram = data.study_program_level && data.study_program_name
        ? {
            studyProgramLevel: data.study_program_level,
            studyProgramName: data.study_program_name
          }
        : await getStudyProgramByNim(data.nim);

      return {
        '{{tempatTanggalLahir}}': buildBirthPlaceAndDate(data.birth_place || data.birthPlace, data.birth_date || data.birthDate),
        '{{jenjangProgram}}': data.study_program_level || data.studyProgramLevel || studyProgram?.studyProgramLevel || '',
        '{{programStudi}}': data.study_program_name || data.studyProgramName || studyProgram?.studyProgramName || '',
        '{{fakultas}}': data.faculty || data.facultyName || DEFAULT_FACULTY,
        '{{universitas}}': data.university || DEFAULT_UNIVERSITY,
        '{{semester}}': semesterMeta.semesterName,
        '{{tahunAkademik}}': semesterMeta.academicYear,
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Permohonan Surat Aktif Kuliah',
        '{{lampiran}}': '1 lembar',
        '{{deanName}}': deanName,
        '{{deanTitle}}': deanTitle
      };
    }
  },
  observation: {
    table: 'observation_requests',
    template: 'suratObservasiV2.html',
    subject: 'Surat Pengantar Observasi',
    pdfFilename: 'Surat_Pengantar_Observasi',
    emailBody: `
      <p>Permohonan Surat Pengantar Observasi Anda telah diproses oleh Sistem CORE.FTI.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF.</p>
    `,
    getPlaceholders: ({ data, letterNumber }) => {
      const level = data.study_program_level || data.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        'Sarjana': 'S1',
        'Magister': 'S2',
        'Doktor': 'S3'
      };

      const tanggalSurat = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Pengantar Observasi',
        '{{lampiran}}': '-',
        '{{recipientName}}': data.recipient_name || data.recipientName || '(tidak disebutkan)',
        '{{companyAddress}}': data.company_address || data.companyAddress || '(tidak disebutkan)',
        '{{purpose}}': data.purpose || '(tidak disebutkan)',
        '{{company}}': data.company || '(tidak disebutkan)',
        '{{courseName}}': data.course_name || data.courseName || '(tidak disebutkan)',
        '{{lecturerName}}': data.lecturer_name || data.lecturerName || '(tidak disebutkan)',
        '{{headOfProgramName}}': data.head_of_program_name || data.headOfProgramName || '(tidak disebutkan)',
        '{{jenjangProgram}}': map[level] || level,
        '{{programStudi}}': data.study_program_name || data.studyProgramName || 'Teknik Informatika',
        '{{studentRows}}': buildObservationStudentRowsHtml(data.student_members || data.students),
        '{{tanggalSurat}}': tanggalSurat
      };
    }
  },
  counseling: {
    table: 'counseling_requests',
    template: 'suratKonselingV2.html',
    subject: 'Surat Pengantar Konseling',
    pdfFilename: 'Surat_Pengantar_Konseling',
    emailBody: `
      <p>Surat Pengantar Konseling telah diproses oleh Tata Usaha FTI UKSW.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah memiliki QR validasi publik.</p>
    `,
    getPlaceholders: async ({ data, letterNumber }) => {
      const deanSigner = await getDeanSigner();
      const studyProgram = data.study_program_level && data.study_program_name
        ? {
            studyProgramLevel: data.study_program_level,
            studyProgramName: data.study_program_name
          }
        : await getStudyProgramByNim(data.nim);
      const recipientName = String(data.recipient_name || data.recipientName || '')
        .split(/\r?\n/)
        .map((line) => escapeXml(line))
        .join('<br>');

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': escapeXml(data.subject || data.subjectName || DEFAULT_COUNSELING_SUBJECT),
        '{{lampiran}}': '-',
        '{{recipientName}}': recipientName || DEFAULT_COUNSELING_RECIPIENT_NAME.split('\n').map((line) => escapeXml(line)).join('<br>'),
        '{{studentName}}': escapeXml(data.name || ''),
        '{{studentNim}}': escapeXml(data.nim || ''),
        '{{fakProgdi}}': escapeXml(formatFacultyProgram({
          faculty: data.faculty || 'FTI',
          studyProgramLevel: data.study_program_level || data.studyProgramLevel || studyProgram?.studyProgramLevel || '',
          studyProgramName: data.study_program_name || data.studyProgramName || studyProgram?.studyProgramName || ''
        })),
        '{{referralUnit}}': escapeXml(data.referral_unit || data.referralUnit || DEFAULT_COUNSELING_REFERRAL_UNIT),
        '{{deanName}}': escapeXml(deanSigner.name),
        '{{deanTitle}}': escapeXml(deanSigner.title)
      };
    }
  },
  research: {
    table: 'ta_letter_requests',
    template: 'suratPenelitianV2.html',
    subject: 'Rekomendasi Penelitian',
    pdfFilename: 'Surat_Rekomendasi_Penelitian',
    emailBody: `
      <p>Surat Rekomendasi Penelitian telah diproses oleh Tata Usaha FTI UKSW.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah memiliki QR validasi publik.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, tuSettings }) => {
      const deanSigner = await getRecommendationSigner();
      const researchDefaults = normalizeResearchDefaults(tuSettings);
      const level = data.study_program_level || data.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        Sarjana: 'S1',
        Magister: 'S2',
        Doktor: 'S3'
      };
      const studyProgramLabel = `${map[level] || level} ${data.study_program_name || data.studyProgramName || ''}`.trim();
      const rawResearchPlace = data.research_place || data.researchPlace || '';
      const rawDestinationPlace = data.destination_place || data.destinationPlace || rawResearchPlace;
      const researchPlace = rawResearchPlace || rawDestinationPlace;
      const researchPlacePhrase = researchPlace ? ` di <strong>${escapeXml(researchPlace)}</strong>` : '';
      const destinationAddress = String(data.destination_address || data.destinationAddress || data.research_address || data.researchAddress || '')
        .split(/\r?\n/)
        .map((line) => escapeXml(line))
        .join('<br>');
      const advisors = normalizeResearchAdvisors(data.advisors, researchDefaults);

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Rekomendasi Penelitian',
        '{{lampiran}}': '-',
        '{{recipientName}}': escapeXml(data.recipient_name || data.recipientName || ''),
        '{{recipientTitle}}': escapeXml(data.recipient_title || data.recipientTitle || ''),
        '{{destinationPlace}}': escapeXml(rawDestinationPlace),
        '{{destinationAddress}}': destinationAddress,
        '{{researchPlace}}': escapeXml(researchPlace),
        '{{assignmentType}}': escapeXml(data.assignment_type || data.assignmentType || researchDefaults.assignmentType),
        '{{programStudi}}': escapeXml(studyProgramLabel || 'Teknik Informatika'),
        '{{studentName}}': escapeXml(data.name || ''),
        '{{studentNim}}': escapeXml(data.nim || ''),
        '{{contactPerson}}': escapeXml(data.contact_person || data.contactPerson || data.nim || ''),
        '{{researchPlacePhrase}}': researchPlacePhrase,
        '{{researchTitle}}': escapeXml(data.research_title || data.researchTitle || ''),
        '{{advisorParagraph}}': advisors.length > 0
          ? `<p>Pembimbing mahasiswa tersebut adalah ${escapeXml(buildResearchAdvisorText(advisors, researchDefaults))}.</p>`
          : '',
        '{{deanName}}': escapeXml(deanSigner.name),
        '{{deanTitle}}': escapeXml(deanSigner.title),
        '{{advisorSignatureBlock}}': buildResearchAdvisorSignatureHtml(advisors, researchDefaults),
        '{{signatureLineClass}}': advisors.length > 0 ? 'with-advisors' : 'single-signer'
      };
    }
  },
  interview: {
    table: 'ta_letter_requests',
    template: 'suratWawancaraV2.html',
    subject: 'Surat Izin Wawancara',
    pdfFilename: 'Surat_Izin_Wawancara',
    emailBody: `
      <p>Surat Izin Wawancara telah diproses oleh Tata Usaha FTI UKSW.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah memiliki QR validasi publik.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, tuSettings }) => {
      const deanSigner = await getRecommendationSigner();
      const interviewDefaults = normalizeInterviewDefaults(tuSettings);
      const level = data.study_program_level || data.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        Sarjana: 'S1',
        Magister: 'S2',
        Doktor: 'S3'
      };
      const studyProgramLabel = `${map[level] || level} ${data.study_program_name || data.studyProgramName || ''}`.trim();
      const rawResearchPlace = data.research_place || data.researchPlace || '';
      const rawDestinationPlace = data.destination_place || data.destinationPlace || rawResearchPlace;
      const researchPlace = rawResearchPlace || rawDestinationPlace;
      const researchPlacePhrase = researchPlace ? ` di <strong>${escapeXml(researchPlace)}</strong>` : '';
      const destinationAddress = String(data.destination_address || data.destinationAddress || data.research_address || data.researchAddress || '')
        .split(/\r?\n/)
        .map((line) => escapeXml(line))
        .join('<br>');
      const advisors = normalizeResearchAdvisors(data.advisors, interviewDefaults);

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': 'Izin Wawancara',
        '{{lampiran}}': '-',
        '{{recipientName}}': escapeXml(data.recipient_name || data.recipientName || ''),
        '{{recipientTitle}}': escapeXml(data.recipient_title || data.recipientTitle || ''),
        '{{destinationPlace}}': escapeXml(rawDestinationPlace),
        '{{destinationAddress}}': destinationAddress,
        '{{researchPlace}}': escapeXml(researchPlace),
        '{{assignmentType}}': escapeXml(data.assignment_type || data.assignmentType || interviewDefaults.assignmentType),
        '{{programStudi}}': escapeXml(studyProgramLabel || 'Teknik Informatika'),
        '{{studentName}}': escapeXml(data.name || ''),
        '{{studentNim}}': escapeXml(data.nim || ''),
        '{{contactPerson}}': escapeXml(data.contact_person || data.contactPerson || data.nim || ''),
        '{{researchPlacePhrase}}': researchPlacePhrase,
        '{{researchTitle}}': escapeXml(data.research_title || data.researchTitle || ''),
        '{{advisorParagraph}}': advisors.length > 0
          ? `<p>Pembimbing mahasiswa tersebut adalah ${escapeXml(buildResearchAdvisorText(advisors, interviewDefaults))}.</p>`
          : '',
        '{{deanName}}': escapeXml(deanSigner.name),
        '{{deanTitle}}': escapeXml(deanSigner.title),
        '{{advisorSignatureBlock}}': buildResearchAdvisorSignatureHtml(advisors, interviewDefaults),
        '{{signatureLineClass}}': advisors.length > 0 ? 'with-advisors' : 'single-signer'
      };
    }
  },
  permission: {
    table: 'ta_letter_requests',
    template: 'suratPerizinanV2.html',
    subject: 'Surat Perizinan',
    pdfFilename: 'Surat_Perizinan',
    emailBody: `
      <p>Surat Perizinan telah diproses oleh Tata Usaha FTI UKSW.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah memiliki QR validasi publik.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, tuSettings }) => {
      const deanSigner = await getRecommendationSigner();
      const permissionDefaults = normalizePermissionDefaults(tuSettings);
      const level = data.study_program_level || data.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        Sarjana: 'S1',
        Magister: 'S2',
        Doktor: 'S3'
      };
      const studyProgramLabel = `${map[level] || level} ${data.study_program_name || data.studyProgramName || ''}`.trim();
      const rawResearchPlace = data.research_place || data.researchPlace || '';
      const rawDestinationPlace = data.destination_place || data.destinationPlace || rawResearchPlace;
      const researchPlace = rawResearchPlace || rawDestinationPlace;
      const researchPlacePhrase = researchPlace ? ` di <strong>${escapeXml(researchPlace)}</strong>` : '';
      const destinationAddress = String(data.destination_address || data.destinationAddress || data.research_address || data.researchAddress || '')
        .split(/\r?\n/)
        .map((line) => escapeXml(line))
        .join('<br>');
      const advisors = normalizeResearchAdvisors(data.advisors, permissionDefaults);
      const permissionPurpose = String(data.permission_purpose || data.permissionPurpose || '').trim();
      const permissionPurposeForText = permissionPurpose || 'melakukan kegiatan yang diperlukan';
      const permissionPurposeForSubject = permissionPurpose || 'Kegiatan Tugas Akhir';

      return {
        '{{nomorSurat}}': letterNumber,
        '{{letterPurpose}}': `Permohonan Izin ${escapeXml(permissionPurposeForSubject)}`,
        '{{lampiran}}': '-',
        '{{recipientName}}': escapeXml(data.recipient_name || data.recipientName || ''),
        '{{recipientTitle}}': escapeXml(data.recipient_title || data.recipientTitle || ''),
        '{{destinationPlace}}': escapeXml(rawDestinationPlace),
        '{{destinationAddress}}': destinationAddress,
        '{{researchPlace}}': escapeXml(researchPlace),
        '{{assignmentType}}': escapeXml(data.assignment_type || data.assignmentType || permissionDefaults.assignmentType),
        '{{programStudi}}': escapeXml(studyProgramLabel || 'Teknik Informatika'),
        '{{studentName}}': escapeXml(data.name || ''),
        '{{studentNim}}': escapeXml(data.nim || ''),
        '{{contactPerson}}': escapeXml(data.contact_person || data.contactPerson || data.nim || ''),
        '{{researchPlacePhrase}}': researchPlacePhrase,
        '{{researchTitle}}': escapeXml(data.research_title || data.researchTitle || ''),
        '{{permissionPurpose}}': escapeXml(permissionPurposeForText),
        '{{advisorParagraph}}': advisors.length > 0
          ? `<p>Pembimbing mahasiswa tersebut adalah ${escapeXml(buildResearchAdvisorText(advisors, permissionDefaults))}.</p>`
          : '',
        '{{deanName}}': escapeXml(deanSigner.name),
        '{{deanTitle}}': escapeXml(deanSigner.title),
        '{{advisorSignatureBlock}}': buildResearchAdvisorSignatureHtml(advisors, permissionDefaults),
        '{{signatureLineClass}}': advisors.length > 0 ? 'with-advisors' : 'single-signer'
      };
    }
  },
  'su-rek': {
    table: 'su_rek_requests',
    template: 'suratRekomendasiAfirmasiV2.html',
    subject: 'Surat Rekomendasi Afirmasi Cemerlang',
    pdfFilename: 'Surat_Rekomendasi_Afirmasi',
    emailBody: `
      <p>Permohonan Surat Rekomendasi Afirmasi Cemerlang Anda telah disetujui dan diproses oleh Tata Usaha.</p>
      <p>Surat tersebut terlampir pada email ini dalam format PDF dan sudah dilegalisir secara digital.</p>
    `,
    getPlaceholders: async ({ data, letterNumber, semesterMeta }) => {
      const recommendationSigner = await getRecommendationSigner();

      const studyProgram = await getStudyProgramByNim(data.nim);
      const programLevel = studyProgram?.studyProgramLevel || 'Sarjana';
      const map = {
        'Diploma Tiga': 'D3',
        'Sarjana': 'S1',
        'Magister': 'S2',
        'Doktor': 'S3'
      };
      const formattedProdi = `${map[programLevel] || programLevel} ${studyProgram?.studyProgramName || ''}`.toUpperCase();

      const tanggalSurat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
      const academicYearDashed = (semesterMeta?.academicYear || '2025/2026').replace(/\//g, '-');

      return {
        '{{nomorSurat}}': letterNumber,
        '{{lampiran}}': data.lampiran || '1 bendel',
        '{{recipientName}}': String(data.recipient_name || data.recipientName || '').replace(/\r?\n/g, '<br>'),
        '{{berdasarkanNo}}': data.berdasarkan_no || data.berdasarkanNo || '',
        '{{perihal}}': data.perihal || 'Beasiswa Afirmasi Cemerlang, ACPOS dan ACPA',
        '{{name}}': (data.name || '').toUpperCase(),
        '{{nim}}': (data.nim || '').toUpperCase(),
        '{{programStudi}}': formattedProdi,
        '{{dekanNama}}': escapeXml(recommendationSigner.name),
        '{{dekanTitle}}': escapeXml(recommendationSigner.title),
        '{{tanggalSurat}}': tanggalSurat,
        '{{tahunAkademikDashed}}': academicYearDashed
      };
    }
  }
};






export {
  letterConfig
};
