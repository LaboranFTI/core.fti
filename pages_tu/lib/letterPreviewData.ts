import {
  DEFAULT_COUNSELING_RECIPIENT_NAME,
  DEFAULT_COUNSELING_REFERRAL_UNIT,
  DEFAULT_COUNSELING_SUBJECT,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND,
  DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
  DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
  DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND,
  DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
  DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
  DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
  DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
  formatPreviewLetterNumber,
  LetterLayoutKey
} from './letterSettings';

type SuRekCarbonCopy = {
  role: string;
  name: string;
};

export type LetterPreviewOptions = {
  previewBaseUrl: string;
  counselingSubject: string;
  counselingRecipientName: string;
  counselingReferralUnit: string;
  researchAssignmentType: string;
  researchAdvisorTitleFirst: string;
  researchAdvisorTitleSecond: string;
  interviewAssignmentType: string;
  interviewAdvisorTitleFirst: string;
  interviewAdvisorTitleSecond: string;
  permissionAssignmentType: string;
  permissionAdvisorTitleFirst: string;
  permissionAdvisorTitleSecond: string;
  suRekYangTerhormat: string;
  suRekBerdasarkanNo: string;
  suRekPerihal: string;
  suRekLampiran: string;
  suRekTembusan: SuRekCarbonCopy[];
};

