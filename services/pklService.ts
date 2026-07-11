import { api } from './httpClient';

export const pklApi = {
  list: () => api('/api/pkl'),
  create: (students: Record<string, unknown>[]) =>
    api('/api/pkl', { method: 'POST', data: { students } }),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/api/pkl/${id}`, { method: 'PUT', data }),
  delete: (id: string) => api(`/api/pkl/${id}`, { method: 'DELETE' }),
  downloadDocument: (id: string) => api(`/api/pkl/${id}/document`),
};
