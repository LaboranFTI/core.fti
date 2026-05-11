export interface Student {
  name: string;
  nim: string;
}

export interface LetterAsset {
  imageBase64: string;
  fileName: string;
  mimeType?: string;
}

export interface TULetterBackgrounds {
  activeStudent: LetterAsset;
  observation: LetterAsset;
}

export interface LetterLayout {
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
}

export interface TULetterLayouts {
  activeStudent: LetterLayout;
  observation: LetterLayout;
}

export interface ObservationData {
  recipientName: string;
  companyName: string;
  companyAddress: string;
  courseName: string;
  lecturerName: string;
  headOfProgramName: string;
  studyProgramId?: string;
  studyProgramName?: string;
  studyProgramLevel?: string;
  students: Student[];
}

export interface ObservationRequest {
  id: string;
  name: string;
  nim: string;
  email: string;
  recipientName?: string;
  companyAddress?: string;
  purpose?: string;
  company?: string;
  courseName?: string;
  lecturerName?: string;
  headOfProgramName?: string;
  students: Student[];
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  letterNumber?: string;
  letterGeneratedAt?: string;
}

export interface ActiveStudentRequest {
  id: string;
  name: string;
  nim: string;
  email: string;
  birthPlace?: string;
  birthDate?: string;
  studyProgramLevel?: string;
  studyProgramName?: string;
  faculty?: string;
  university?: string;
  transcriptBase64: string;
  transcriptName: string;
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  semesterCode?: string;
  semesterName?: string;
  academicYear?: string;
  letterNumber?: string;
  letterGeneratedAt?: string;
}
