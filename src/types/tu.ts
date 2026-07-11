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
  students: { name: string; nim: string }[];
  carbonCopies?: { role: string; name?: string }[];
}
