import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { API_BASE_URL } from '../../config';

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink: string;
}

interface CalendarPermissions {
  calendarRead: boolean;
  calendarWrite: boolean;
}

interface GoogleAuthContextType {
  isGapiInitialized: boolean;
  isGisInitialized: boolean;
  isAuthenticated: boolean;
  googleUserEmail: string;
  googleAccessToken: string;
  events: GoogleEvent[];
  isLoading: boolean;
  isCreatingEvent: boolean;
  isDeletingEvent: boolean;
  calendarConnected: boolean;
  calendarPermissions: CalendarPermissions;
  connectCalendar: () => void;
  login: (onSuccess?: (tokenResponse: any) => void) => void;
  logout: () => void;
  getValidToken: () => Promise<string | null>;
  fetchEvents: (calendarId: string, timeMin: Date, timeMax: Date) => Promise<void>;
  createEvent: (calendarId: string, eventResource: any) => Promise<boolean>;
  updateEvent: (calendarId: string, eventId: string, eventResource: any) => Promise<boolean>;
  deleteEvent: (calendarId: string, eventId: string) => Promise<boolean>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export const GoogleAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isGapiInitialized] = useState(true);
  const [isGisInitialized] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('');
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [permissions, setPermissions] = useState<CalendarPermissions>({ calendarRead: false, calendarWrite: false });

  // Membaca status login dan permission dari backend /api/auth/me
  const checkAuthStatus = useCallback(async () => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    
    if (!token) {
      setIsAuthenticated(false);
      setGoogleUserEmail('');
      setCalendarConnected(false);
      setPermissions({ calendarRead: false, calendarWrite: false });
      return;
    }

    try {
      const res = await api('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setIsAuthenticated(true);
          setGoogleUserEmail(data.user.email || '');
          setCalendarConnected(!!data.user.calendarConnected);
          setPermissions(data.user.permissions || { calendarRead: true, calendarWrite: false });
          return;
        }
      }
    } catch (e) {
      console.error("Gagal memeriksa status autentikasi Google:", e);
    }
    
    setIsAuthenticated(false);
    setCalendarConnected(false);
  }, []);

  useEffect(() => {
    checkAuthStatus();
    
    const handleAuthChange = () => {
      checkAuthStatus();
    };

    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth:login', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth:login', handleAuthChange);
    };
  }, [checkAuthStatus]);

  // Mengarahkan login langsung ke backend OAuth flow
  const login = useCallback(() => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  }, []);

  const connectCalendar = useCallback(() => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (!token) {
      console.error("Token tidak ditemukan. Silakan login terlebih dahulu.");
      return;
    }
    window.location.href = `${API_BASE_URL}/api/auth/google/calendar?token=${token}`;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setGoogleUserEmail('');
    setEvents([]);
    setCalendarConnected(false);
    setPermissions({ calendarRead: false, calendarWrite: false });
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    return 'backend-managed';
  }, []);

  // Aksi Google Calendar via Backend Proxy
  const fetchEvents = useCallback(async (calendarId: string, timeMin: Date, timeMax: Date) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString()
      });
      const res = await api(`/api/calendar/events?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Gagal mengambil event:", err);
        setEvents([]);
        if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_TOKEN') {
          connectCalendar();
        }
      }
    } catch (e) {
      console.error("Error saat fetchEvents:", e);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [connectCalendar]);

  const createEvent = async (calendarId: string, eventResource: any) => {
    setIsCreatingEvent(true);
    try {
      const res = await api('/api/calendar/events', {
        method: 'POST',
        data: { calendarId, resource: eventResource }
      });
      if (res.ok) {
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Gagal membuat event:", err);
        if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_TOKEN') connectCalendar();
        return false;
      }
    } catch (e) {
      console.error("Error saat createEvent:", e);
      return false;
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const updateEvent = async (calendarId: string, eventId: string, eventResource: any) => {
    setIsCreatingEvent(true);
    try {
      const res = await api(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        data: { calendarId, resource: eventResource }
      });
      if (res.ok) {
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Gagal memperbarui event:", err);
        if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_TOKEN') connectCalendar();
        return false;
      }
    } catch (e) {
      console.error("Error saat updateEvent:", e);
      return false;
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const deleteEvent = async (calendarId: string, eventId: string) => {
    setIsDeletingEvent(true);
    try {
      const res = await api(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        data: { calendarId }
      });
      if (res.ok) {
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Gagal menghapus event:", err);
        if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_TOKEN') connectCalendar();
        return false;
      }
    } catch (e) {
      console.error("Error saat deleteEvent:", e);
      return false;
    } finally {
      setIsDeletingEvent(false);
    }
  };

  return (
    <GoogleAuthContext.Provider value={{
      isGapiInitialized,
      isGisInitialized,
      isAuthenticated,
      googleUserEmail,
      googleAccessToken: '',
      events,
      isLoading,
      isCreatingEvent,
      isDeletingEvent,
      calendarConnected,
      calendarPermissions: permissions,
      connectCalendar,
      login,
      logout,
      getValidToken,
      fetchEvents,
      createEvent,
      updateEvent,
      deleteEvent
    }}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};
