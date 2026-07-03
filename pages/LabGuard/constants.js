import { API_BASE_URL } from '../../config';

export const LABGUARD_API_PREFIX = `${API_BASE_URL}/api/labguard`;
export const TRAFFIC_HISTORY_LIMIT = 20;
export const TRAFFIC_SOURCE_ROUTER = 'router';
export const TRAFFIC_SOURCE_SIMULATION = 'simulation';
export const CONTROL_REFRESH_MS = 3000;
export const AUX_REFRESH_MS = 20000;

export const LABS_ONLY_ORDER_FALLBACK = [
  'vlan461',
  'vlan463',
  'vlan467',
  'vlan464',
  'vlan465',
  'vlan469',
  'vlan459',
  'vlan457',
  'vlan455',
  'vlan454',
  'vlan453',
  'vlan451',
  'vlan431',
  'vlan402',
  'vlan506',
  'vlan507',
  'vlan301',
];

export const labGuardSurface = 'rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm shadow-fti-blue-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/10';
export const labGuardInsetSurface = 'rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/60';
export const labGuardText = 'text-slate-950 dark:text-white';
export const labGuardMutedText = 'text-slate-500 dark:text-slate-400';
export const labGuardInput = 'bg-white text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500';
