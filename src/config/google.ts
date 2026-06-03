// Google Calendar API Configuration
// Used across multiple pages for Calendar integration

export const GOOGLE_API_CONFIG = {
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  API_KEY: import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '',
  // Only include Calendar API - Drive API is not used
  DISCOVERY_DOCS: [
    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
  ],
  SCOPES: {
    // Gabungkan scope calendar dengan profile & email agar user info bisa diambil
    READONLY: 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    READWRITE: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
  }
};

export const { CLIENT_ID, API_KEY, DISCOVERY_DOCS, SCOPES } = GOOGLE_API_CONFIG;