export const getDummyDataForPreview = (key: LetterLayoutKey, options: LetterPreviewOptions) => {
  const previewDate = new Date();
  const firmandez = {
    name: 'Firmandez Febrian Afandy',
    nim: '682022013',
    email: '682022013@student.uksw.edu',
    birthPlace: 'Salatiga',
    birthDate: '2024-02-13',
    birthPlaceAndDate: 'Salatiga, 13 Februari 2024',
    studyProgramLevel: 'S1',
    studyProgramName: 'Sistem Informasi'
  };
  const nauval = {
    name: 'Nauval Caesaro Premana',
    nim: '682021062',
    email: '682021062@student.uksw.edu',
    studyProgramLevel: 'S1',
    studyProgramName: 'Sistem Informasi'
  };
  const validationUrl = (token: string) => `${options.previewBaseUrl}/tu/validasi-surat/${token}`;

  if (key === 'activeStudent') {
    return {
      ...firmandez,
      faculty: 'Teknologi Informasi',
      university: 'Universitas Kristen Satya Wacana',
      letterNumber: formatPreviewLetterNumber('activeStudent', 1, previewDate),
      validationToken: 'dummy-token-active',
      validationUrl: validationUrl('dummy-token-active'),
      letterDate: previewDate.toISOString()
    };
  }
  if (key === 'observation') {
    return {
      recipientName: 'Manajer SDM',
      companyName: 'PT Teknologi Maju',
      companyAddress: 'Jl. Jenderal Sudirman No. 123, Jakarta',
      courseName: 'Analisis dan Perancangan Sistem Informasi',
      lecturerName: 'Dr. Jane Smith',
      headOfProgramName: 'Dr. Albert Wesker',
      studyProgramName: 'Sistem Informasi',
      studyProgramLevel: 'S1',
      students: [
        { name: firmandez.name, nim: firmandez.nim },
        { name: nauval.name, nim: nauval.nim }
      ],
      letterNumber: formatPreviewLetterNumber('observation', 2, previewDate),
      validationToken: 'dummy-token-obs',
      validationUrl: validationUrl('dummy-token-obs'),
      letterDate: previewDate.toISOString()
    };
  }
  if (key === 'counseling') {
    return {
      ...firmandez,
      email: firmandez.email,
      subject: options.counselingSubject || DEFAULT_COUNSELING_SUBJECT,
      recipientName: options.counselingRecipientName || DEFAULT_COUNSELING_RECIPIENT_NAME,
      referralUnit: options.counselingReferralUnit || DEFAULT_COUNSELING_REFERRAL_UNIT,
      faculty: 'FTI',
      studyProgramLevel: 'S1',
      studyProgramName: 'Sistem Informasi',
      letterNumber: formatPreviewLetterNumber('counseling', 4, previewDate),
      validationToken: 'dummy-token-counseling',
      validationUrl: validationUrl('dummy-token-counseling'),
      letterDate: previewDate.toISOString()
    };
  }
  if (key === 'research') {
    return {
      ...firmandez,
      recipientName: 'Kepala Dinas Komunikasi dan Informatika',
      recipientTitle: 'Kota Salatiga',
      destinationPlace: 'Dinas Komunikasi dan Informatika Kota Salatiga',
      destinationAddress: 'Jl. Letjen Sukowati No. 51, Salatiga',
      researchPlace: 'Bidang Aplikasi Informatika',
      assignmentType: options.researchAssignmentType || DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
      researchTitle: 'Analisis Kualitas Layanan Sistem Informasi Akademik Berbasis Web',
      contactPerson: firmandez.nim,
      studyProgramLevel: 'S1',
      studyProgramName: 'Sistem Informasi',
      advisors: [
        { name: 'Dr. Budi Santoso', title: options.researchAdvisorTitleFirst || DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST },
        { name: 'Dr. Citra Lestari', title: options.researchAdvisorTitleSecond || DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND }
      ],
      letterNumber: formatPreviewLetterNumber('research', 5, previewDate),
      validationToken: 'dummy-token-research',
      validationUrl: validationUrl('dummy-token-research'),
      letterDate: previewDate.toISOString()
    };
  }
  if (key === 'interview') {
    return {
      ...firmandez,
      recipientName: 'Pimpinan Redaksi Jawa Pos',
      recipientTitle: 'Jawa Pos Radar Semarang',
      destinationPlace: 'Kantor Jawa Pos Radar Semarang',
      destinationAddress: 'Jl. Veteran No. 55, Semarang',
      researchPlace: 'Divisi Pemberitaan',
      assignmentType: options.interviewAssignmentType || DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
      researchTitle: 'Peran Jurnalisme Investigatif dalam Menyoroti Isu Transparansi Publik',
      contactPerson: firmandez.nim,
      studyProgramLevel: 'S1',
      studyProgramName: 'Sistem Informasi',
      advisors: [
        { name: 'Dr. Budi Santoso', title: options.interviewAdvisorTitleFirst || DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST },
        { name: 'Dr. Citra Lestari', title: options.interviewAdvisorTitleSecond || DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND }
      ],
      letterNumber: formatPreviewLetterNumber('interview', 6, previewDate),
      validationToken: 'dummy-token-interview',
      validationUrl: validationUrl('dummy-token-interview'),
      letterDate: previewDate.toISOString()
    };
  }
  if (key === 'permission') {
    return {
      ...firmandez,
      recipientName: 'Kepala Sekolah SMA Negeri 1 Salatiga',
      recipientTitle: 'Salatiga',
      destinationPlace: 'SMA Negeri 1 Salatiga',
      destinationAddress: 'Jl. Kemiri No. 1, Salatiga',
      researchPlace: 'Laboratorium Komputer',
      assignmentType: options.permissionAssignmentType || DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
      researchTitle: 'Implementasi Sistem Informasi Pendaftaran Siswa Baru Berbasis Cloud',
      contactPerson: firmandez.nim,
      studyProgramLevel: 'S1',
      studyProgramName: 'Sistem Informasi',
      advisors: [
        { name: 'Dr. Budi Santoso', title: options.permissionAdvisorTitleFirst || DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST },
        { name: 'Dr. Citra Lestari', title: options.permissionAdvisorTitleSecond || DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND }
      ],
      letterNumber: formatPreviewLetterNumber('permission', 7, previewDate),
      validationToken: 'dummy-token-permission',
      validationUrl: validationUrl('dummy-token-permission'),
      letterDate: previewDate.toISOString()
    };
  }

  return {
    ...firmandez,
    recipientName: options.suRekYangTerhormat || 'Panitia Seleksi Beasiswa Afirmasi',
    berdasarkanNo: options.suRekBerdasarkanNo || '008/WR-KK/02/2026',
    perihal: options.suRekPerihal || 'Rekomendasi Pendaftaran Beasiswa Afirmasi Cemerlang',
    lampiran: options.suRekLampiran || '-',
    carbonCopies: options.suRekTembusan.length > 0 ? [...options.suRekTembusan] : [],
    letterNumber: formatPreviewLetterNumber('suRek', 3, previewDate),
    validationToken: 'dummy-token-rek',
    validationUrl: validationUrl('dummy-token-rek'),
    letterDate: previewDate.toISOString()
  };
};
