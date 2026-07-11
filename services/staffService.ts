import { api } from './httpClient';

export const staffApi = {
  list: () => api('/api/staff'),
  listRoomsForAssignment: () => api('/api/rooms?exclude_image=true'),
  update: (id: string, data: Record<string, unknown>) =>
    api(`/api/staff/${id}`, { method: 'PUT', data }),
  create: (data: Record<string, unknown>) =>
    api('/api/staff', { method: 'POST', data }),
  delete: (id: string) => api(`/api/staff/${id}`, { method: 'DELETE' }),
};
