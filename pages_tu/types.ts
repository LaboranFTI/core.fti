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
  document: LetterAsset;
  activeStudent: LetterAsset;
  observation: LetterAsset;
  counseling?: LetterAsset;
  research?: LetterAsset;
  suRek?: LetterAsset;
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
  counseling?: LetterLayout;
  research?: LetterLayout;
  suRek?: LetterLayout;
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
  carbonCopies?: { role: string; name?: string }[];
  letterNumber?: string;
  validationToken?: string;
  accessCode?: string;
}

export interface ResearchAdvisor {
  name: string;
  title?: string;
}

export interface ResearchLetterData {
  name: string;
  nim: string;
  email?: string;
  recipientName: string;
  recipientTitle?: string;
  destinationPlace: string;
  destinationAddress: string;
  researchPlace: string;
  assignmentType: string;
  researchTitle: string;
  contactPerson: string;
  studyProgramId?: string;
  studyProgramName?: string;
  studyProgramLevel?: string;
  advisors: ResearchAdvisor[];
  includeResearchPlace?: boolean;
  carbonCopies?: { role: string; name?: string }[];
  letterNumber?: string;
  validationToken?: string;
  accessCode?: string;
}

export interface ResearchRequest extends ResearchLetterData {
  id: string;
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  letterGeneratedAt?: string;
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
  studyProgramLevel?: string;
  studyProgramName?: string;
  students: Student[];
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  letterNumber?: string;
  validationToken?: string;
  accessCode?: string;
  letterGeneratedAt?: string;
  carbonCopies?: { role: string; name?: string }[];
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
  validationToken?: string;
  letterGeneratedAt?: string;
  carbonCopies?: { role: string; name?: string }[];
}

export interface SuRekRequest {
  id: string;
  name: string;
  nim: string;
  email: string;
  recipientName?: string;
  berdasarkanNo?: string;
  perihal?: string;
  lampiran?: string;
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  letterNumber?: string;
  validationToken?: string;
  accessCode?: string;
  letterGeneratedAt?: string;
  carbonCopies?: { role: string; name?: string }[];
}

export interface CounselingRequest {
  id: string;
  name: string;
  nim: string;
  email: string;
  subject?: string;
  recipientName?: string;
  referralUnit?: string;
  studyProgramLevel?: string;
  studyProgramName?: string;
  faculty?: string;
  status: 'pending' | 'verified' | 'sent';
  createdAt: string;
  signatureBase64?: string;
  stampBase64?: string;
  letterNumber?: string;
  validationToken?: string;
  letterGeneratedAt?: string;
  carbonCopies?: { role: string; name?: string }[];
}
