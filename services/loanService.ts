import { api } from './httpClient';

export interface CreateLoanPayload {
  equipmentIds: string[];
  borrowerName: string;
  nim?: string;
  guarantee: string;
  borrowDate: string;
  borrowTime: string;
  borrowOfficer: string;
  location: string;
}

export interface ReturnLoansPayload {
  loanIds: string[];
  returnDate: string;
  returnTime: string;
  returnOfficer: string;
  returnLocation: string;
  condition: string;
}

type DeleteLoansPayload = string[] | { loanIds: string[] };

export const loansApi = {
  list: () => api('/api/loans'),
  create: (data: CreateLoanPayload) => api('/api/loans', { method: 'POST', data }),
  updateGroup: (transactionId: string, data: CreateLoanPayload) =>
    api(`/api/loans/group/${transactionId}`, { method: 'PUT', data }),
  returnBulk: (data: ReturnLoansPayload) =>
    api('/api/loans/return', { method: 'PUT', data }),
  deleteGroup: (payload: DeleteLoansPayload) => {
    const loanIds = Array.isArray(payload) ? payload : payload.loanIds;
    return api('/api/loans/group', { method: 'DELETE', data: { loanIds } });
  },
};
