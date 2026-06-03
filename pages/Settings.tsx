import React, { useState, useEffect, useRef } from 'react';
import { Database, Server, Globe, Save, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, ShieldAlert, Power, Megaphone, Download, Upload, FileText, FileWarning, ChevronDown, ChevronUp, X, Check, Filter, Trash2, AlertTriangle, Info, CheckSquare, Square, Activity, Users, Package, Calendar, HardDrive, Clock, ExternalLink, Settings as SettingsIcon, LogIn } from 'lucide-react';
import { api } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { APP_VERSION, APP_NAME, APP_FULL_NAME, INSTITUTION_NAME } from '../config';

interface SettingsProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (page: string) => void;
}

interface ErrorLog {
  id: number;
  errorType: string;
  errorMessage: string;
  errorStack: string | null;
  endpoint: string | null;
  method: string | null;
  userId: string | null;
  userEmail: string | null;
  browserInfo: string | null;
  ipAddress: string | null;
  severity: string;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface ErrorLogStats {
  byType: { error_type: string; count: string }[];
  bySeverity: { severity: string; count: string }[];
  unresolved: number;
  today: number;
}

interface ServerStats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  totalInventory: number;
  totalBookings: number;
  serverUptime: number;
}

const Settings: React.FC<SettingsProps> = ({ showToast, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'sso' | 'sso-users' | 'system' | 'error-log'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState({
    active: false,
    message: '',
    type: 'info'
  });
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', actionType: ''
  });
  const [isConfirming, setIsConfirming] = useState(false);
  
  // SSO Users State
  const [ssoUsers, setSsoUsers] = useState<{id: string; email: string; name: string; status: string; createdAt: string; updatedAt: string}[]>([]);
  const [isLoadingSsoUsers, setIsLoadingSsoUsers] = useState(false);
  const [showSsoUserModal, setShowSsoUserModal] = useState(false);
  const [editingSsoUser, setEditingSsoUser] = useState<{id: string; email: string; name: string; status: string} | null>(null);
  const [ssoUserForm, setSsoUserForm] = useState({ email: '', name: '' });
  
  // Error Log State
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorLogStats | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter State
  const [filters, setFilters] = useState({
    type: '',
    severity: '',
    resolved: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0
  });

  // Server Stats State
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // SSO State
  const [ssoConfig, setSsoConfig] = useState({
    enabled: true,
    clientId: '782934-google-client-id-sample.apps.googleusercontent.com',
    domain: 'uksw.edu,student.uksw.edu,students.uksw.edu',
  });

  // Fetch System Settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [resMaint, resAnnounce, resSsoConfig] = await Promise.all([
          api('/api/settings/maintenance'),
          api('/api/settings/announcement'),
          api('/api/settings/sso-config')
        ]);

        if (resMaint.ok) setMaintenanceMode((await resMaint.json()).enabled);
        
        if (resAnnounce.ok) {
           const data = await resAnnounce.json();
           setAnnouncement(data);
        }

        if (resSsoConfig.ok) {
          const ssoData = await resSsoConfig.json();
          setSsoConfig({
            enabled: ssoData.enabled ?? true,
            clientId: ssoData.clientId || '',
            domain: ssoData.domain ?? ''
          });
        }
      } catch (e) {
        console.error('Failed to fetch settings:', e);
      }
    };
    fetchSettings();
  }, []);

  // Fetch Server Stats
  useEffect(() => {
    const fetchServerStats = async () => {
      if (activeTab !== 'admin') return;
      
      setIsLoadingStats(true);
      try {
        // Fetch various stats
        const [usersRes, roomsRes, inventoryRes, bookingsRes] = await Promise.all([
          api('/api/users'),
          api('/api/rooms?exclude_image=true'),
          api('/api/inventory'),
          api('/api/bookings')
        ]);

        const usersData = usersRes.ok ? await usersRes.json() : [];
        const roomsData = roomsRes.ok ? await roomsRes.json() : [];
        const inventoryData = inventoryRes.ok ? await inventoryRes.json() : [];
        const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];

        setServerStats({
          totalUsers: usersData.length || 0,
          activeUsers: usersData.filter((u: any) => u.status === 'Aktif').length || 0,
          totalRooms: roomsData.length || 0,
          totalInventory: inventoryData.length || 0,
          totalBookings: bookingsData.length || 0,
          serverUptime: Date.now() // Approximate
        });
      } catch (err) {
        console.error('Failed to fetch server stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchServerStats();
  }, [activeTab]);

  // Fetch SSO Users
  useEffect(() => {
    if (activeTab === 'sso-users') {
      const fetchSsoUsers = async () => {
        setIsLoadingSsoUsers(true);
        try {
          const res = await api('/api/sso-users');
          if (res.ok) setSsoUsers(await res.json());
        } catch (e) { console.error(e); }
        setIsLoadingSsoUsers(false);
      };
      fetchSsoUsers();
    }
  }, [activeTab]);

  // Fetch Error Logs with new API
  const fetchErrorLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.resolved) params.append('resolved', filters.resolved);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', String(pagination.limit));
      params.append('offset', String(pagination.offset));

      const res = await api(`/api/error-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setErrorLogs(data.logs);
        setPagination(prev => ({ ...prev, total: data.total }));
      }
    } catch (err) {
      console.error('Failed to fetch error logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Fetch Error Stats
  const fetchErrorStats = async () => {
    try {
      const res = await api('/api/error-logs/stats');
      if (res.ok) {
        const data = await res.json();
        setErrorStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch error stats:', err);
    }
  };

  // Fetch Error Log when tab is active
  useEffect(() => {
    if (activeTab === 'error-log') {
      fetchErrorLogs();
      fetchErrorStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pagination.offset, pagination.limit, refreshTrigger]);

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    setRefreshTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setFilters({
      type: '',
      severity: '',
      resolved: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
    setRefreshTrigger(prev => prev + 1);
  };

  const handleResolveLog = async (id: number) => {
    try {
      const res = await api(`/api/error-logs/${id}/resolve`, { method: 'PUT' });
      if (res.ok) {
        showToast('Error telah ditandai selesai', 'success');
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      showToast('Gagal menyelesaikan error', 'error');
    }
  };

  const handleClearResolvedClick = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Log Selesai',
      message: 'Apakah Anda yakin ingin menghapus semua log error yang telah ditandai selesai?',
      actionType: 'clear_resolved'
    });
  };

  const handleRestoreDatabaseClick = () => {
    if (!restoreFile) {
      showToast('Silakan pilih file backup terlebih dahulu.', 'warning');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Restore Database',
      message: 'PERINGATAN: Tindakan ini akan MENIMPA seluruh data database saat ini dengan data dari file backup. Apakah Anda yakin ingin melanjutkan?',
      actionType: 'restore_db'
    });
  };

  const executeConfirmAction = async () => {
    setIsConfirming(true);
    try {
      if (confirmModal.actionType === 'clear_resolved') {
        const res = await api('/api/error-logs', { method: 'DELETE', data: { resolved: true } });
        if (res.ok) {
          const result = await res.json();
          showToast(`${result.deleted} error berhasil dihapus`, 'success');
          setRefreshTrigger(prev => prev + 1);
        }
      } else if (confirmModal.actionType === 'restore_db') {
        const formData = new FormData();
        formData.append('backupFile', restoreFile!);
        const response = await api('/api/settings/restore', { method: 'POST', data: formData });
        const result = await response.json();
        if (response.ok && result.success) {
          showToast('Database berhasil direstore!', 'success');
          setRestoreFile(null);
        } else {
          throw new Error(result.error || 'Restore failed');
        }
      }
    } catch (error) {
      showToast('Tindakan gagal dilakukan.', 'error');
    } finally {
      setIsConfirming(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleViewDetail = (log: ErrorLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'ERROR': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'WARNING': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'API': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
      case 'NETWORK': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'DATABASE': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'AUTH': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'VALIDATION': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-700';
    }
  };

  const handleSsoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api('/api/settings/sso-config', {
        method: 'PUT',
        data: {
          enabled: ssoConfig.enabled,
          clientId: ssoConfig.clientId,
          domain: ssoConfig.domain
        }
      });
      if (res.ok) {
        showToast('Pengaturan Google SSO berhasil diperbarui!', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal menyimpan konfigurasi SSO', 'error');
      }
    } catch (err) {
      showToast('Gagal menyimpan konfigurasi SSO', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaintenanceToggle = async () => {
    const newState = !maintenanceMode;
    setMaintenanceMode(newState);
    try {
      await api('/api/settings/maintenance', {
        method: 'POST',
        data: { enabled: newState }
      });
      showToast(`Maintenance Mode ${newState ? 'Diaktifkan' : 'Dinonaktifkan'}`, newState ? 'warning' : 'success');
    } catch (e) {
      setMaintenanceMode(!newState);
      showToast("Gagal mengubah pengaturan", "error");
    }
  };

  const handleAnnouncementSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/settings/announcement', {
        method: 'POST',
        data: announcement
      });
      showToast('Pengumuman berhasil diperbarui', 'success');
    } catch (err) {
      showToast('Gagal menyimpan pengumuman', 'error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      showToast('Memproses backup database...', 'info');
      const response = await api('/api/settings/backup');
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-corefti-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Backup berhasil didownload!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal mengunduh backup. Pastikan server memiliki pg_dump.', 'error');
    }
  };


  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Sistem</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Konfigurasi aplikasi, integrasi, dan administrasi</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full md:w-fit">
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center ${
            activeTab === 'admin'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <SettingsIcon className="w-4 h-4 mr-2" />
          Admin
        </button>
        <button
          onClick={() => setActiveTab('sso')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center ${
            activeTab === 'sso'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Globe className="w-4 h-4 mr-2" />
          Google SSO
        </button>
        <button
          onClick={() => setActiveTab('sso-users')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center ${
            activeTab === 'sso-users'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Log SSO
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center ${
            activeTab === 'system'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ShieldAlert className="w-4 h-4 mr-2" />
          Sistem
        </button>
        <button
          onClick={() => setActiveTab('error-log')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center ${
            activeTab === 'error-log'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileWarning className="w-4 h-4 mr-2" />
          Log Error
          {errorStats && errorStats.unresolved > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{errorStats.unresolved}</span>
          )}
        </button>
      </div>

      {/* Admin Tab */}
      {activeTab === 'admin' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* App Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Info className="w-5 h-5 mr-2 text-blue-500" /> Informasi Aplikasi
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white">{APP_NAME}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{APP_FULL_NAME}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">Versi {APP_VERSION}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Institusi:</span> {INSTITUTION_NAME}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="font-medium">Database:</span> PostgreSQL (via .env)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="font-medium">Backend:</span> Node.js Express
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Pengguna</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{serverStats?.totalUsers || 0}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">{serverStats?.activeUsers || 0} pengguna aktif</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Ruangan</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{serverStats?.totalRooms || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Laboratorium & Ruang</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Inventaris</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{serverStats?.totalInventory || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Barang & Equipment</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Peminjaman</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{serverStats?.totalBookings || 0}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Booking ruangan</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <ExternalLink className="w-5 h-5 mr-2 text-blue-500" /> Link Cepat
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => onNavigate?.('manajemen-user')} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Users className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manajemen User</span>
                </button>
            <button onClick={() => onNavigate?.('ruangan')} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kelola Ruangan</span>
                </button>
            <button onClick={() => onNavigate?.('inventaris')} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Package className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inventaris</span>
                </button>
            <button onClick={() => onNavigate?.('pesanan-ruang')} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Activity className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pemesanan</span>
                </button>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-blue-500" /> Informasi Sistem
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status Server</span>
                  <span className="flex items-center text-sm font-medium text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
                  <span className="flex items-center text-sm font-medium text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Terhubung
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Konfigurasi DB</span>
                  <span className="text-sm font-medium text-blue-600">
                    .env file
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">API Endpoint</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    http://localhost:5000
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SSO Tab */}
      {activeTab === 'sso' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in-up">
           <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                   <Globe className="w-5 h-5 mr-2 text-blue-500" /> Google SSO
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Konfigurasi login menggunakan akun Google Workspace.</p>
             </div>
             <div className="flex items-center">
                 <span className={`text-sm font-medium mr-3 ${ssoConfig.enabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                    {ssoConfig.enabled ? 'Aktif' : 'Non-Aktif'}
                 </span>
                 <button onClick={() => setSsoConfig({...ssoConfig, enabled: !ssoConfig.enabled})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ssoConfig.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ssoConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
             </div>
          </div>
          <form onSubmit={handleSsoSave} className="p-6 space-y-6">
             <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start">
                 <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                 <div>
                    <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Penting</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">Pastikan URI Redirect di bawah ini telah didaftarkan di Google Cloud Console.</p>
                 </div>
             </div>
             <div className={`space-y-6 transition-opacity ${ssoConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Client ID</label>
                   <input type="text" required={ssoConfig.enabled} value={ssoConfig.clientId} onChange={e => setSsoConfig({...ssoConfig, clientId: e.target.value})} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 font-mono" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allowed Domains (Pisahkan dengan koma)</label>
                   <input 
                     type="text" 
                     value={ssoConfig.domain} 
                     onChange={e => setSsoConfig({...ssoConfig, domain: e.target.value})} 
                     placeholder="Contoh: uksw.edu, gmail.com (Biarkan kosong untuk izinkan semua)"
                     className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 font-mono" 
                   />
                   <p className="text-xs text-gray-500 mt-1">Biarkan kosong jika ingin mengizinkan login dari semua domain email Google.</p>
                </div>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center">
                   {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                   Simpan Konfigurasi
                </button>
             </div>
          </form>
        </div>
      )}

      {/* SSO Users / Activity Log Tab */}
      {activeTab === 'sso-users' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in-up">
           <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                   <LogIn className="w-5 h-5 mr-2 text-blue-500" /> Log Aktivitas SSO
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daftar pengguna yang login menggunakan Google Workspace.</p>
             </div>
             <button onClick={() => { setIsLoadingSsoUsers(true); setTimeout(() => { setIsLoadingSsoUsers(false); }, 500); }} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <RefreshCw className={`w-4 h-4 ${isLoadingSsoUsers ? 'animate-spin' : ''}`} />
             </button>
          </div>
          <div className="overflow-x-auto">
            <table className="mobile-data-table w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-6 py-4">Nama Pengguna</th>
                  <th className="px-6 py-4">Email Google</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Terakhir Login</th>
                  <th className="px-6 py-4">Pertama Bergabung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ssoUsers.length > 0 ? ssoUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td data-label="Nama Pengguna" className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </td>
                    <td data-label="Email Google" className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td data-label="Status" className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td data-label="Terakhir Login" className="px-6 py-4 text-gray-600 dark:text-gray-400">{new Date(user.updatedAt).toLocaleString('id-ID')}</td>
                    <td data-label="Pertama Bergabung" className="px-6 py-4 text-gray-500 dark:text-gray-500 text-xs">{new Date(user.createdAt).toLocaleDateString('id-ID')}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada aktivitas login SSO.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in-up">
           <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                 <ShieldAlert className="w-5 h-5 mr-2 text-blue-500" /> Kontrol Sistem
              </h3>
           </div>
           <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                 <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                       <Power className="w-4 h-4 mr-2 text-orange-500" /> Maintenance Mode
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                       Jika aktif, akses untuk semua user akan ditutup sementara.
                    </p>
                 </div>
                 <button onClick={handleMaintenanceToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full ${maintenanceMode ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                 <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                           <Megaphone className="w-4 h-4 mr-2 text-blue-500" /> Pengumuman Global
                        </h4>
                    </div>
                    <button onClick={() => setAnnouncement({...announcement, active: !announcement.active})} className={`relative inline-flex h-5 w-9 items-center rounded-full ${announcement.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${announcement.active ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                 </div>
                 <form onSubmit={handleAnnouncementSave} className="space-y-3">
                    <textarea value={announcement.message} onChange={e => setAnnouncement({...announcement, message: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" rows={2} placeholder="Pesan..." />
                    <div className="flex justify-between items-center">
                        <select value={announcement.type} onChange={e => setAnnouncement({...announcement, type: e.target.value})} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                            <option value="info">Info</option>
                            <option value="warning">Peringatan</option>
                            <option value="error">Kritikal</option>
                        </select>
                        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Simpan</button>
                    </div>
                 </form>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                 <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center"><Database className="w-4 h-4 mr-2 text-blue-500" /> Backup Database</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unduh salinan lengkap database.</p>
                    </div>
                    <button onClick={handleDownloadBackup} className="px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center">
                        <Download className="w-4 h-4 mr-2" /> Download .sql
                    </button>
                 </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                 <div className="flex flex-col space-y-4">
                    <div>
                        <h4 className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center"><Upload className="w-4 h-4 mr-2" /> Restore Database</h4>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1"><span className="font-bold">PERINGATAN:</span> Data saat ini akan ditimpa.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="file" accept=".sql" ref={fileInputRef} className="hidden" onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} />
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium flex items-center">
                            <FileText className="w-4 h-4 mr-2" /> {restoreFile ? restoreFile.name : 'Pilih File .sql'}
                        </button>
                        {restoreFile && (<button onClick={handleRestoreDatabaseClick} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium flex items-center disabled:opacity-50">
                            {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Mulai Restore
                        </button>)}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Error Log Tab */}
      {activeTab === 'error-log' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Error</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pagination.total}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Belum Selesai</p>
                  <p className="text-2xl font-bold text-orange-600">{errorStats?.unresolved || 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Hari Ini</p>
                  <p className="text-2xl font-bold text-blue-600">{errorStats?.today || 0}</p>
                </div>
                <Info className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Terselesaikan</p>
                  <p className="text-2xl font-bold text-green-600">{pagination.total - (errorStats?.unresolved || 0)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>

          {/* Filter Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Filter className="w-4 h-4 mr-2" /> Filter
                </button>
                {(filters.type || filters.severity || filters.resolved || filters.startDate || filters.endDate) && (
                  <button onClick={handleClearFilters} className="text-sm text-red-600 hover:underline">Hapus Filter</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleClearResolvedClick} className="flex items-center px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4 mr-2" /> Hapus Resolved
                </button>
                <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {showFilters && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Error</label>
                    <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                      <option value="">Semua</option>
                      <option value="API">API</option>
                      <option value="NETWORK">Network</option>
                      <option value="DATABASE">Database</option>
                      <option value="AUTH">Auth</option>
                      <option value="VALIDATION">Validation</option>
                      <option value="RUNTIME">Runtime</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
                    <select value={filters.severity} onChange={e => setFilters({...filters, severity: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                      <option value="">Semua</option>
                      <option value="INFO">Info</option>
                      <option value="WARNING">Warning</option>
                      <option value="ERROR">Error</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select value={filters.resolved} onChange={e => setFilters({...filters, resolved: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                      <option value="">Semua</option>
                      <option value="false">Belum Selesai</option>
                      <option value="true">Selesai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dari Tanggal</label>
                    <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sampai Tanggal</label>
                    <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={handleApplyFilters} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Terapkan Filter</button>
                </div>
              </div>
            )}

            {/* Error Log Table */}
            <div className="overflow-x-auto">
              <table className="mobile-data-table w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700/30">
                  <tr>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Pesan Error</th>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Memuat...</td></tr>
                  ) : errorLogs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tidak ada error logs</td></tr>
                  ) : (
                    errorLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td data-label="Tipe" className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(log.errorType)}`}>{log.errorType}</span>
                        </td>
                        <td data-label="Severity" className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(log.severity)}`}>{log.severity}</span>
                        </td>
                        <td data-label="Pesan Error" className="px-4 py-3 max-w-xs truncate" title={log.errorMessage}>{log.errorMessage}</td>
                        <td data-label="Endpoint" className="px-4 py-3 font-mono text-xs">{log.method} {log.endpoint}</td>
                        <td data-label="Waktu" className="px-4 py-3 text-xs">{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                        <td data-label="Status" className="px-4 py-3">
                          {log.isResolved ? (
                            <span className="flex items-center text-green-600 text-xs"><CheckSquare className="w-3 h-3 mr-1" /> Selesai</span>
                          ) : (
                            <span className="flex items-center text-orange-600 text-xs"><Square className="w-3 h-3 mr-1" /> Pending</span>
                          )}
                        </td>
                        <td data-label="Aksi" className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleViewDetail(log)} className="text-blue-600 hover:underline text-xs">Detail</button>
                            {!log.isResolved && <button onClick={() => handleResolveLog(log.id)} className="text-green-600 hover:underline text-xs">Resolve</button>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Menampilkan {errorLogs.length} dari {pagination.total} error</p>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <button 
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="mobile-modal-shell fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detail Error</h3>
              <button onClick={() => { setShowDetailModal(false); setSelectedLog(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mobile-modal-body p-4 overflow-y-auto max-h-[60vh] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Tipe Error</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(selectedLog.errorType)}`}>{selectedLog.errorType}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Severity</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(selectedLog.severity)}`}>{selectedLog.severity}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Waktu</p>
                  <p className="text-sm dark:text-white">{new Date(selectedLog.createdAt).toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm dark:text-white">{selectedLog.isResolved ? 'Selesai' : 'Pending'}</p>
                </div>
                {selectedLog.endpoint && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Endpoint</p>
                    <p className="text-sm font-mono dark:text-white">{selectedLog.method} {selectedLog.endpoint}</p>
                  </div>
                )}
                {selectedLog.userEmail && (
                  <div>
                    <p className="text-xs text-gray-500">User</p>
                    <p className="text-sm dark:text-white">{selectedLog.userEmail}</p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-xs text-gray-500">IP Address</p>
                    <p className="text-sm font-mono dark:text-white">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Pesan Error</p>
                <p className="text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mt-1 wrap-break-words dark:text-white">{selectedLog.errorMessage}</p>
              </div>
              {selectedLog.errorStack && (
                <div>
                  <p className="text-xs text-gray-500">Stack Trace</p>
                  <pre className="text-xs bg-gray-900 text-gray-300 p-3 rounded-lg mt-1 overflow-x-auto whitespace-pre-wrap">{selectedLog.errorStack}</pre>
                </div>
              )}
              {selectedLog.browserInfo && (
                <div>
                  <p className="text-xs text-gray-500">Browser Info</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 wrap-break-words">{selectedLog.browserInfo}</p>
                </div>
              )}
            </div>
            <div className="mobile-modal-actions p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              {!selectedLog.isResolved && (
                <button onClick={() => { handleResolveLog(selectedLog.id); setShowDetailModal(false); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center">
                  <Check className="w-4 h-4 mr-2" /> Tandai Selesai
                </button>
              )}
              <button onClick={() => { setShowDetailModal(false); setSelectedLog(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Ya, Lanjutkan"
        type="danger"
        isLoading={isConfirming}
      />
    </div>
  );
};

export default Settings;
