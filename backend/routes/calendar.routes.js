import express from 'express';
import { pool } from '../config/database.js';
import { requireCalendarWriteRole } from '../middleware/auth.js';

const router = express.Router();

// Helper untuk mengambil dan memperbarui Access Token Google Calendar
async function getValidGoogleAccessToken(userId) {
  // 1. Coba cari token milik user yang sedang login
  let result = await pool.query(
    'SELECT id, google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = $1',
    [userId]
  );
  let user = result.rows[0];

  // 2. Jika user tidak ditemukan atau tidak memiliki token, coba cari token milik user lain yang memiliki refresh token (Admin/Laboran)
  if (!user || !user.google_access_token) {
    console.log(`User ${userId} tidak memiliki Google token. Mencari token fallback dari user lain...`);
    const fallbackResult = await pool.query(
      'SELECT id, google_access_token, google_refresh_token, google_token_expiry FROM users WHERE google_refresh_token IS NOT NULL LIMIT 1'
    );
    if (fallbackResult.rows.length > 0) {
      user = fallbackResult.rows[0];
      console.log(`Menggunakan token fallback milik user: ${user.id}`);
    }
  }

  if (!user) {
    throw new Error('User tidak ditemukan.');
  }

  const { google_access_token, google_refresh_token, google_token_expiry, id: tokenUserId } = user;

  if (!google_access_token) {
    const error = new Error('Token Google belum terhubung. Admin atau Laboran perlu menghubungkan Google Calendar terlebih dahulu.');
    error.code = 'MISSING_TOKEN';
    throw error;
  }

  // Cek apakah expired (atau akan expired dalam 5 menit)
  const isExpired = !google_token_expiry || new Date(google_token_expiry).getTime() - 5 * 60 * 1000 <= Date.now();

  if (isExpired) {
    if (!google_refresh_token) {
      const error = new Error('Sesi Google expired dan Refresh Token tidak ditemukan.');
      error.code = 'REAUTH_REQUIRED';
      throw error;
    }

    try {
      console.log(`Refreshing Google Access Token untuk user: ${tokenUserId}`);
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const body = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: google_refresh_token,
        grant_type: 'refresh_token'
      };

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString()
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Gagal me-refresh token Google:', errText);
        const error = new Error('Google token refresh failed.');
        error.code = 'REAUTH_REQUIRED';
        throw error;
      }

      const data = await res.json();
      const newAccessToken = data.access_token;
      const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      // Perbarui di database untuk user pemilik token tersebut
      await pool.query(
        'UPDATE users SET google_access_token = $1, google_token_expiry = $2 WHERE id = $3',
        [newAccessToken, newExpiry, tokenUserId]
      );

      return newAccessToken;
    } catch (err) {
      console.error('Error saat refresh Google token:', err);
      if (err.code === 'REAUTH_REQUIRED') {
        throw err;
      }
      const error = new Error('Gagal me-refresh token Google.');
      error.code = 'REFRESH_FAILED';
      throw error;
    }
  }

  return google_access_token;
}

// GET /api/calendar/events: List events dari Google Calendar
router.get('/events', async (req, res) => {
  const { calendarId, timeMin, timeMax, maxResults, q } = req.query;

  if (!calendarId) {
    return res.status(400).json({ error: 'calendarId query parameter diperlukan.' });
  }

  try {
    const accessToken = await getValidGoogleAccessToken(req.user.id);

    const queryParams = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
    });
    if (timeMin) queryParams.append('timeMin', timeMin);
    if (timeMax) queryParams.append('timeMax', timeMax);
    if (maxResults) queryParams.append('maxResults', maxResults);
    if (q) queryParams.append('q', q);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${queryParams.toString()}`;

    const googleRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!googleRes.ok) {
      const errData = await googleRes.json();
      console.error('Google Calendar List Events Error:', errData);
      
      if (googleRes.status === 401 || googleRes.status === 403) {
        return res.status(googleRes.status).json({
          error: 'Izin Google Calendar tidak valid atau kadaluarsa.',
          code: 'GOOGLE_AUTH_ERROR',
          details: errData.error
        });
      }
      return res.status(googleRes.status).json({ error: 'Gagal mengambil event dari Google Calendar.', details: errData.error });
    }

    const data = await googleRes.json();
    return res.json(data);

  } catch (err) {
    console.error('Calendar Fetch Events Route Error:', err);
    if (err.code === 'MISSING_TOKEN' || err.code === 'REAUTH_REQUIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data Calendar.' });
  }
});

// POST /api/calendar/events: Create event di Google Calendar
router.post('/events', requireCalendarWriteRole, async (req, res) => {
  const { calendarId, resource } = req.body;

  if (!calendarId || !resource) {
    return res.status(400).json({ error: 'calendarId dan resource diperlukan dalam request body.' });
  }

  try {
    const accessToken = await getValidGoogleAccessToken(req.user.id);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const googleRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(resource)
    });

    if (!googleRes.ok) {
      const errData = await googleRes.json();
      console.error('Google Calendar Create Event Error:', errData);
      return res.status(googleRes.status).json({ error: 'Gagal membuat event di Google Calendar.', details: errData.error });
    }

    const data = await googleRes.json();
    return res.json(data);

  } catch (err) {
    console.error('Calendar Create Event Route Error:', err);
    if (err.code === 'MISSING_TOKEN' || err.code === 'REAUTH_REQUIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses request Calendar.' });
  }
});

// PATCH /api/calendar/events/:id: Update event di Google Calendar
router.patch('/events/:id', requireCalendarWriteRole, async (req, res) => {
  const eventId = req.params.id;
  const { calendarId, resource } = req.body;

  if (!calendarId || !resource) {
    return res.status(400).json({ error: 'calendarId dan resource diperlukan dalam request body.' });
  }

  try {
    const accessToken = await getValidGoogleAccessToken(req.user.id);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const googleRes = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(resource)
    });

    if (!googleRes.ok) {
      const errData = await googleRes.json();
      console.error('Google Calendar Patch Event Error:', errData);
      return res.status(googleRes.status).json({ error: 'Gagal memperbarui event di Google Calendar.', details: errData.error });
    }

    const data = await googleRes.json();
    return res.json(data);

  } catch (err) {
    console.error('Calendar Patch Event Route Error:', err);
    if (err.code === 'MISSING_TOKEN' || err.code === 'REAUTH_REQUIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses request Calendar.' });
  }
});

// DELETE /api/calendar/events/:id: Delete event di Google Calendar
router.delete('/events/:id', requireCalendarWriteRole, async (req, res) => {
  const eventId = req.params.id;
  const { calendarId } = req.body;
  const calId = calendarId || req.query.calendarId;

  if (!calId) {
    return res.status(400).json({ error: 'calendarId diperlukan.' });
  }

  try {
    const accessToken = await getValidGoogleAccessToken(req.user.id);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`;

    const googleRes = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!googleRes.ok) {
      const errData = await googleRes.json().catch(() => ({}));
      console.error('Google Calendar Delete Event Error:', errData);
      return res.status(googleRes.status).json({ error: 'Gagal menghapus event di Google Calendar.', details: errData.error });
    }

    return res.json({ success: true, message: 'Event berhasil dihapus.' });

  } catch (err) {
    console.error('Calendar Delete Event Route Error:', err);
    if (err.code === 'MISSING_TOKEN' || err.code === 'REAUTH_REQUIRED') {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses request Calendar.' });
  }
});

export default router;
