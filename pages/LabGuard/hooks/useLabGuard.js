import { useEffect, useRef, useState } from 'react';
import {
  AUX_REFRESH_MS,
  CONTROL_REFRESH_MS,
  LABGUARD_API_PREFIX,
  LABS_ONLY_ORDER_FALLBACK,
  TRAFFIC_HISTORY_LIMIT,
  TRAFFIC_SOURCE_ROUTER,
  TRAFFIC_SOURCE_SIMULATION,
} from '../constants';
import {
  addressListNameFromReference,
  buildLabsOnlyIndex,
  createTrafficPoint,
  formatBandwidthMbps,
  generateSimulationHistory,
  getCoreAuthToken,
  getSampleSource,
  isHistorySource,
  normalizeLabName,
} from '../utils';

export default function useLabGuard() {
  const [activeTab, setActiveTab] = useState('control');
  const [sessionToken, setSessionToken] = useState(() => getCoreAuthToken());
  const [routerStatus, setRouterStatus] = useState({ status: 'loading' });
  const [interfaces, setInterfaces] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState({});
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [uplinkTraffic, setUplinkTraffic] = useState({ id: 'uplink', name: 'ether2-backboneUKSW', rxRate: 0, txRate: 0, source: TRAFFIC_SOURCE_ROUTER });
  const [sitePolicies, setSitePolicies] = useState({
    blockRules: [],
    whitelistRules: [],
    blacklistResources: [],
  });
  const [sitePolicySearchQuery, setSitePolicySearchQuery] = useState('');
  const [policyAccordion, setPolicyAccordion] = useState({
    manager: true,
    whitelist: false,
    blacklist: false,
  });
  const [policyManagerType, setPolicyManagerType] = useState('blacklist');
  const [selectedPolicyList, setSelectedPolicyList] = useState('');
  const [policyEntries, setPolicyEntries] = useState([]);
  const [policyEntryDrafts, setPolicyEntryDrafts] = useState({});
  const [newPolicyEntry, setNewPolicyEntry] = useState({ address: '', comment: '', strictBlacklist: true });
  const [newPolicyList, setNewPolicyList] = useState({ name: '', type: 'blacklist', entriesText: '', strictBlacklist: true });
  const [policyManagerLoading, setPolicyManagerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionAlert, setConnectionAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyLabs, setShowOnlyLabs] = useState(true);
  const [bandwidthDrafts, setBandwidthDrafts] = useState({});
  const [labsOnlyOrder, setLabsOnlyOrder] = useState(LABS_ONLY_ORDER_FALLBACK);

  const labsOnlyOrderIndex = buildLabsOnlyIndex(labsOnlyOrder);
  const coreFetchInFlightRef = useRef(false);
  const auxFetchInFlightRef = useRef(false);

  useEffect(() => {
    const token = getCoreAuthToken();
    fetch(`${LABGUARD_API_PREFIX}/config/labs-only-order`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data.vlans) && data.vlans.length > 0) {
          setLabsOnlyOrder(data.vlans);
        }
      })
      .catch(() => {});
  }, []);

  const clearSession = () => {
    setSessionToken('');
    setError(null);
  };

  const authorizedFetch = async (input, init = {}) => {
    const token = getCoreAuthToken();
    if (!token) {
      clearSession();
      throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali.');
    }

    setSessionToken(token);
    const headers = {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Sesi login telah kedaluwarsa. Silakan masuk kembali.');
    }

    return response;
  };

  const ensureTrafficHistory = (ifaces, source = TRAFFIC_SOURCE_ROUTER) => {
    setTrafficHistory(prev => {
      const next = { ...prev };
      ifaces.forEach(iface => {
        const current = next[iface.id] || [];
        if (!current.length || !isHistorySource(current, source)) {
          next[iface.id] = source === TRAFFIC_SOURCE_SIMULATION ? generateSimulationHistory(iface) : [];
        }
      });
      return next;
    });
  };

  const appendTrafficSamples = (samples, ifaces, fallbackSource = TRAFFIC_SOURCE_ROUTER) => {
    const activeIds = new Set(ifaces.map(iface => iface.id));
    const ifaceById = new Map(ifaces.map(iface => [iface.id, iface]));
    setTrafficHistory(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, history]) => {
        if (activeIds.has(id)) next[id] = history;
      });
      ifaces.forEach(iface => {
        const current = next[iface.id] || [];
        if (!current.length || !isHistorySource(current, fallbackSource)) {
          next[iface.id] = fallbackSource === TRAFFIC_SOURCE_SIMULATION ? generateSimulationHistory(iface) : [];
        }
      });
      samples.forEach(sample => {
        if (!activeIds.has(sample.id)) return;
        const source = getSampleSource(sample, fallbackSource);
        const current = isHistorySource(next[sample.id] || [], source) ? next[sample.id] || [] : [];
        const baseline = current.length > 0 ? current : source === TRAFFIC_SOURCE_SIMULATION ? generateSimulationHistory(ifaceById.get(sample.id) || sample) : [];
        next[sample.id] = [
          ...baseline,
          createTrafficPoint(sample, source),
        ].slice(-TRAFFIC_HISTORY_LIMIT);
      });
      return next;
    });
  };

  const syncBandwidthDrafts = (ifaces) => {
    setBandwidthDrafts(prev => {
      const next = { ...prev };
      ifaces.forEach(iface => {
        if (!(iface.id in next)) {
          next[iface.id] = iface.bandwidthLimitMbps ? formatBandwidthMbps(iface.bandwidthLimitMbps) : '';
        }
      });
      return next;
    });
  };

  const applyRouterStatus = (statusData) => {
    setRouterStatus(statusData);
    if (statusData.status === 'connected') {
      const boardName = statusData.resource?.['board-name'] || 'MikroTik CCR';
      setConnectionAlert({
        type: 'success',
        title: 'Router CCR Terhubung',
        message: `Koneksi ke ${boardName} sukses! Silakan kelola akses internet mahasiswa.`,
      });
    } else if (statusData.status === 'simulated') {
      setConnectionAlert({
        type: 'warning',
        title: 'Mode Simulasi Aktif',
        message: 'Kredensial router belum aktif, dashboard masih menggunakan data simulasi.',
      });
    } else {
      setConnectionAlert({
        type: 'error',
        title: 'Koneksi Router CCR Gagal',
        message: statusData.message || 'Gagal membaca status router CCR.',
      });
    }
  };

  const fetchCoreData = async ({ silent = false } = {}) => {
    if (!sessionToken || coreFetchInFlightRef.current) return;
    coreFetchInFlightRef.current = true;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const [routerRes, ifacesRes, trafficRes, uplinkRes] = await Promise.allSettled([
        authorizedFetch(`${LABGUARD_API_PREFIX}/router/status`).then(r => r.ok ? r.json() : Promise.reject('Status API failed')),
        authorizedFetch(`${LABGUARD_API_PREFIX}/interfaces`).then(r => r.ok ? r.json() : Promise.reject('Interfaces API failed')),
        authorizedFetch(`${LABGUARD_API_PREFIX}/interfaces/traffic`).then(r => r.ok ? r.json() : Promise.reject('Traffic API failed')),
        authorizedFetch(`${LABGUARD_API_PREFIX}/router/uplink-traffic`).then(r => r.ok ? r.json() : Promise.reject('Uplink API failed')),
      ]);

      if (routerRes.status === 'fulfilled') {
        applyRouterStatus(routerRes.value);
      } else {
        setConnectionAlert({
          type: 'error',
          title: 'Koneksi Router CCR Gagal',
          message: 'Gagal menghubungi API status router CCR.',
        });
      }

      const fallbackTrafficSource = routerRes.status === 'fulfilled' && routerRes.value.status === 'simulated'
        ? TRAFFIC_SOURCE_SIMULATION
        : TRAFFIC_SOURCE_ROUTER;

      if (ifacesRes.status === 'fulfilled') {
        setInterfaces(ifacesRes.value);
        ensureTrafficHistory(ifacesRes.value, fallbackTrafficSource);
        syncBandwidthDrafts(ifacesRes.value);
        if (trafficRes.status === 'fulfilled') {
          appendTrafficSamples(trafficRes.value, ifacesRes.value, fallbackTrafficSource);
        }
      }

      if (uplinkRes.status === 'fulfilled') {
        setUplinkTraffic(uplinkRes.value);
      }

      if (ifacesRes.status === 'rejected') {
        setError('Gagal memuat daftar interface. Silakan cek koneksi router.');
      }
    } catch (err) {
      if (!silent) {
        setConnectionAlert({
          type: 'error',
          title: 'Koneksi Router CCR Gagal',
          message: 'Koneksi sistem bermasalah. Silakan coba lagi.',
        });
        setError('Koneksi sistem bermasalah. Silakan coba lagi.');
      }
    } finally {
      coreFetchInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  const fetchAuxData = async () => {
    if (!sessionToken || auxFetchInFlightRef.current) return;
    auxFetchInFlightRef.current = true;
    try {
      const [clientsRes, logsRes] = await Promise.allSettled([
        authorizedFetch(`${LABGUARD_API_PREFIX}/router/clients`).then(r => r.ok ? r.json() : Promise.reject('Clients API failed')),
        authorizedFetch(`${LABGUARD_API_PREFIX}/logs`).then(r => r.ok ? r.json() : Promise.reject('Logs API failed')),
      ]);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value);
      if (clientsRes.status === 'fulfilled') {
        const clientsData = clientsRes.value;
        const leases = clientsData.leases || [];
        const mappedClients = leases.map((l) => ({
          address: l.address,
          mac: l['mac-address'],
          hostName: l['host-name'],
          status: l.status,
          comment: l.comment,
        }));
        setClients(mappedClients);
      }
    } finally {
      auxFetchInFlightRef.current = false;
    }
  };

  const fetchSitePolicies = async () => {
    if (!sessionToken) return;
    try {
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies`);
      if (!response.ok) {
        throw new Error('Gagal memuat data site policy.');
      }
      const data = await response.json();
      setSitePolicies({
        blockRules: Array.isArray(data.blockRules) ? data.blockRules : [],
        whitelistRules: Array.isArray(data.whitelistRules) ? data.whitelistRules : [],
        blacklistResources: Array.isArray(data.blacklistResources) ? data.blacklistResources : [],
      });
    } catch (err) {
      setError(err.message || 'Gagal memuat data site policy.');
    }
  };

  const syncPolicyEntryDrafts = (entries) => {
    const drafts = {};
    entries.forEach((entry) => {
      drafts[entry.id] = {
        address: entry.address || '',
        comment: entry.comment || '',
      };
    });
    setPolicyEntryDrafts(drafts);
  };

  const fetchAddressListEntries = async (listName) => {
    if (!sessionToken || !listName) return;
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/address-list/${encodeURIComponent(listName)}`);
      if (!response.ok) {
        throw new Error(`Gagal memuat entri untuk daftar ${listName}.`);
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setPolicyEntries(entries);
      syncPolicyEntryDrafts(entries);
    } catch (err) {
      setError(err.message || 'Gagal memuat entri address-list.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const fetchData = async () => {
    await fetchCoreData();
    await fetchAuxData();
  };

  useEffect(() => {
    const savedToken = getCoreAuthToken();
    localStorage.removeItem('labguard_auth');
    localStorage.removeItem('labguard_token');
    sessionStorage.removeItem('labguard_token');
    if (savedToken) {
      setSessionToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (sessionToken) {
      fetchData();
      const coreInterval = setInterval(() => {
        fetchCoreData({ silent: true });
      }, CONTROL_REFRESH_MS);
      const auxInterval = setInterval(() => {
        fetchAuxData();
      }, AUX_REFRESH_MS);
      return () => {
        clearInterval(coreInterval);
        clearInterval(auxInterval);
      };
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken && activeTab === 'site-policy') {
      fetchSitePolicies();
      const sitePolicyInterval = setInterval(() => {
        fetchSitePolicies();
      }, AUX_REFRESH_MS);
      return () => {
        clearInterval(sitePolicyInterval);
      };
    }
  }, [activeTab, sessionToken]);

  const getPolicyListOptions = (type = policyManagerType) => {
    if (type === 'whitelist') {
      return [...new Set(sitePolicies.whitelistRules
        .flatMap((rule) => (rule.references || []).map(addressListNameFromReference))
        .filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
    }

    return [...new Set(sitePolicies.blacklistResources
      .filter((resource) => resource.type === 'address-list')
      .map((resource) => resource.name)
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  };

  useEffect(() => {
    if (activeTab !== 'site-policy') return;
    const options = getPolicyListOptions();
    if (!options.length) {
      setSelectedPolicyList('');
      setPolicyEntries([]);
      setPolicyEntryDrafts({});
      return;
    }
    if (!selectedPolicyList || !options.includes(selectedPolicyList)) {
      setSelectedPolicyList(options[0]);
    }
  }, [activeTab, policyManagerType, sitePolicies]);

  useEffect(() => {
    if (activeTab === 'site-policy' && selectedPolicyList) {
      fetchAddressListEntries(selectedPolicyList);
    }
  }, [activeTab, selectedPolicyList, sessionToken]);

  const toggleInterface = async (id, currentEnabled) => {
    try {
      setLoading(true);
      const res = await authorizedFetch(`${LABGUARD_API_PREFIX}/interfaces/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        setInterfaces(prev => prev.map(i => i.id === id ? { ...i, enabled: !currentEnabled, internetBlocked: currentEnabled } : i));
        fetchCoreData({ silent: true });
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Toggle akses internet gagal. Silakan cek koneksi router.');
      }
    } catch (err) {
      setError('Toggle akses internet gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveBandwidth = async (iface) => {
    const draft = bandwidthDrafts[iface.id] ?? '';
    const bandwidthMbps = Number(draft);
    if (!Number.isFinite(bandwidthMbps) || bandwidthMbps <= 0) {
      setError(`Bandwidth untuk ${iface.name} harus lebih dari 0 Mbps.`);
      return;
    }
    try {
      setLoading(true);
      const res = await authorizedFetch(`${LABGUARD_API_PREFIX}/interfaces/${encodeURIComponent(iface.id)}/bandwidth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bandwidthMbps }),
      });
      if (res.ok) {
        const data = await res.json();
        setInterfaces(prev => prev.map(item => (item.id === iface.id
          ? {
            ...item,
            bandwidthLimitMbps: data.bandwidthLimitMbps,
            bandwidthLimit: data.bandwidthLimit,
            bandwidthEnabled: data.bandwidthEnabled,
            queueTreeId: data.queueTreeId ?? item.queueTreeId,
            queueTreeName: data.queueTreeName ?? item.queueTreeName,
            hasQueueTree: true,
          }
          : item)));
        setBandwidthDrafts(prev => ({
          ...prev,
          [iface.id]: formatBandwidthMbps(data.bandwidthLimitMbps),
        }));
        fetchCoreData({ silent: true });
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Gagal mengubah bandwidth ${iface.name}.`);
      }
    } catch (err) {
      setError(`Gagal mengubah bandwidth ${iface.name}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredInterfaces = interfaces
    .filter(iface => {
      const matchesSearch = iface.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (iface.comment && iface.comment.toLowerCase().includes(searchQuery.toLowerCase()));
      const isLab = (item) => {
        const normalizedName = normalizeLabName(item.name);
        const comment = (item.comment || '').toLowerCase();
        return labsOnlyOrderIndex.has(normalizedName) ||
          normalizedName.includes('lab') ||
          normalizedName.includes('vlan') ||
          normalizedName.startsWith('4') ||
          comment.includes('lab');
      };
      if (showOnlyLabs) return isLab(iface) && matchesSearch;
      return matchesSearch;
    })
    .sort((left, right) => {
      if (!showOnlyLabs) return 0;
      const leftIndex = labsOnlyOrderIndex.get(normalizeLabName(left.name));
      const rightIndex = labsOnlyOrderIndex.get(normalizeLabName(right.name));
      if (leftIndex !== undefined && rightIndex !== undefined) {
        return leftIndex - rightIndex;
      }
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
    });

  const handleRefresh = () => {
    if (activeTab === 'site-policy') {
      fetchSitePolicies();
      if (selectedPolicyList) {
        fetchAddressListEntries(selectedPolicyList);
      }
      return;
    }
    fetchData();
  };

  const addPolicyEntry = async () => {
    if (!selectedPolicyList) {
      setError('Pilih address-list dulu sebelum menambah target baru.');
      return;
    }
    if (!newPolicyEntry.address.trim()) {
      setError('Target address/host wajib diisi.');
      return;
    }
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/address-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listName: selectedPolicyList,
          address: newPolicyEntry.address.trim(),
          comment: newPolicyEntry.comment.trim(),
          strictBlacklist: Boolean(newPolicyEntry.strictBlacklist),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menambah target baru.');
      }
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setPolicyEntries(entries);
      syncPolicyEntryDrafts(entries);
      setNewPolicyEntry((prev) => ({ address: '', comment: '', strictBlacklist: prev.strictBlacklist }));
      fetchSitePolicies();
    } catch (err) {
      setError(err.message || 'Gagal menambah target baru.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const savePolicyEntry = async (entry) => {
    const draft = policyEntryDrafts[entry.id] || { address: entry.address || '', comment: entry.comment || '' };
    if (!draft.address.trim()) {
      setError('Target address/host tidak boleh kosong.');
      return;
    }
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/address-list/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listName: selectedPolicyList,
          address: draft.address.trim(),
          comment: draft.comment.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menyimpan perubahan entry.');
      }
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setPolicyEntries(entries);
      syncPolicyEntryDrafts(entries);
      fetchSitePolicies();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan perubahan entry.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const togglePolicyEntry = async (entry) => {
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/address-list/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listName: selectedPolicyList,
          disabled: !entry.disabled,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal mengubah status entry.');
      }
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setPolicyEntries(entries);
      syncPolicyEntryDrafts(entries);
      fetchSitePolicies();
    } catch (err) {
      setError(err.message || 'Gagal mengubah status entry.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const deletePolicyEntry = async (entry) => {
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/address-list/${encodeURIComponent(entry.id)}?listName=${encodeURIComponent(selectedPolicyList)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listName: selectedPolicyList,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menghapus entry.');
      }
      const entries = Array.isArray(data.entries) ? data.entries : [];
      setPolicyEntries(entries);
      syncPolicyEntryDrafts(entries);
      fetchSitePolicies();
    } catch (err) {
      setError(err.message || 'Gagal menghapus entry.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const handleCreatePolicyList = async () => {
    const listName = newPolicyList.name.trim();
    const type = newPolicyList.type;
    if (!listName) {
      setError('Nama list wajib diisi.');
      return;
    }
    const initialEntries = newPolicyList.entriesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/create-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName, type, initialEntries, strictBlacklist: Boolean(newPolicyList.strictBlacklist) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal membuat list baru.');
      }
      setNewPolicyList((prev) => ({ name: '', type: 'blacklist', entriesText: '', strictBlacklist: prev.strictBlacklist }));
      await fetchSitePolicies();
      setPolicyManagerType(type);
      setTimeout(() => setSelectedPolicyList(listName), 100);
    } catch (err) {
      setError(err.message || 'Gagal membuat list baru.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const handleDeletePolicyList = async () => {
    if (!selectedPolicyList) {
      setError('Pilih daftar alamat (address-list) yang ingin dihapus terlebih dahulu.');
      return;
    }
    const confirmed = window.confirm(
      `Hapus list "${selectedPolicyList}" beserta semua entry dan firewall rule-nya?`
    );
    if (!confirmed) return;
    try {
      setPolicyManagerLoading(true);
      const response = await authorizedFetch(`${LABGUARD_API_PREFIX}/site-policies/delete-list`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName: selectedPolicyList, type: policyManagerType }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal menghapus list.');
      }
      setSelectedPolicyList('');
      setPolicyEntries([]);
      setPolicyEntryDrafts({});
      await fetchSitePolicies();
    } catch (err) {
      setError(err.message || 'Gagal menghapus list.');
    } finally {
      setPolicyManagerLoading(false);
    }
  };

  const normalizedSitePolicySearch = sitePolicySearchQuery.trim().toLowerCase();
  const filteredWhitelistRules = sitePolicies.whitelistRules.filter((rule) => {
    if (!normalizedSitePolicySearch) return true;
    const haystack = [
      rule.name,
      rule.source,
      rule.matcher,
      ...(rule.references || []),
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedSitePolicySearch);
  });
  const filteredBlacklistResources = sitePolicies.blacklistResources.filter((resource) => {
    if (!normalizedSitePolicySearch) return true;
    const haystack = [
      resource.name,
      resource.type,
      ...(resource.sampleTargets || []),
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedSitePolicySearch);
  });
  const filteredPolicyEntries = policyEntries.filter((entry) => {
    if (!normalizedSitePolicySearch) return true;
    const haystack = [
      entry.id,
      entry.list,
      entry.address,
      entry.comment,
      entry.disabled ? 'disabled' : 'active',
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedSitePolicySearch);
  });

  const togglePolicyAccordion = (section) => {
    setPolicyAccordion((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return {
    activeTab,
    setActiveTab,
    routerStatus,
    trafficHistory,
    clients,
    logs,
    uplinkTraffic,
    sitePolicySearchQuery,
    setSitePolicySearchQuery,
    policyAccordion,
    policyManagerType,
    setPolicyManagerType,
    selectedPolicyList,
    setSelectedPolicyList,
    policyEntryDrafts,
    setPolicyEntryDrafts,
    newPolicyEntry,
    setNewPolicyEntry,
    newPolicyList,
    setNewPolicyList,
    policyManagerLoading,
    loading,
    error,
    connectionAlert,
    searchQuery,
    setSearchQuery,
    showOnlyLabs,
    setShowOnlyLabs,
    bandwidthDrafts,
    setBandwidthDrafts,
    filteredInterfaces,
    availablePolicyLists: getPolicyListOptions(),
    filteredWhitelistRules,
    filteredBlacklistResources,
    filteredPolicyEntries,
    handleRefresh,
    fetchAddressListEntries,
    toggleInterface,
    saveBandwidth,
    addPolicyEntry,
    savePolicyEntry,
    togglePolicyEntry,
    deletePolicyEntry,
    handleCreatePolicyList,
    handleDeletePolicyList,
    togglePolicyAccordion,
  };
}
