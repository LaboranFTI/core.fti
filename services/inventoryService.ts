import { Equipment } from '../types';
import { api } from './httpClient';

export const inventoryApi = {
  list: () => api('/api/inventory'),
  create: (data: Partial<Equipment>) => api('/api/inventory', { method: 'POST', data }),
  update: (id: string, data: Partial<Equipment>) =>
    api(`/api/inventory/${id}`, { method: 'PUT', data }),
  delete: (id: string) => api(`/api/inventory/${id}`, { method: 'DELETE' }),
};
