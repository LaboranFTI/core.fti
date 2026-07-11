import { useCallback, useEffect, useState } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { Role } from '../../types';
import { api } from '../../services/api';
import { clearAuthStorage, getActiveAuthStorage, getStorageItem, hasRememberedSession } from './storage';
import { getDefaultRouteForRole } from './roles';
import { ShowToast } from './useToastMessages';

interface UseAuthSessionOptions {
  navigate: NavigateFunction;
  setIsLoading: (isLoading: boolean) => void;
  showToast: ShowToast;
}

export const useAuthSession = ({ navigate, setIsLoading, showToast }: UseAuthSessionOptions) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    getStorageItem('isAuthenticated') === 'true' || hasRememberedSession()
  );
  const [currentRole, setCurrentRole] = useState<Role>(() => (getStorageItem('currentRole') as Role) || Role.MAHASISWA);
  const [userName, setUserName] = useState<string>(() => getStorageItem('userName') || 'User');
  const [userEmail, setUserEmail] = useState<string>(() => getStorageItem('userEmail') || '');

  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentRole(Role.MAHASISWA);
    setUserName('User');
    setUserEmail('');
  }, []);

  const restoreSessionFromRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const deviceId = localStorage.getItem('deviceId');

    if (!refreshToken || !deviceId) {
      return false;
    }

    try {
      const response = await api('/api/auth/refresh', {
        method: 'POST',
        data: { refreshToken, deviceId }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
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
    } catch {
      return false;
    }
  }, []);

  const handleLogin = useCallback((role: Role, userNameFromLogin?: string, rememberMe = false, emailFromLogin?: string) => {
    setIsLoading(true);
    setCurrentRole(role);

    const nextUserName = userNameFromLogin || getStorageItem('userName') || 'User';
    const nextUserEmail = emailFromLogin || getStorageItem('userEmail') || '';
    setUserName(nextUserName);
    setUserEmail(nextUserEmail);

    setIsAuthenticated(true);
    navigate(getDefaultRouteForRole(role));
    showToast('Selamat datang kembali!', 'success');

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('isAuthenticated', 'true');
    storage.setItem('currentRole', role);
    storage.setItem('userName', nextUserName);
    storage.setItem('userEmail', nextUserEmail);
    setIsLoading(false);
  }, [navigate, setIsLoading, showToast]);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    const refreshToken = getStorageItem('refreshToken');
    const deviceId = localStorage.getItem('deviceId');

    try {
      await api('/api/logout', {
        method: 'POST',
        data: { refreshToken, deviceId }
      });
    } catch {
      // Continue client-side logout.
    } finally {
      resetAuthState();
      clearAuthStorage();
      navigate('/login');
      setIsLoading(false);
    }
  }, [navigate, resetAuthState, setIsLoading]);

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
        const response = await api('/api/auth/verify');
        if (!response.ok) {
          showToast('Sesi Anda tidak valid atau telah berakhir. Silakan login kembali.', 'warning', true);
          handleLogout();
          return;
        }

        const data = await response.json();
        if (data.success && data.user) {
          const storage = getActiveAuthStorage();

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
      } catch {
        // Do not force logout on transient network issues.
      }
    };

    verifySession();
    // This mirrors the previous mount-only verification behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (localStorage.getItem('refreshToken')) return;

    const timeoutMs = 60 * 60 * 1000;
    localStorage.setItem('lastActivity', Date.now().toString());
    let lastSyncTime = Date.now();

    const updateActivity = () => {
      const now = Date.now();
      if (now - lastSyncTime > 5000) {
        localStorage.setItem('lastActivity', now.toString());
        lastSyncTime = now;
      }
    };

    const checkInactivity = () => {
      const lastActivityStr = localStorage.getItem('lastActivity');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();

      if (Date.now() - lastActivity >= timeoutMs) {
        showToast('Sesi Anda berakhir karena tidak aktif selama 1 jam.', 'warning');
        handleLogout();
      }
    };

    const intervalId = setInterval(checkInactivity, 60000);
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }));

    return () => {
      clearInterval(intervalId);
      events.forEach((event) => window.removeEventListener(event, updateActivity));
    };
  }, [handleLogout, isAuthenticated, showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshAuthToken = async () => {
      const refreshToken = getStorageItem('refreshToken');
      const deviceId = localStorage.getItem('deviceId');
      if (!refreshToken || !deviceId) return;

      try {
        const response = await api('/api/auth/refresh', {
          method: 'POST',
          data: { refreshToken, deviceId }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.token) {
            getActiveAuthStorage().setItem('authToken', data.token);
          }
        } else if (response.status === 401 || response.status === 403) {
          showToast('Sesi tidak valid atau telah dicabut. Silakan login kembali.', 'warning', true);
          handleLogout();
        }
      } catch (error) {
        console.error('Gagal melakukan silent refresh token:', error);
      }
    };

    const intervalId = setInterval(refreshAuthToken, 15 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [handleLogout, isAuthenticated, showToast]);

  useEffect(() => {
    const syncLogout = (event: StorageEvent) => {
      if (event.key === 'isAuthenticated' && event.newValue !== 'true') {
        resetAuthState();
        sessionStorage.clear();
        navigate('/login');
        showToast('Anda telah logout dari tab lain.', 'info');
      }
    };

    window.addEventListener('storage', syncLogout);
    return () => window.removeEventListener('storage', syncLogout);
  }, [navigate, resetAuthState, showToast]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (isAuthenticated) {
        handleLogout();
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [handleLogout, isAuthenticated]);

  return {
    isAuthenticated,
    currentRole,
    userName,
    userEmail,
    handleLogin,
    handleLogout
  };
};
