import { api } from '../../services/api';

export type AdminRequestType = 'activeStudent' | 'observation' | 'counseling' | 'suRek';
export type ArchiveRequestType = 'active' | 'observation' | 'counseling' | 'su-rek';
export type TuApiRequestType = 'active-student' | 'observation' | 'counseling' | 'su-rek';

export const getAdminRequestEndpoint = (type: AdminRequestType) => {
  if (type === 'observation') return '/api/observation-requests';
  if (type === 'counseling') return '/api/counseling-requests';
  if (type === 'suRek') return '/api/su-rek-requests';
  return '/api/active-student';
};

export const getArchiveApiType = (type: ArchiveRequestType): TuApiRequestType => {
  if (type === 'active') return 'active-student';
  return type;
};

export const getArchiveTitle = (type: ArchiveRequestType) => {
  if (type === 'active') return 'Surat aktif kuliah';
  if (type === 'observation') return 'Surat observasi';
  if (type === 'counseling') return 'Surat konseling';
  return 'Surat rekomendasi';
};

export const tuApi = {
  getSettings: () => api('/api/tu/settings'),
  saveSettings: (data: Record<string, unknown>) =>
    api('/api/tu/settings', { method: 'POST', data }),
  getLetterBackgrounds: () => api('/api/tu/letter-backgrounds'),
  getRequestsByAdminType: (type: AdminRequestType) => api(getAdminRequestEndpoint(type)),
  getActiveStudentRequests: () => api('/api/active-student'),
  getObservationRequests: () => api('/api/observation-requests'),
  getCounselingRequests: () => api('/api/counseling-requests'),
  getSuRekRequests: () => api('/api/su-rek-requests'),
  sendLetterEmail: (type: TuApiRequestType, id: string) =>
    api(`/api/tu/requests/${type}/${id}/send-email`, { method: 'POST' }),
  downloadLetter: (type: TuApiRequestType, id: string) =>
    api(`/api/tu/requests/${type}/${id}/download`, { method: 'GET' }),
  ensureValidationToken: (type: TuApiRequestType, id: string) =>
    api(`/api/tu/requests/${type}/${id}/validation-token`, { method: 'POST' }),
  deleteLetter: (type: TuApiRequestType, id: string) =>
    api(`/api/tu/requests/${type}/${id}`, { method: 'DELETE' }),
  batchDeleteLetters: (type: TuApiRequestType, ids: string[]) =>
    api(`/api/tu/requests/${type}/batch-delete`, { method: 'POST', data: { ids } }),
  updateObservation: (id: string, data: Record<string, unknown>) =>
    api(`/api/tu/requests/observation/${id}`, { method: 'PATCH', data }),
  updateSuRek: (id: string, data: Record<string, unknown>) =>
    api(`/api/tu/requests/su-rek/${id}`, { method: 'PATCH', data }),
  updateCounseling: (id: string, data: Record<string, unknown>) =>
    api(`/api/tu/requests/counseling/${id}`, { method: 'PATCH', data }),
  verifyObservation: (id: string) =>
    api(`/api/observation-requests/${id}/verify`, { method: 'PUT' }),
  verifyCounseling: (id: string) =>
    api(`/api/counseling-requests/${id}/verify`, { method: 'PUT' }),
  verifyAdminRequest: (type: AdminRequestType, id: string, data?: Record<string, unknown>) => {
    const endpoint = type === 'activeStudent'
      ? `/api/active-student/${id}/verify`
      : type === 'observation'
        ? `/api/observation-requests/${id}/verify`
        : type === 'counseling'
          ? `/api/counseling-requests/${id}/verify`
          : `/api/su-rek-requests/${id}/verify`;

    return api(endpoint, { method: 'PUT', data });
  },
  getDeanLecturers: () => api('/api/lecturers/by-jabatan/Dekan'),
  getViceDeanLecturers: () => api('/api/lecturers/by-jabatan/Wakil Dekan')
};
