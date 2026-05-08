import { Loan, Equipment, LabStaff } from '../types';

interface ApiRequest extends RequestInit {
  data?: Record<string, unknown> | Equipment | Loan | LabStaff | any;
}
import { API_BASE_URL } from '../config';

// State untuk mengelola Interceptor dan Queue Request
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

export const api = async (endpoint: string, options: ApiRequest = {}) => {
  // Pastikan format endpoint selalu valid (diawali garis miring)
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${formattedEndpoint}`;
  
  // Mengambil token JWT hasil login dari sessionStorage atau localStorage
  const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    customHeaders['Authorization'] = `Bearer ${token}`;
  }

  
  const config: RequestInit = {
    ...options,
    method: options.method || 'GET',
    headers: {
      ...customHeaders,
      ...options.headers,
    },
  };

  // Handle POST/PUT data
  if (options.data) {
    if (options.data instanceof FormData) {
      config.body = options.data;
      // Hapus header Content-Type bawaan agar browser otomatis menambahkan boundary form-data
      delete (config.headers as Record<string, string>)['Content-Type'];
    } else {
      config.body = JSON.stringify(options.data);
    }
  }

  try {
    let response = await fetch(url, config);

    // --- INTERCEPTOR: Handle 401 Unauthorized (Token Expired) ---
    if (response.status === 401 && formattedEndpoint !== '/api/auth/refresh' && formattedEndpoint !== '/api/login') {
      const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
      const deviceId = localStorage.getItem('deviceId');

      // Jika user memilih "Remember Me", maka refreshToken & deviceId tersedia
      if (refreshToken && deviceId) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken, deviceId })
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              if (data.success && data.token) {
            // Simpan token baru ke storage yang sedang aktif
            if (sessionStorage.getItem('authToken')) {
              sessionStorage.setItem('authToken', data.token);
            } else {
              localStorage.setItem('authToken', data.token);
            }
                onRefreshed(data.token);
              } else {
                onRefreshed(null); // Gagal refresh, session invalid
                window.dispatchEvent(new Event('auth:unauthorized'));
              }
            } else {
              onRefreshed(null);
              window.dispatchEvent(new Event('auth:unauthorized'));
            }
          } catch (refreshErr) {
            onRefreshed(null);
            window.dispatchEvent(new Event('auth:unauthorized'));
          } finally {
            isRefreshing = false;
          }
        }

        // Tahan request yang gagal ini, tunggu sampai proses refresh selesai
        return new Promise<Response>((resolve) => {
          subscribeTokenRefresh((newToken: string | null) => {
            if (newToken) {
              // Jika berhasil refresh, ulangi request dengan header token baru
              const newHeaders = {
                ...config.headers,
                'Authorization': `Bearer ${newToken}`
              };
              resolve(fetch(url, { ...config, headers: newHeaders }));
            } else {
              // Jika gagal refresh, teruskan error 401 aslinya ke halaman
              resolve(response);
            }
          });
        });
      }
    }
    // --- END INTERCEPTOR ---

    return response;
  } catch (error) {
    throw error;
  }
};

// Convenience typed endpoints for loans
export const loansApi = {
  list: () => api('/api/loans'),
  create: (data: { equipmentIds: string[], borrowerName: string, nim?: string, guarantee: string, borrowDate: string, borrowTime: string, borrowOfficer: string, location: string }) => 
    api('/api/loans', { method: 'POST', data }),  
  updateGroup: (transactionId: string, data: any) => 
    api(`/api/loans/group/${transactionId}`, { method: 'PUT', data }),
  returnBulk: (data: { loanIds: string[], returnDate: string, returnTime: string, returnOfficer: string, returnLocation: string, condition: string }) => 
    api('/api/loans/return', { method: 'PUT', data }),
  deleteGroup: (data: { loanIds: string[] }) => 
    api('/api/loans/group', { method: 'DELETE', data }),
};

// Inventory endpoint
export const inventoryApi = {
  list: () => api('/api/inventory'),
};

// Staff endpoint  
export const staffApi = {
  list: () => api('/api/staff'),
};

export default api;
