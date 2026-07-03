import {
  CONTROL_REFRESH_MS,
  TRAFFIC_HISTORY_LIMIT,
  TRAFFIC_SOURCE_ROUTER,
  TRAFFIC_SOURCE_SIMULATION,
} from './constants';

export const getCoreAuthToken = () => sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || '';

export const createTrafficPoint = (sample, source) => ({
  time: sample.timestamp || Date.now(),
  download: Math.round((sample.rxRate || 0) / 1024),
  upload: Math.round((sample.txRate || 0) / 1024),
  source,
});

export const getSampleSource = (sample, fallbackSource = TRAFFIC_SOURCE_ROUTER) =>
  sample?.source || (sample?.simulated ? TRAFFIC_SOURCE_SIMULATION : fallbackSource);

export const isHistorySource = (history, source) =>
  history.length === 0 || history.every(point => point.source === source);

export const generateSimulationHistory = (iface) => {
  const now = Date.now();
  return Array.from({ length: TRAFFIC_HISTORY_LIMIT }, (_, i) => ({
    time: now - ((TRAFFIC_HISTORY_LIMIT - i) * CONTROL_REFRESH_MS),
    download: iface.enabled ? Math.floor(Math.random() * 100) : 0,
    upload: iface.enabled ? Math.floor(Math.random() * 30) : 0,
    source: TRAFFIC_SOURCE_SIMULATION,
  }));
};

export const formatBandwidthMbps = (value) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '--';
  const normalized = Number(value);
  return Number.isInteger(normalized) ? `${normalized}` : normalized.toFixed(2).replace(/\.?0+$/, '');
};

export const formatRateMbps = (value) => {
  const normalized = Number(value || 0);
  return normalized >= 1_000_000
    ? `${(normalized / 1_000_000).toFixed(1).replace(/\.0$/, '')} Mbps`
    : `${(normalized / 1_000).toFixed(0)} Kbps`;
};

export const normalizeLabName = (value) => value.toLowerCase().replace(/\s+/g, '');

export const addressListNameFromReference = (reference) =>
  reference.startsWith('Address List: ') ? reference.replace('Address List: ', '') : '';

export const buildLabsOnlyIndex = (order) =>
  new Map(order.map((name, index) => [normalizeLabName(name), index]));
