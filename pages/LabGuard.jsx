import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, ShieldCheck, RefreshCcw, Activity, Settings as SettingsIcon, AlertCircle, Layers, Search, CheckCircle2, XCircle, Unlock, Lock, LogIn, ShieldAlert, ChevronDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import { Tabs } from '../components/ui/tabs';
import { PageTabs } from '../components/ui/page-tabs';

const stripMotionProps = ({ initial, animate, exit, transition, layout, ...props }) => props;
const motion = {
    div: (props) => <div {...stripMotionProps(props)} />,
    p: (props) => <p {...stripMotionProps(props)} />,
};
const AnimatePresence = ({ children }) => <>{children}</>;
const LABGUARD_API_PREFIX = `${API_BASE_URL}/api/labguard`;
const getCoreAuthToken = () => sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || '';
// Simulated traffic data generator
const generateHistory = () => {
    return Array.from({ length: 20 }, (_, i) => ({
        time: i,
        download: Math.floor(Math.random() * 100),
        upload: Math.floor(Math.random() * 30),
    }));
};
const formatBandwidthMbps = (value) => {
    if (value === undefined || value === null || Number.isNaN(value))
        return '--';
    const normalized = Number(value);
    return Number.isInteger(normalized) ? `${normalized}` : normalized.toFixed(2).replace(/\.?0+$/, '');
};
const CONTROL_REFRESH_MS = 3000;
const AUX_REFRESH_MS = 20000;
const formatRateMbps = (value) => {
    const normalized = Number(value || 0);
    return normalized >= 1_000_000
        ? `${(normalized / 1_000_000).toFixed(1).replace(/\.0$/, '')} Mbps`
        : `${(normalized / 1_000).toFixed(0)} Kbps`;
};
function UplinkTrafficCard({ uplinkTraffic }) {
    return (<div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-4 sm:p-5 border border-gray-100 dark:border-white/5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Activity size={18}/>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Backbone Uplink (Total Bandwidth Terpakai)</p>
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-white truncate">{uplinkTraffic?.name || 'ether2-backboneUKSW'}</h3>
            </div>
          </div>
        </div>
        <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10 shrink-0">
          Live
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Download</p>
          <p className="text-lg font-bold tracking-tight text-white mt-1">{formatRateMbps(uplinkTraffic?.rxRate)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] px-4 py-3">
          <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Upload</p>
          <p className="text-lg font-bold tracking-tight text-white mt-1">{formatRateMbps(uplinkTraffic?.txRate)}</p>
        </div>
      </div>
    </div>);
}
function SitePolicySection({ title, subtitle, emptyLabel, items, renderItem, hideHeader = false }) {
    return (<div className="space-y-4">
      {!hideHeader && (<div className="flex items-center justify-between gap-3 px-1 sm:px-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">{title}</h3>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 mt-1">{subtitle}</p>
          </div>
          <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10 shrink-0">
            {items.length} Aturan
          </div>
        </div>)}
      {items.length > 0 ? (<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.map(renderItem)}
        </div>) : (<div className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-dashed border-gray-200 dark:border-white/10 px-5 py-10 text-center text-gray-400">
          <p className="text-[10px] font-bold uppercase tracking-wider">{emptyLabel}</p>
        </div>)}
    </div>);
}
const LABS_ONLY_ORDER_FALLBACK = [
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
const normalizeLabName = (value) => value.toLowerCase().replace(/\s+/g, '');
const addressListNameFromReference = (reference) => reference.startsWith('Address List: ') ? reference.replace('Address List: ', '') : '';
const buildLabsOnlyIndex = (order) => new Map(order.map((name, index) => [normalizeLabName(name), index]));
const connectionAlertStyles = {
    success: {
        container: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400',
        icon: 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400',
        iconNode: _jsx(CheckCircle2, { size: 20 }),
    },
    error: {
        container: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400',
        icon: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
        iconNode: _jsx(XCircle, { size: 20 }),
    },
    warning: {
        container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400',
        icon: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
        iconNode: _jsx(AlertCircle, { size: 20 }),
    },
};
export default function App() {
    const labGuardTabs = [
        { value: 'control', label: 'Kontrol Akses', icon: SettingsIcon },
        { value: 'monitoring', label: 'Pemantauan Trafik', icon: Activity },
        { value: 'site-policy', label: 'Kebijakan Akses', icon: ShieldAlert },
    ];
    const [activeTab, setActiveTab] = useState('control');
    const [sessionToken, setSessionToken] = useState(() => getCoreAuthToken());
    const [routerStatus, setRouterStatus] = useState({ status: 'loading' });
    const [interfaces, setInterfaces] = useState([]);
    const [trafficHistory, setTrafficHistory] = useState({});
    const [clients, setClients] = useState([]);
    const [logs, setLogs] = useState([]);
    const [uplinkTraffic, setUplinkTraffic] = useState({ id: 'uplink', name: 'ether2-backboneUKSW', rxRate: 0, txRate: 0 });
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
            .catch(() => { /* keep fallback */ });
    }, []);
    useEffect(() => {
        const hadRootDark = document.documentElement.classList.contains('dark');
        const hadBodyDark = document.body.classList.contains('dark');
        const previousColorScheme = document.documentElement.style.colorScheme;
        const previousBodyBackground = document.body.style.backgroundColor;
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
        document.body.style.backgroundColor = '#0A0A0B';
        return () => {
            document.documentElement.classList.toggle('dark', hadRootDark);
            document.body.classList.toggle('dark', hadBodyDark);
            document.documentElement.style.colorScheme = previousColorScheme;
            document.body.style.backgroundColor = previousBodyBackground;
        };
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
    const ensureTrafficHistory = (ifaces) => {
        setTrafficHistory(prev => {
            const next = { ...prev };
            ifaces.forEach(iface => {
                if (!next[iface.id]) {
                    next[iface.id] = generateHistory();
                }
            });
            return next;
        });
    };
    const appendTrafficSamples = (samples, ifaces) => {
        const activeIds = new Set(ifaces.map(iface => iface.id));
        setTrafficHistory(prev => {
            const next = {};
            Object.entries(prev).forEach(([id, history]) => {
                if (activeIds.has(id))
                    next[id] = history;
            });
            ifaces.forEach(iface => {
                if (!next[iface.id])
                    next[iface.id] = generateHistory();
            });
            samples.forEach(sample => {
                const current = next[sample.id] || [];
                next[sample.id] = [
                    ...current,
                    {
                        time: Date.now(),
                        download: Math.round((sample.rxRate || 0) / 1024),
                        upload: Math.round((sample.txRate || 0) / 1024),
                    },
                ].slice(-20);
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
        }
        else if (statusData.status === 'simulated') {
            setConnectionAlert({
                type: 'warning',
                title: 'Mode Simulasi Aktif',
                message: 'Kredensial router belum aktif, dashboard masih menggunakan data simulasi.',
            });
        }
        else {
            setConnectionAlert({
                type: 'error',
                title: 'Koneksi Router CCR Gagal',
                message: statusData.message || 'Gagal membaca status router CCR.',
            });
        }
    };
    const fetchCoreData = async ({ silent = false } = {}) => {
        if (!sessionToken || coreFetchInFlightRef.current)
            return;
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
                authorizedFetch(`${LABGUARD_API_PREFIX}/router/uplink-traffic`).then(r => r.ok ? r.json() : Promise.reject('Uplink API failed'))
            ]);
            if (routerRes.status === 'fulfilled') {
                applyRouterStatus(routerRes.value);
            }
            else {
                setConnectionAlert({
                    type: 'error',
                    title: 'Koneksi Router CCR Gagal',
                    message: 'Gagal menghubungi API status router CCR.',
                });
            }
            if (ifacesRes.status === 'fulfilled') {
                setInterfaces(ifacesRes.value);
                ensureTrafficHistory(ifacesRes.value);
                syncBandwidthDrafts(ifacesRes.value);
                if (trafficRes.status === 'fulfilled') {
                    appendTrafficSamples(trafficRes.value, ifacesRes.value);
                }
            }
            if (uplinkRes.status === 'fulfilled') {
                setUplinkTraffic(uplinkRes.value);
            }
            if (ifacesRes.status === 'rejected') {
                setError('Gagal memuat daftar interface. Silakan cek koneksi router.');
            }
        }
        catch (err) {
            if (!silent) {
                setConnectionAlert({
                    type: 'error',
                    title: 'Koneksi Router CCR Gagal',
                    message: 'Koneksi sistem bermasalah. Silakan coba lagi.',
                });
                setError('Koneksi sistem bermasalah. Silakan coba lagi.');
            }
        }
        finally {
            coreFetchInFlightRef.current = false;
            if (!silent) {
                setLoading(false);
            }
        }
    };
    const fetchAuxData = async () => {
        if (!sessionToken || auxFetchInFlightRef.current)
            return;
        auxFetchInFlightRef.current = true;
        try {
            const [clientsRes, logsRes] = await Promise.allSettled([
                authorizedFetch(`${LABGUARD_API_PREFIX}/router/clients`).then(r => r.ok ? r.json() : Promise.reject('Clients API failed')),
                authorizedFetch(`${LABGUARD_API_PREFIX}/logs`).then(r => r.ok ? r.json() : Promise.reject('Logs API failed'))
            ]);
            if (logsRes.status === 'fulfilled')
                setLogs(logsRes.value);
            if (clientsRes.status === 'fulfilled') {
                const clientsData = clientsRes.value;
                const leases = clientsData.leases || [];
                const mappedClients = leases.map((l) => ({
                    address: l.address,
                    mac: l['mac-address'],
                    hostName: l['host-name'],
                    status: l.status,
                    comment: l.comment
                }));
                setClients(mappedClients);
            }
        }
        finally {
            auxFetchInFlightRef.current = false;
        }
    };
    const fetchSitePolicies = async () => {
        if (!sessionToken)
            return;
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
        }
        catch (err) {
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
        if (!sessionToken || !listName)
            return;
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
        }
        catch (err) {
            setError(err.message || 'Gagal memuat entri address-list.');
        }
        finally {
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
        if (activeTab !== 'site-policy')
            return;
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
                body: JSON.stringify({ enabled: !currentEnabled })
            });
            if (res.ok) {
                setInterfaces(prev => prev.map(i => i.id === id ? { ...i, enabled: !currentEnabled, internetBlocked: currentEnabled } : i));
                fetchCoreData({ silent: true });
            }
            else {
                const data = await res.json().catch(() => null);
                setError(data?.error || 'Toggle akses internet gagal. Silakan cek koneksi router.');
            }
        }
        catch (err) {
            setError('Toggle akses internet gagal: ' + err.message);
        }
        finally {
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
            }
            else {
                const data = await res.json().catch(() => null);
                setError(data?.error || `Gagal mengubah bandwidth ${iface.name}.`);
            }
        }
        catch (err) {
            setError(`Gagal mengubah bandwidth ${iface.name}: ${err.message}`);
        }
        finally {
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
        if (showOnlyLabs)
            return isLab(iface) && matchesSearch;
        return matchesSearch;
    })
        .sort((left, right) => {
        if (!showOnlyLabs)
            return 0;
        const leftIndex = labsOnlyOrderIndex.get(normalizeLabName(left.name));
        const rightIndex = labsOnlyOrderIndex.get(normalizeLabName(right.name));
        if (leftIndex !== undefined && rightIndex !== undefined) {
            return leftIndex - rightIndex;
        }
        if (leftIndex !== undefined)
            return -1;
        if (rightIndex !== undefined)
            return 1;
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
        }
        catch (err) {
            setError(err.message || 'Gagal menambah target baru.');
        }
        finally {
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
        }
        catch (err) {
            setError(err.message || 'Gagal menyimpan perubahan entry.');
        }
        finally {
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
        }
        catch (err) {
            setError(err.message || 'Gagal mengubah status entry.');
        }
        finally {
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
        }
        catch (err) {
            setError(err.message || 'Gagal menghapus entry.');
        }
        finally {
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
        }
        catch (err) {
            setError(err.message || 'Gagal membuat list baru.');
        }
        finally {
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
        }
        catch (err) {
            setError(err.message || 'Gagal menghapus list.');
        }
        finally {
            setPolicyManagerLoading(false);
        }
    };
    const renderPolicyReferences = (rule) => ((rule.references || []).length > 0 ? (rule.references.map((reference) => (<span key={`${rule.id}-${reference}`} className="px-2 py-1 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[8px] font-bold uppercase tracking-wide text-gray-300">
          {reference}
        </span>))) : (<span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Tidak Ada Daftar Terkait</span>));
    const renderSampleTargets = (resource) => ((resource.sampleTargets || []).length > 0 ? (resource.sampleTargets.map((target) => (<span key={`${resource.id}-${target}`} className="px-2 py-1 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[8px] font-bold uppercase tracking-wide text-gray-300">
          {target}
        </span>))) : (<span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Tidak Ada Contoh Target</span>));
    const availablePolicyLists = getPolicyListOptions();
    const normalizedSitePolicySearch = sitePolicySearchQuery.trim().toLowerCase();
    const filteredWhitelistRules = sitePolicies.whitelistRules.filter((rule) => {
        if (!normalizedSitePolicySearch)
            return true;
        const haystack = [
            rule.name,
            rule.source,
            rule.matcher,
            ...(rule.references || []),
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedSitePolicySearch);
    });
    const filteredBlacklistResources = sitePolicies.blacklistResources.filter((resource) => {
        if (!normalizedSitePolicySearch)
            return true;
        const haystack = [
            resource.name,
            resource.type,
            ...(resource.sampleTargets || []),
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedSitePolicySearch);
    });
    const filteredPolicyEntries = policyEntries.filter((entry) => {
        if (!normalizedSitePolicySearch)
            return true;
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
    return (<div className="space-y-6 sm:space-y-8 text-[#F2F2F7] font-sans selection:bg-blue-600 selection:text-white pb-6 transition-colors duration-500">
      <PageHeader
        title="LabGuard FTI UKSW"
        description="Sistem Keamanan Jaringan dan Kontrol Akses MikroTik Laboratorium."
        actions={(
          <button onClick={handleRefresh} className="flex items-center justify-center p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-sm">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        )}
      />

        {error && (<div className="mb-6 sm:mb-10 bg-red-950/20 border border-red-900/30 p-4 sm:p-6 rounded-xl flex items-center gap-3 sm:gap-4 text-red-400">
            <AlertCircle size={20} className="shrink-0"/>
            <div className="flex-grow">
              <p className="text-xs font-bold uppercase tracking-wider leading-none mb-1">Kesalahan Sistem</p>
              <p className="text-xs font-semibold opacity-95">
                {error === 'Gagal memuat daftar interface. Silakan cek koneksi router.'
                  ? 'Gagal memuat daftar interface. Silakan cek koneksi router.'
                  : error === 'System connection error. Please try again.'
                    ? 'Koneksi sistem bermasalah. Silakan coba lagi.'
                    : error}
              </p>
            </div>
            <button onClick={handleRefresh} className="hidden sm:block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-lg">
              Coba Lagi
            </button>
          </div>)}

        <div className="space-y-6 sm:space-y-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="flex w-full flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 print:hidden">
              <PageTabs items={labGuardTabs} />
              
              {connectionAlert && (
                <button
                  onClick={handleRefresh}
                  title="Klik untuk memeriksa ulang koneksi router CCR"
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg border transition-all duration-300 active:scale-95 cursor-pointer sm:w-fit justify-center ${
                    connectionAlert.type === 'success'
                      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/25 hover:bg-green-100/50 dark:hover:bg-green-500/20'
                      : connectionAlert.type === 'warning'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 hover:bg-amber-100/50 dark:hover:bg-amber-500/20'
                        : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 hover:bg-rose-100/50 dark:hover:bg-rose-500/20'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    connectionAlert.type === 'success'
                      ? 'bg-green-500 animate-pulse'
                      : connectionAlert.type === 'warning'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-rose-500'
                  }`} />
                  {connectionAlert.type === 'success' 
                    ? `CCR Terhubung : ${routerStatus.resource?.['board-name'] || 'MikroTik CCR'}`
                    : connectionAlert.type === 'warning'
                      ? 'CCR: Mode Simulasi'
                      : 'Koneksi CCR Gagal'}
                </button>
              )}
            </div>

          <AnimatePresence mode="wait">
            {activeTab === 'monitoring' ? (<motion.div key="monitoring" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-10">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 px-1 sm:px-4">
                    <div className="space-y-1">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase dark:text-white leading-tight">Pemantauan Trafik Real-time</h2>
                      <p className="text-gray-400 dark:text-gray-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Throughput Antarmuka Jaringan</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative group w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input type="text" placeholder="Cari Antarmuka..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 rounded-xl text-xs font-bold dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"/>
                      </div>
                      <button onClick={() => setShowOnlyLabs(!showOnlyLabs)} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-bold tracking-wider transition-all border ${showOnlyLabs
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                              : 'bg-white dark:bg-white/5 border-zinc-800 text-gray-400'}`}>
                        {showOnlyLabs ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                        Hanya Lab
                      </button>
                    </div>
                  </div>
                  <UplinkTrafficCard uplinkTraffic={uplinkTraffic}/>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredInterfaces.length > 0 ? (filteredInterfaces.map((iface, idx) => (<motion.div key={iface.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: idx * 0.01 }} className="bg-white dark:bg-[#1C1C1E] rounded-xl p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:border-blue-500/30 transition-all group flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-inner ${iface.enabled ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'}`}>
                                {iface.enabled ? <Unlock size={18}/> : <Lock size={18}/>}
                              </div>
                              <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border transition-colors ${iface.enabled
                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30'}`}>
                                {iface.enabled ? 'Aktif' : 'Nonaktif'}
                              </div>
                            </div>
                            <div className="space-y-0.5 mb-4 flex-grow">
                              <h4 className="text-sm font-bold tracking-tight uppercase line-clamp-1 dark:text-white">{iface.name}</h4>
                              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider truncate">{iface.comment || 'Antarmuka VLAN'}</p>
                            </div>
                            <div className="h-12 w-full mt-auto bg-gray-50/50 dark:bg-white/5 rounded-lg overflow-hidden border border-gray-100 dark:border-white/5 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 transition-colors">
                              {iface.enabled ? (<ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={trafficHistory[iface.id] || []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                      <linearGradient id={`color-${iface.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill={`url(#color-${iface.id})`}/>
                                  </AreaChart>
                                </ResponsiveContainer>) : (<div className="h-full w-full flex items-center justify-center opacity-10 grayscale">
                                  <WifiOff size={14}/>
                                </div>)}
                            </div>
                          </motion.div>))) : (<div className="col-span-full py-12 sm:py-16 flex flex-col items-center justify-center text-gray-400 bg-white dark:bg-[#1C1C1E] rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                          <Search size={28} className="mb-3 opacity-20"/>
                          <p className="text-[9px] font-bold uppercase tracking-wider">Antarmuka Tidak Ditemukan</p>
                        </div>)}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>) : activeTab === 'site-policy' ? (<motion.div key="site-policy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-8">
                <div className="space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-3 px-1 sm:px-4">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full shrink-0"/>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-400">Kebijakan Akses Situs</h2>
                  </div>
                  <div className="px-1 sm:px-2">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                      <input type="text" value={sitePolicySearchQuery} onChange={(e) => setSitePolicySearchQuery(e.target.value)} placeholder="Cari aturan, nama daftar, atau target..." className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 rounded-xl text-xs font-bold dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"/>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button onClick={() => togglePolicyAccordion('manager')} className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm text-left">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">Manajer Daftar Kebijakan</h3>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Kelola daftar pengecualian (whitelist) dan pemblokiran (blacklist) berbasis Address List pada router.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="px-2 py-0.5 rounded text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10">
                          {filteredPolicyEntries.length} Entri
                        </div>
                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${policyAccordion.manager ? 'rotate-180' : ''}`}/>
                      </div>
                    </button>

                    {policyAccordion.manager && (<div className="bg-white dark:bg-[#1C1C1E] rounded-xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
                        <div className="rounded-xl border border-dashed border-blue-500/30 bg-blue-500/[0.03] p-4 space-y-3">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-blue-400">Buat Daftar Baru</p>
                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-3">
                            <input type="text" value={newPolicyList.name} onChange={(e) => setNewPolicyList((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nama list baru (cth: gaming, streaming)" className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-2xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            <select value={newPolicyList.type} onChange={(e) => setNewPolicyList((prev) => ({ ...prev, type: e.target.value }))} className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-2xl text-[11px] font-bold uppercase tracking-wide text-white outline-none focus:ring-2 focus:ring-blue-500/20">
                              <option value="blacklist">Daftar Hitam</option>
                              <option value="whitelist">Daftar Putih</option>
                            </select>
                          </div>
                          <textarea value={newPolicyList.entriesText} onChange={(e) => setNewPolicyList((prev) => ({ ...prev, entriesText: e.target.value }))} placeholder="Initial entries (opsional, satu per baris)&#10;cth:&#10;steam.com&#10;epicgames.com" rows={3} className="w-full px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-2xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"/>
                          {newPolicyList.type === 'blacklist' && (<label className="flex items-center gap-3 px-1 cursor-pointer group">
                              <input type="checkbox" checked={newPolicyList.strictBlacklist} onChange={(e) => setNewPolicyList((prev) => ({ ...prev, strictBlacklist: e.target.checked }))} className="w-4 h-4 rounded border-white/10 bg-[#141416] text-blue-600 focus:ring-blue-500/20"/>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Blokir Ketat Situs Web (TLS Host)</span>
                            </label>)}
                          <button onClick={handleCreatePolicyList} disabled={policyManagerLoading || !newPolicyList.name.trim()} className="px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                            Buat Daftar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto_auto] gap-3">
                          <select value={policyManagerType} onChange={(e) => setPolicyManagerType(e.target.value)} className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="blacklist">Daftar Hitam</option>
                            <option value="whitelist">Daftar Putih</option>
                          </select>
                          <select value={selectedPolicyList} onChange={(e) => setSelectedPolicyList(e.target.value)} disabled={!availablePolicyLists.length} className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold uppercase tracking-wide text-white outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40">
                            {availablePolicyLists.length > 0 ? (availablePolicyLists.map((listName) => (<option key={listName} value={listName}>{listName}</option>))) : (<option value="">Tidak Ada Daftar Alamat</option>)}
                          </select>
                          <button onClick={() => selectedPolicyList && fetchAddressListEntries(selectedPolicyList)} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                            Muat Ulang
                          </button>
                          <button onClick={handleDeletePolicyList} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-40">
                            Hapus Daftar
                          </button>
                        </div>

                        <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Tambah Target Baru</p>
                            <span className="text-[8px] font-bold uppercase tracking-wide text-gray-500">Daftar: {selectedPolicyList || '--'}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3">
                            <input type="text" value={newPolicyEntry.address} onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, address: e.target.value }))} placeholder="Alamat host / target" disabled={!selectedPolicyList} className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40"/>
                            <input type="text" value={newPolicyEntry.comment} onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, comment: e.target.value }))} placeholder="Keterangan (opsional)" disabled={!selectedPolicyList} className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40"/>
                            <button onClick={addPolicyEntry} disabled={!selectedPolicyList || policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-40">
                              Tambah
                            </button>
                          </div>
                          {policyManagerType === 'blacklist' && (<label className="flex items-center gap-3 px-1 cursor-pointer group">
                              <input type="checkbox" checked={newPolicyEntry.strictBlacklist} onChange={(e) => setNewPolicyEntry((prev) => ({ ...prev, strictBlacklist: e.target.checked }))} disabled={!selectedPolicyList} className="w-4 h-4 rounded border-white/10 bg-[#141416] text-blue-600 focus:ring-blue-500/20 disabled:opacity-40"/>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Blokir Ketat Situs Web (TLS Host)</span>
                            </label>)}
                          <p className="text-[9px] font-bold text-gray-500">
                            Untuk domain web, sistem otomatis menambahkan host root dan versi www jika relevan. Saat mode strict aktif, sistem juga menambah rule TLS host supaya block lebih susah lolos.
                          </p>
                        </div>

                        {selectedPolicyList ? (<div className="space-y-3">
                            {filteredPolicyEntries.length > 0 ? (filteredPolicyEntries.map((entry) => (<div key={entry.id} className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] p-4 space-y-3">
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">ID Entri</p>
                                      <p className="text-[10px] font-bold text-gray-300 break-all">{entry.id}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${entry.disabled ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'}`}>
                                      {entry.disabled ? 'Nonaktif' : 'Aktif'}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input type="text" value={policyEntryDrafts[entry.id]?.address ?? ''} onChange={(e) => setPolicyEntryDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], address: e.target.value } }))} placeholder="Alamat host / target" className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    <input type="text" value={policyEntryDrafts[entry.id]?.comment ?? ''} onChange={(e) => setPolicyEntryDrafts((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], comment: e.target.value } }))} placeholder="Keterangan" className="px-4 py-3 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={() => savePolicyEntry(entry)} disabled={policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40">
                                      Simpan Entri
                                    </button>
                                    <button onClick={() => togglePolicyEntry(entry)} disabled={policyManagerLoading} className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md transition-all disabled:opacity-40 ${entry.disabled
                                             ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                             : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                                      {entry.disabled ? 'Aktifkan Entri' : 'Nonaktifkan Entri'}
                                    </button>
                                    <button onClick={() => deletePolicyEntry(entry)} disabled={policyManagerLoading} className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-40">
                                      Hapus Entri
                                    </button>
                                  </div>
                                </div>))) : (<div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 px-5 py-10 text-center text-gray-400">
                              <p className="text-[10px] font-bold uppercase tracking-wider">{policyManagerLoading ? 'Memuat Entri...' : 'Tidak Ditemukan Entri yang Cocok'}</p>
                            </div>)}
                          </div>) : (<div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 px-5 py-10 text-center text-gray-400">
                          <p className="text-[10px] font-bold uppercase tracking-wider">Belum ada daftar alamat yang tersedia untuk dikelola</p>
                        </div>)}
                      </div>)}
                  </div>

                  <div className="space-y-4">
                    <button onClick={() => togglePolicyAccordion('whitelist')} className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white dark:bg-[#1C1C1E] rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-left">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">Aturan Whitelist</h3>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Rule accept yang menjadi pengecualian akses untuk domain atau layanan tertentu.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10">
                          {filteredWhitelistRules.length} Aturan
                        </div>
                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${policyAccordion.whitelist ? 'rotate-180' : ''}`}/>
                      </div>
                    </button>

                    {policyAccordion.whitelist && (<SitePolicySection title="Aturan Whitelist" subtitle="Rule accept yang menjadi pengecualian akses untuk domain atau layanan tertentu." emptyLabel="Belum ada aturan whitelist yang terdeteksi" items={filteredWhitelistRules} hideHeader={true} renderItem={(rule) => (<div key={rule.id} className="bg-white dark:bg-[#1C1C1E] rounded-xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold uppercase tracking-tight text-white">{rule.name}</h4>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-1">{rule.source}</p>
                              </div>
                              <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${rule.status === 'active' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                                {rule.status === 'active' ? 'Aktif' : 'Nonaktif'}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Pencocokan</p>
                              <p className="text-[11px] font-bold text-gray-200 break-words">{rule.matcher || '--'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">{renderPolicyReferences(rule)}</div>
                          </div>)}/>)}
                  </div>

                  <div className="space-y-4">
                    <button onClick={() => togglePolicyAccordion('blacklist')} className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white dark:bg-[#1C1C1E] rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-left">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">Sumber Blacklist</h3>
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">Sumber data yang digunakan router untuk memblokir situs, termasuk address-list dan layer7.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="px-2 py-1 rounded-md text-[8px] font-bold uppercase border border-blue-500/20 text-blue-400 bg-blue-500/10">
                          {filteredBlacklistResources.length} Aturan
                        </div>
                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${policyAccordion.blacklist ? 'rotate-180' : ''}`}/>
                      </div>
                    </button>

                    {policyAccordion.blacklist && (<SitePolicySection title="Sumber Blacklist" subtitle="Sumber data yang digunakan router untuk memblokir situs, termasuk address-list dan layer7." emptyLabel="Belum ada sumber blacklist yang terdeteksi" items={filteredBlacklistResources} hideHeader={true} renderItem={(resource) => (<div key={resource.id} className="bg-white dark:bg-[#1C1C1E] rounded-xl p-5 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold uppercase tracking-tight text-white">{resource.name}</h4>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-1">{resource.type}</p>
                              </div>
                              <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase border shrink-0 ${resource.status === 'active' ? 'border-blue-500/20 text-blue-400 bg-blue-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                                {resource.status === 'active' ? 'Aktif' : 'Nonaktif'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] px-4 py-3">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Jumlah Entri</p>
                                <p className="text-lg font-bold tracking-tight text-white mt-1">{resource.totalEntries ?? '--'}</p>
                              </div>
                              <div className="rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] px-4 py-3">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Tipe</p>
                                <p className="text-sm font-bold tracking-tight text-white mt-1 uppercase">{resource.type || '--'}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Contoh Target</p>
                              <div className="flex flex-wrap gap-2">{renderSampleTargets(resource)}</div>
                            </div>
                          </div>)}/>)}
                  </div>
                </div>
              </motion.div>) : (<motion.div key="control" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6 sm:space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 px-1 sm:px-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase dark:text-white leading-tight">Kontrol Akses Internet Laboratorium</h2>
                    <p className="text-gray-400 dark:text-gray-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Panel Kontrol Utama</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group w-full sm:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                      <input type="text" placeholder="Cari Lab / VLAN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 rounded-xl text-xs font-bold dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"/>
                    </div>
                    <button onClick={() => setShowOnlyLabs(!showOnlyLabs)} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all border ${showOnlyLabs
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                            : 'bg-white dark:bg-white/5 border-zinc-800 text-gray-400'}`}>
                      {showOnlyLabs ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                      Hanya Lab
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredInterfaces.map((iface, idx) => (<motion.div key={iface.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ delay: idx * 0.01 }} className="bg-white dark:bg-[#1C1C1E] rounded-xl p-5 border border-gray-100 dark:border-white/5 shadow-sm hover:border-blue-500/30 transition-all flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iface.enabled ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'}`}>
                              <Layers size={18}/>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <h3 className="text-sm font-bold uppercase tracking-tight dark:text-white truncate max-w-[120px]">{iface.name}</h3>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${iface.running ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}/>
                                <span className="text-[8px] font-bold uppercase text-gray-400 tracking-wider">{iface.running ? 'Aktif' : 'Idle'}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border shrink-0 ${iface.enabled ? 'border-blue-500/20 text-blue-500 bg-blue-500/10' : 'border-red-500/20 text-red-500 bg-red-500/10'}`}>
                            {iface.enabled ? 'Akses Aktif' : 'Akses Nonaktif'}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/[0.03] p-3 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Queue Tree (Batas Kecepatan)</p>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-white truncate">{iface.hasQueueTree ? (iface.queueTreeName || iface.name) : 'Batas Tidak Ditemukan'}</p>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border shrink-0 ${iface.hasQueueTree
                                    ? (iface.bandwidthEnabled
                                        ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
                                        : 'border-amber-500/20 text-amber-400 bg-amber-500/10')
                                    : 'border-gray-500/20 text-gray-400 bg-gray-500/10'}`}>
                              {iface.hasQueueTree ? (iface.bandwidthEnabled ? 'Aktif' : 'Nonaktif') : 'Tanpa Queue'}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Limit Saat Ini</p>
                              <p className="text-sm font-bold tracking-tight text-white">{iface.hasQueueTree ? `${formatBandwidthMbps(iface.bandwidthLimitMbps)} Mbps` : '--'}</p>
                            </div>
                            <div className="text-right min-w-0">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">NAT Dosen</p>
                              <p className="text-[10px] font-bold text-gray-300 dark:text-gray-500 truncate">{iface.teacherIp || '--'}</p>
                              <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${iface.teacherInternetEnabled
                                      ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10'
                                      : 'border-rose-500/20 text-rose-400 bg-rose-500/10'}`}>
                                {iface.teacherInternetEnabled ? 'Dosen Aktif' : 'Dosen Nonaktif'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input type="number" min="1" step="1" inputMode="numeric" value={bandwidthDrafts[iface.id] ?? ''} onChange={(e) => setBandwidthDrafts(prev => ({ ...prev, [iface.id]: e.target.value }))} placeholder="Mbps" disabled={!iface.hasQueueTree} className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40"/>
                            <button onClick={() => saveBandwidth(iface)} disabled={!iface.hasQueueTree || loading} className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all shrink-0 disabled:opacity-40">
                              Simpan
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-tight truncate min-w-0">{iface.comment || '-- Tanpa Catatan --'}</span>
                          <button onClick={() => toggleInterface(iface.id, iface.enabled)} className={`px-4 sm:px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shrink-0 ${iface.enabled
                                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                                  : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}>
                            {iface.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      </motion.div>))}
                  </AnimatePresence>
                </div>
              </motion.div>)}
          </AnimatePresence>
          </Tabs>
        </div>
    </div>);
}
