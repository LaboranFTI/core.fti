import { API_BASE_URL } from '../config';

interface ApiRequest extends RequestInit {
  data?: any;
  timeoutMs?: number;
}

let refreshPromise: Promise<string | null> | null = null;
const DEFAULT_API_TIMEOUT_MS = 30000;
const REFRESH_API_TIMEOUT_MS = 10000;
const REFRESH_EXCLUDED_PREFIXES = [
  '/api/auth/refresh',
  '/api/login',
  '/api/register',
  '/api/recaptcha/config',
  '/api/auth/google',
  '/api/check-user-exists',
  '/api/set-password',
];

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
};

const refreshAuthToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  const deviceId = localStorage.getItem('deviceId');

  if (!refreshToken || !deviceId) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshRes = await fetchWithTimeout(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, deviceId })
        }, REFRESH_API_TIMEOUT_MS);

        if (!refreshRes.ok) return null;

        const data = await refreshRes.json();
        if (!data.success || !data.token) return null;

        if (sessionStorage.getItem('authToken')) {
          sessionStorage.setItem('authToken', data.token);
        } else {
          localStorage.setItem('authToken', data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        return data.token as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

export const api = async (endpoint: string, options: ApiRequest = {}) => {
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${formattedEndpoint}`;
  const { data, timeoutMs, ...requestOptions } = options;
  const requestTimeoutMs = timeoutMs ?? DEFAULT_API_TIMEOUT_MS;

  const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    customHeaders.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...requestOptions,
    method: requestOptions.method || 'GET',
    headers: {
      ...customHeaders,
      ...requestOptions.headers,
    },
  };

  if (data) {
    if (data instanceof FormData) {
      config.body = data;
      delete (config.headers as Record<string, string>)['Content-Type'];
    } else {
      config.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetchWithTimeout(url, config, requestTimeoutMs);
    const shouldSkipRefresh = REFRESH_EXCLUDED_PREFIXES.some((prefix) => formattedEndpoint.startsWith(prefix));

    if (response.status === 401 && !shouldSkipRefresh) {
      const newToken = await refreshAuthToken();

      if (newToken) {
        const newHeaders = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`
        };
        return fetchWithTimeout(url, { ...config, headers: newHeaders }, requestTimeoutMs);
      }

      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return response;
  } catch (error) {
    throw error;
  }
};

export default api;
