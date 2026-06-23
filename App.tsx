import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Role, Notification, ToastMessage } from './types';
import AppShell from './components/AppShell';
import Toast from './components/Toast';
import LoadingScreen from './components/LoadingScreen';
import ProtectedRoute from './components/ProtectedRoute';
import { GoogleAuthProvider } from './src/context/GoogleAuthContext';
import { api } from './services/api';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { getNavigationLabel, getNavigationItemById } from './lib/navigation';

// Helper fungsi untuk membersihkan cache PWA (Service Worker) sebelum reload
const clearCacheAndReload = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
    }
  }
  window.location.reload();
};

// 1. Helper wrapper untuk menangkap Error Chunk saat deploy versi baru
const lazyWithReload = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error('Versi baru mendeteksi perubahan file:', error);
      if (window.confirm("Versi baru aplikasi tersedia. Halaman perlu dimuat ulang. Lanjutkan?")) {
        clearCacheAndReload();
      }
      return Promise.reject(error);
    }
  });
};

// Lazy load all pages with reload wrapper
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Ruangan = lazyWithReload(() => import('./pages/Ruangan'));
const JadwalRuang = lazyWithReload(() => import('./pages/JadwalRuang'));
const PeminjamanBarang = lazyWithReload(() => import('./pages/PeminjamanBarang'));
const Acara = lazyWithReload(() => import('./pages/Acara'));
const ManajemenLaboran = lazyWithReload(() => import('./pages/ManajemenLaboran'));
const ManajemenPKL = lazyWithReload(() => import('./pages/ManajemenPKL'));
const Inventaris = lazyWithReload(() => import('./pages/Inventaris'));
const PerpindahanBarang = lazyWithReload(() => import('./pages/PerpindahanBarang'));
const ManajemenUser = lazyWithReload(() => import('./pages/ManajemenUser'));
const PesananRuang = lazyWithReload(() => import('./pages/PesananRuang'));
const PemesananSaya = lazyWithReload(() => import('./pages/PemesananSaya'));
const Profile = lazyWithReload(() => import('./pages/Profile'));
const Settings = lazyWithReload(() => import('./pages/Settings'));
const Login = lazyWithReload(() => import('./pages/Login'));
const Maintenance = lazyWithReload(() => import('./pages/Maintenance'));
const JadwalKuliah = lazyWithReload(() => import('./pages/JadwalKuliah'));
const ManajemenSpesifikasi = lazyWithReload(() => import('./pages/ManajemenSpesifikasi'));
const Tentang = lazyWithReload(() => import('./pages/Tentang'));
const NotFound = lazyWithReload(() => import('./pages/NotFound'));
const LayananTU = lazyWithReload(() => import('./pages_tu/LayananTU'));
const MobileUpload = lazyWithReload(() => import('./pages_tu/components/MobileUpload'));
const LecturerManagement = lazyWithReload(() => import('./pages/ManajemenDosen'));
const StudyProgramManagement = lazyWithReload(() => import('./pages/ManajemenProgramStudi'));


// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Helper fungsi untuk membaca storage (Prioritaskan Session, fallback ke Local)
  const getStorageItem = (key: string) => sessionStorage.getItem(key) || localStorage.getItem(key);
  const hasRememberedSession = () => Boolean(localStorage.getItem('refreshToken') && localStorage.getItem('deviceId'));
  const isRoleMatch = (role: Role | string, target: Role) => role.toString().toUpperCase() === target.toString().toUpperCase();
  const isTuRole = (role: Role | string) => isRoleMatch(role, Role.USER_TU) || isRoleMatch(role, Role.ADMIN_TU);
  const getDefaultRouteForRole = (role: Role | string) => {
    if (isTuRole(role)) return '/layanan-tu';
    if (isRoleMatch(role, Role.MAHASISWA)) return '/ruangan';
    return '/dashboard';
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => getStorageItem('isAuthenticated') === 'true' || hasRememberedSession());
  const [currentRole, setCurrentRole] = useState<Role>(() => (getStorageItem('currentRole') as Role) || Role.MAHASISWA);
  const currentPage = location.pathname.substring(1) || getDefaultRouteForRole(currentRole).replace('/', '');
  const [userName, setUserName] = useState<string>(() => getStorageItem('userName') || 'User');
  const [userEmail, setUserEmail] = useState<string>(() => getStorageItem('userEmail') || '');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('isSidebarCollapsed');
    return saved === 'true';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState<{active: boolean, message: string, type: string} | null>(null);
  const [isMobileTopBarVisible, setIsMobileTopBarVisible] = useState(true);
  const lastMainScrollTop = useRef(0);

  // Notifications & Toast State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const hasSidebarNavigation = !isRoleMatch(currentRole, Role.USER_TU);
  const pageLabel = getNavigationLabel(currentPage);

  // Simulate Initial System Load
  useEffect(() => {
    // Cek status maintenance dari server
    const checkSystemStatus = async () => {
      try {
        const [resMaint, resAnnounce] = await Promise.all([
          api('/api/settings/maintenance'),
          api('/api/settings/announcement')
        ]);
        if (resMaint.ok) {
          setIsMaintenanceMode((await resMaint.json()).enabled);
        }
        if (resAnnounce.ok) {
          setAnnouncement(await resAnnounce.json());
        }
      } catch (e) {
        // Non-blocking: lanjutkan meskipun gagal
        setIsMaintenanceMode(false);
      }
    };
    checkSystemStatus();

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // Reduced from 2000ms to 1500ms for faster initial render

    // 2. Polling Pengecekan Versi Baru (Cek setiap 15 menit)
    let lastEtag = '';
    const checkVersion = async () => {
      if (!isAuthenticated) return;
      try {
        // Gunakan method HEAD agar hemat bandwidth (hanya mengambil HTTP Headers, bukan isi HTML)
        const res = await fetch('/', { method: 'HEAD', cache: 'no-cache' });
        const currentEtag = res.headers.get('etag') || res.headers.get('last-modified');
        
        if (lastEtag && currentEtag && lastEtag !== currentEtag) {
          // Tampilkan Toast Peringatan jika ETag/Waktu Modifikasi berubah
          showToast(
            <div>
              <p className="mb-2">Versi baru aplikasi tersedia. Harap muat ulang halaman.</p>
              <button 
                onClick={clearCacheAndReload} 
                className="bg-black/10 hover:bg-black/20 text-current px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              >
                Refresh Sekarang
              </button>
            </div>, 
            "warning", 
            true
          );
        }
        if (currentEtag) lastEtag = currentEtag;
      } catch (e) {
        // Abaikan jika network error / offline
      }
    };
    
    checkVersion();
    const versionInterval = setInterval(checkVersion, 15 * 60 * 1000);

    // 3. Pengecekan ekstra saat tab browser kembali aktif (Fokus di HP/Mobile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      clearInterval(versionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Changed dependency to empty array - only run once on mount

  // Efek khusus untuk mengambil notifikasi agar sinkron dengan state login
  useEffect(() => {
    let notifInterval: NodeJS.Timeout;

    const fetchNotifications = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await api('/api/notifications');
        if (res.ok) setNotifications(await res.json());
      } catch (e) {
        // Silent fail for notifications
      }
    };

    if (isAuthenticated) {
      fetchNotifications();
      notifInterval = setInterval(fetchNotifications, 10000); // Polling setiap 10 detik
    }

    return () => {
      if (notifInterval) clearInterval(notifInterval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('isDarkMode', String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    if (window.innerWidth >= 768) {
      if (!isMobileTopBarVisible) setIsMobileTopBarVisible(true);
      return;
    }

    const nextScrollTop = e.currentTarget.scrollTop;
    const delta = nextScrollTop - lastMainScrollTop.current;

    if (nextScrollTop <= 24) {
      setIsMobileTopBarVisible(true);
    } else if (delta > 10) {
      setIsMobileTopBarVisible(false);
    } else if (delta < -10) {
      setIsMobileTopBarVisible(true);
    }

    lastMainScrollTop.current = nextScrollTop;
  };

  const toggleSidebarCollapse = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('isSidebarCollapsed', String(newState));
  };

  const restoreSessionFromRefresh = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const deviceId = localStorage.getItem('deviceId');

    if (!refreshToken || !deviceId) {
      return false;
    }

    try {
      const res = await api('/api/auth/refresh', {
        method: 'POST',
        data: { refreshToken, deviceId }
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      if (!data.success || !data.token) {
        return false;
      }

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('isAuthenticated', 'true');

      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      if (data.user) {
        const restoredRole = data.user.role as Role;
        const restoredName = data.user.name || 'User';
        const restoredEmail = data.user.email || '';

        localStorage.setItem('currentRole', restoredRole);
        localStorage.setItem('userName', restoredName);
        localStorage.setItem('userEmail', restoredEmail);
        setCurrentRole(restoredRole);
        setUserName(restoredName);
        setUserEmail(restoredEmail);
      }

      setIsAuthenticated(true);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleLogin = (role: Role, userNameFromLogin?: string, rememberMe: boolean = false, emailFromLogin?: string) => {
    setIsLoading(true);
    setCurrentRole(role);
    
    // Use userName from parameter if provided, otherwise get from localStorage
    // This fixes the race condition where localStorage wasn't set yet
    const userName = userNameFromLogin || getStorageItem('userName') || 'User';
    const email = emailFromLogin || getStorageItem('userEmail') || '';
    setUserName(userName);
    setUserEmail(email);
    
    setIsAuthenticated(true);
    const targetPage = getDefaultRouteForRole(role);
    navigate(targetPage);
    showToast('Selamat datang kembali!', 'success');
    
    // Tentukan penyimpanan berdasarkan pilihan user
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('isAuthenticated', 'true');
    storage.setItem('currentRole', role);
    storage.setItem('userName', userName);
    storage.setItem('userEmail', email);
    setIsLoading(false);
  };

  const clearAllStorage = () => {
    const keys = ['isAuthenticated', 'currentRole', 'userName', 'userEmail', 'authToken', 'userId', 'refreshToken'];
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('lastActivity');
    
    // Secara langsung menghapus seluruh data yang ada di sessionStorage
    sessionStorage.clear();
  };

  const handleLogout = async () => {
    setIsLoading(true);
    const refreshToken = getStorageItem('refreshToken');
    const deviceId = localStorage.getItem('deviceId');
    try {
      await api('/api/logout', {
        method: 'POST',
        data: { refreshToken, deviceId }
      });
    } catch (error) {
      // Continue client-side logout
    } finally {
      setIsAuthenticated(false);
      setCurrentRole(Role.MAHASISWA);
      setUserName('User');
      setUserEmail('');
      clearAllStorage();
      navigate('/login');
      setIsLoading(false);
    }
  };

  // Helper: Add Notification
  const addNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      timestamp: 'Baru saja',
      isRead: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      const res = await api(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark notification as read');
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      // Optimistic update di UI
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      // Hit endpoint (asumsi backend mendukung)
      const res = await api(`/api/notifications/read-all`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
    } catch (e) { console.error("Gagal mark all read", e); }
  };

  const clearAllNotifications = async () => {
    try {
      const res = await api('/api/notifications', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear notifications');
      setNotifications([]);
      showToast('Semua notifikasi berhasil dihapus.', 'success');
    } catch (e) { console.error("Gagal hapus notifikasi", e); }
  };

  // Helper: Show Toast
  const showToast = (message: string | React.ReactNode, type: 'success' | 'error' | 'info' | 'warning' = 'info', sticky: boolean = false) => {
    const newToast: any = {
       id: Date.now().toString() + Math.random().toString(),
       message,
       type,
       sticky
    };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Verifikasi Sesi ke Backend saat pertama kali dimuat
  useEffect(() => {
    const verifySession = async () => {
      if (!isAuthenticated) return;
      
      let token = getStorageItem('authToken');
      if (!token) {
        const restored = await restoreSessionFromRefresh();
        if (!restored) {
          handleLogout();
          return;
        }
        token = getStorageItem('authToken');
      }

      if (!token) {
        handleLogout();
        return;
      }
      
      try {
        const res = await api('/api/auth/verify');
        if (!res.ok) {
          // Jika token expired atau user tidak valid (status 401/403)
          showToast('Sesi Anda tidak valid atau telah berakhir. Silakan login kembali.', 'warning', true);
          handleLogout();
        } else {
          const data = await res.json();
          if (data.success && data.user) {
            const storage = sessionStorage.getItem('authToken') ? sessionStorage : localStorage;
            // Sinkronkan data jika ada perubahan role/nama dari database admin
            if (data.user.role !== currentRole) {
              setCurrentRole(data.user.role);
              storage.setItem('currentRole', data.user.role);
            }
            if (data.user.name !== userName) {
              setUserName(data.user.name);
              storage.setItem('userName', data.user.name);
            }
            if (data.user.email && data.user.email !== userEmail) {
              setUserEmail(data.user.email);
              storage.setItem('userEmail', data.user.email);
            }
          }
        }
      } catch (error) {
        // Silent: Don't force logout on network issues
      }
    };

    verifySession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- SESSION TIMEOUT (AUTO LOGOUT) ---
  useEffect(() => {
    if (!isAuthenticated) return;
    if (localStorage.getItem('refreshToken')) return;

    const TIMEOUT_MS = 60 * 60 * 1000; // 60 Menit
    
    // Catat aktivitas di storage agar dibaca oleh semua tab
    localStorage.setItem('lastActivity', Date.now().toString());
    let intervalId: NodeJS.Timeout;
    let lastSyncTime = Date.now();

    const updateActivity = () => {
      const now = Date.now();
      
      // THROTTLING: Hanya tulis ke localStorage maksimal 1 kali setiap 5 detik
      // Mencegah disk I/O dan CPU Overhead yang berlebihan
      if (now - lastSyncTime > 5000) {
        localStorage.setItem('lastActivity', now.toString());
        lastSyncTime = now;
      }
    };

    const checkInactivity = () => {
      const lastActivityStr = localStorage.getItem('lastActivity');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();

      if (Date.now() - lastActivity >= TIMEOUT_MS) {
        showToast("Sesi Anda berakhir karena tidak aktif selama 1 jam.", "warning");
        handleLogout();
      }
    };

    // Cek inaktivitas setiap 1 menit (jauh lebih ringan di CPU dibanding me-reset setTimeout setiap mousemove)
    intervalId = setInterval(checkInactivity, 60000);

    // Daftar event aktivitas user yang akan mereset timer
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Pasang event listener dengan opsi passive: true agar frame rendering scroll tetap mulus
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    // Bersihkan saat unmount atau logout
    return () => {
      clearInterval(intervalId);
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [isAuthenticated]);

  // --- SILENT REFRESH TOKEN (Tiap 15 Menit) ---
  useEffect(() => {
    // Hanya jalankan jika user sedang dalam state login
    if (!isAuthenticated) return;

    const refreshAuthToken = async () => {
      const refreshToken = getStorageItem('refreshToken');
      const deviceId = localStorage.getItem('deviceId');

      // Jika tidak ada data refresh token / device ID, abaikan
      if (!refreshToken || !deviceId) return;

      try {
        const res = await api('/api/auth/refresh', {
          method: 'POST',
          data: { refreshToken, deviceId }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            // Timpa token lama dengan yang baru di storage yang sedang aktif
            const storage = sessionStorage.getItem('authToken') ? sessionStorage : localStorage;
            storage.setItem('authToken', data.token);
          }
        } else if (res.status === 401 || res.status === 403) {
          // Jika refresh token ditolak (misal: dicabut dari perangkat lain / expired)
          showToast("Sesi tidak valid atau telah dicabut. Silakan login kembali.", "warning", true);
          handleLogout();
        }
      } catch (error) {
        console.error('Gagal melakukan silent refresh token:', error);
      }
    };

    const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 menit dalam milidetik
    const intervalId = setInterval(refreshAuthToken, REFRESH_INTERVAL);

    // Bersihkan interval ketika komponen dilepas (unmount) atau user logout
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // --- CROSS-TAB LOGOUT SYNC ---
  useEffect(() => {
    const syncLogout = (e: StorageEvent) => {
      // Jika auth status dihapus dari localStorage (karena tab lain menekan tombol logout)
      if (e.key === 'isAuthenticated' && e.newValue !== 'true') {
        setIsAuthenticated(false);
        setCurrentRole(Role.MAHASISWA);
        setUserName('User');
        setUserEmail('');
        sessionStorage.clear(); // Bersihkan juga memori sessionStorage pada tab ini
        navigate('/login');
        showToast('Anda telah logout dari tab lain.', 'info');
      }
    };

    window.addEventListener('storage', syncLogout);
    return () => window.removeEventListener('storage', syncLogout);
  }, [navigate]);

  // --- INTERCEPTOR UNAUTHORIZED LISTENER ---
  useEffect(() => {
    const handleUnauthorized = () => {
      if (isAuthenticated) {
        handleLogout();
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Render Global Loader
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Render Mobile QR Upload (Bypass login & app layout)
  const queryParams = new URLSearchParams(location.search);
  const uploadSessionId = queryParams.get('uploadSession');
  if (uploadSessionId) {
    return (
      <Suspense fallback={<LoadingScreen />}><MobileUpload sessionId={uploadSessionId} /></Suspense>
    );
  }

  // Render Maintenance Screen (Hanya untuk User biasa. Admin/Laboran/Supervisor/Admin TU tetap bisa akses)
  const canBypassMaintenance =
    isRoleMatch(currentRole, Role.ADMIN) ||
    isRoleMatch(currentRole, Role.LABORAN) ||
    currentRole.toString().toUpperCase() === ('Supervisor' as Role).toString().toUpperCase() ||
    isRoleMatch(currentRole, Role.ADMIN_TU);
  
  if (isMaintenanceMode && !canBypassMaintenance) {
    // Izinkan akses ke path /login agar admin yang sedang logout tetap bisa masuk
    if (location.pathname !== '/login') {
      return <Maintenance />;
    }
  }

  return (
    <div>
      <Routes>
        {/* Route Khusus Login (Tanpa Layout) */}
        <Route path="/login" element={
          !isAuthenticated ? (
            <Suspense fallback={<LoadingScreen />}>
              <Login 
                onLogin={handleLogin} 
                showToast={showToast} 
                isDarkMode={isDarkMode} 
                toggleDarkMode={toggleDarkMode}
              />
            </Suspense>
          ) : (
            <Navigate to={getDefaultRouteForRole(currentRole)} replace />
          )
        } />

        <Route element={
          isAuthenticated ? (
            <AppShell
              currentRole={currentRole}
              currentPage={currentPage}
              userName={userName}
              userEmail={userEmail}
              isDarkMode={isDarkMode}
              isSidebarOpen={isSidebarOpen}
              isSidebarCollapsed={isSidebarCollapsed}
              isMaintenanceMode={isMaintenanceMode}
              isMobileTopBarVisible={isMobileTopBarVisible}
              hasSidebarNavigation={hasSidebarNavigation}
              pageLabel={pageLabel}
              announcement={announcement}
              notifications={notifications}
              onCloseSidebar={() => setIsSidebarOpen(false)}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              onToggleSidebarCollapse={toggleSidebarCollapse}
              toggleDarkMode={toggleDarkMode}
              onLogout={handleLogout}
              onMarkAsRead={markNotificationAsRead}
              onMarkAllAsRead={markAllNotificationsAsRead}
              onClearAllNotifications={clearAllNotifications}
              onNavigate={(page) => {
                const navItem = getNavigationItemById(page);
                if (navItem?.url) {
                  window.open(navItem.url, '_blank', 'noopener,noreferrer');
                } else if (page.startsWith('http://') || page.startsWith('https://')) {
                  window.open(page, '_blank', 'noopener,noreferrer');
                } else {
                  navigate(`/${page}`);
                }
              }}
              onMainScroll={handleMainScroll}
            >
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </AppShell>
          ) : (
            <Navigate to="/login" replace />
          )
        }>
          <Route path="/" element={<Navigate to={getDefaultRouteForRole(currentRole)} replace />} />
          <Route path="/dashboard" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Dashboard role={currentRole} onNavigate={(p: string) => navigate(`/${p}`)} />
            </ProtectedRoute>
          } />
          <Route path="/jadwal-ruang" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <JadwalRuang role={currentRole} showToast={showToast} isDarkMode={isDarkMode} />
            </ProtectedRoute>
          } />
          <Route path="/ruangan" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Ruangan role={currentRole} isDarkMode={isDarkMode} onNavigate={(p: string) => navigate(`/${p}`)} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/acara" element={<Acara showToast={showToast} isDarkMode={isDarkMode} />} />
          <Route path="/peminjaman-barang" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <PeminjamanBarang showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-laboran" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <ManajemenLaboran onNavigate={(p: string) => navigate(`/${p}`)} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-pkl" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <ManajemenPKL showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/inventaris" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Inventaris role={currentRole} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/perpindahan-barang" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <PerpindahanBarang role={currentRole} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-user" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <ManajemenUser showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-dosen" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.ADMIN_TU, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <LecturerManagement showToast={showToast} role={currentRole} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-program-studi" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <StudyProgramManagement showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/pemesanan-saya" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.LEMBAGA_KEMAHASISWAAN, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <PemesananSaya userId={getStorageItem('userId') || ''} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/pesanan-ruang" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <PesananRuang role={currentRole} addNotification={addNotification} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/profil" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role, Role.USER_TU, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Profile role={currentRole} showToast={showToast} onNavigate={(p: string) => navigate(`/${p}`)} />
            </ProtectedRoute>
          } />
          <Route path="/pengaturan" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Settings showToast={showToast} onNavigate={(p: string) => navigate(`/${p}`)} />
            </ProtectedRoute>
          } />
          <Route path="/jadwal-kuliah" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.DOSEN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <JadwalKuliah role={currentRole} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/manajemen-spesifikasi" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, 'Supervisor' as Role]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <ManajemenSpesifikasi role={currentRole} isDarkMode={isDarkMode} showToast={showToast} />
            </ProtectedRoute>
          } />
          <Route path="/tentang" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, 'Supervisor' as Role, Role.USER_TU, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <Tentang />
            </ProtectedRoute>
          } />
          <Route path="/layanan-tu" element={
            <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.DOSEN, 'Supervisor' as Role, Role.USER_TU, Role.ADMIN_TU]} onNavigate={(p: string) => navigate(`/${p}`)}>
              <LayananTU role={currentRole} />
            </ProtectedRoute>
          } />
        </Route>
        
        <Route path="*" element={
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        } />
      </Routes>

      
      
      <Toast toasts={toasts} removeToast={removeToast} isDarkMode={isDarkMode} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GoogleAuthProvider>
        <AppContent />
      </GoogleAuthProvider>
    </Router>
  );
};

export default App;
