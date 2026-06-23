import { useGoogleAuth } from '../src/context/GoogleAuthContext';
import { Role } from '../types';

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink: string;
}

export const useGoogleCalendar = (
  role: Role,
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
) => {
  const googleAuth = useGoogleAuth();

  return {
    isGapiInitialized: googleAuth.isGapiInitialized,
    isAuthenticated: googleAuth.isAuthenticated,
    googleUserEmail: googleAuth.googleUserEmail,
    events: googleAuth.events,
    isLoading: googleAuth.isLoading,
    isCreatingEvent: googleAuth.isCreatingEvent,
    isDeletingEvent: googleAuth.isDeletingEvent,
    login: googleAuth.login,
    logout: googleAuth.logout,
    fetchEvents: googleAuth.fetchEvents,
    createEvent: googleAuth.createEvent,
    updateEvent: googleAuth.updateEvent,
    deleteEvent: googleAuth.deleteEvent,
    getValidToken: googleAuth.getValidToken,
    calendarConnected: googleAuth.calendarConnected,
    connectCalendar: googleAuth.connectCalendar,
    calendarPermissions: googleAuth.calendarPermissions,
  };
};
