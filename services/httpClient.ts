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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientStatus = (status: number) => status === 502 || status === 503;

const getErrorSnippet = async (response: Response, maxChars = 4000) => {
  try {
    const text = await response.text();
    if (!text) return '';
    return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
  } catch {
    return '';
  }
};

const isAbortError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    return (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('aborted') ||
      error.message.toLowerCase().includes('abort')
    );
  }
  return false;
};

const isNetworkOrTimeoutError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  if (isAbortError(error)) return false;

  const msg = error.message?.toLowerCase?.() ?? '';
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
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

  const isIdempotentGet = (config.method || 'GET').toUpperCase() === 'GET';
  const shouldRetry =
    isIdempotentGet; // only retry GET to avoid unexpected side effects

  const maxAttempts = shouldRetry ? 3 : 1;
  const backoffMs = shouldRetry ? [0, 300, 700] : [0];

  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(backoffMs[attempt] ?? 0);

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

      if (shouldRetry && isTransientStatus(response.status) && attempt < maxAttempts - 1) {
        // Retry transient gateway/service errors
        continue;
      }

      if (!response.ok) {
        const snippet = await getErrorSnippet(response);
        const error = new Error(
          `API request failed: ${config.method || 'GET'} ${url} -> ${response.status} ${response.statusText}. Body: ${snippet}`
        );
        (error as any).status = response.status;
        (error as any).url = url;
        throw error;
      }

      return response;
    } catch (error) {
      lastError = error;

      // If caller's external signal was aborted or operation was aborted, do not retry and rethrow AbortError directly
      if (config.signal?.aborted || isAbortError(error)) {
        if (error instanceof DOMException || (error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
        throw new DOMException(error instanceof Error ? error.message : 'The operation was aborted.', 'AbortError');
      }

      const retryable =
        shouldRetry && (isNetworkOrTimeoutError(error) || (error instanceof Error && error.message.toLowerCase().includes('502')));

      if (!retryable || attempt >= maxAttempts - 1) {
        // Re-throw with context if possible
        if (error instanceof Error) {
          const enriched = new Error(
            `API request error: ${config.method || 'GET'} ${url}. Attempts: ${attempt + 1}/${maxAttempts}. Last error: ${error.message}`
          );
          (enriched as any).cause = error;
          throw enriched;
        }
        throw error;
      }
    }
  }

  throw lastError;
};

export default api;
