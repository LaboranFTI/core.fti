import {
  ActiveStudentRequest,
  CounselingRequest,
  ObservationRequest,
  SuRekRequest
} from '../../types';

export type ArchiveStatus = ActiveStudentRequest['status'];
export type StatusFilter = 'all' | ArchiveStatus;

export interface ArchiveCollections {
  activeRequests: ActiveStudentRequest[];
  observationRequests: ObservationRequest[];
  counselingRequests: CounselingRequest[];
  suRekRequests: SuRekRequest[];
}

interface FilterArchiveRequestsInput extends ArchiveCollections {
  searchQuery: string;
  statusFilter: StatusFilter;
  formatDate: (date: string) => string;
}

type ArchiveItem = ActiveStudentRequest | ObservationRequest | CounselingRequest | SuRekRequest;

const matchesStatus = (status: ArchiveStatus, statusFilter: StatusFilter) =>
  statusFilter === 'all' || status === statusFilter;

const matchesQuery = (fields: Array<string | undefined>, normalizedQuery: string) =>
  normalizedQuery === '' ||
  fields.some((field) => (field || '').toLowerCase().includes(normalizedQuery));

export function filterArchiveRequests({
  activeRequests,
  observationRequests,
  counselingRequests,
  suRekRequests,
  searchQuery,
  statusFilter,
  formatDate
}: FilterArchiveRequestsInput) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return {
    filteredActiveRequests: activeRequests.filter((item) =>
      matchesStatus(item.status, statusFilter) &&
      matchesQuery([
        item.name,
        item.nim,
        item.email,
        item.letterNumber,
        item.studyProgramName,
        item.faculty,
        formatDate(item.createdAt)
      ], normalizedQuery)
    ),
    filteredObservationRequests: observationRequests.filter((item) =>
      matchesStatus(item.status, statusFilter) &&
      matchesQuery([
        item.name,
        item.nim,
        item.email,
        item.recipientName,
        item.company,
        item.courseName,
        item.lecturerName,
        item.letterNumber,
        formatDate(item.createdAt)
      ], normalizedQuery)
    ),
    filteredCounselingRequests: counselingRequests.filter((item) =>
      matchesStatus(item.status, statusFilter) &&
      matchesQuery([
        item.name,
        item.nim,
        item.email,
        item.subject,
        item.recipientName,
        item.referralUnit,
        item.studyProgramName,
        item.letterNumber,
        formatDate(item.createdAt)
      ], normalizedQuery)
    ),
    filteredSuRekRequests: suRekRequests.filter((item) =>
      matchesStatus(item.status, statusFilter) &&
      matchesQuery([
        item.name,
        item.nim,
        item.email,
        item.recipientName,
        item.berdasarkanNo,
        item.perihal,
        item.lampiran,
        item.letterNumber,
        formatDate(item.createdAt)
      ], normalizedQuery)
    )
  };
}

export function countArchiveStatuses({
  activeRequests,
  observationRequests,
  counselingRequests,
  suRekRequests
}: ArchiveCollections) {
  const archiveItems: ArchiveItem[] = [
    ...activeRequests,
    ...observationRequests,
    ...counselingRequests,
    ...suRekRequests
  ];

  return {
    totalArchiveCount: archiveItems.length,
    pendingCount: archiveItems.filter((item) => item.status === 'pending').length,
    verifiedCount: archiveItems.filter((item) => item.status === 'verified').length,
    sentCount: archiveItems.filter((item) => item.status === 'sent').length
  };
}
