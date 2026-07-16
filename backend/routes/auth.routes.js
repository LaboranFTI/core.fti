import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { verifyRole, apiLimiter } from '../middleware/auth.js';
const router = express.Router();

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isResetTokenExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();
const ACCESS_TOKEN_HOURS = 8;
const REMEMBER_ME_DAYS = 30;
const LOGIN_RECAPTCHA_THRESHOLD = 3;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLoginAttempts = new Map();
const createSessionId = () => (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
const createRefreshToken = () => crypto.randomBytes(48).toString('hex');

const isRecaptchaConfigured = () => Boolean(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY);

const getFrontendUrl = (req) => {
  const envUrl = process.env.FRONTEND_URL;
  const host = req.get('host');
  
  if (envUrl) {
    const isEnvLocalhost = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const isReqLocalhost = host && (host.includes('localhost') || host.includes('127.0.0.1'));
    
    if (isEnvLocalhost && !isReqLocalhost) {
      return `${req.protocol}://${host}`;
    }
    return envUrl;
  }
  
  const isReqLocalhost = host && (host.includes('localhost') || host.includes('127.0.0.1'));
  if (isReqLocalhost) {
    return 'http://localhost:5173';
  }
  return `${req.protocol}://${host}`;
};

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  return typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
};
const getLoginAttemptKey = (req, identifier = '') => `${getClientIp(req)}:${String(identifier || '').trim().toLowerCase()}`;
const getFailedLoginCount = (key) => {
  const record = failedLoginAttempts.get(key);
  if (!record || Date.now() > record.expiresAt) {
    failedLoginAttempts.delete(key);
    return 0;
  }
  return record.count;
};
const incrementFailedLogin = (key) => {
  const count = getFailedLoginCount(key) + 1;
  failedLoginAttempts.set(key, {
    count,
    expiresAt: Date.now() + FAILED_LOGIN_WINDOW_MS,
  });
  return count;
};
const clearFailedLogin = (key) => failedLoginAttempts.delete(key);

const verifyRecaptcha = async ({ token, remoteIp }) => {
  if (!isRecaptchaConfigured()) {
    return { success: true, skipped: true };
  }

  if (!token) {
    return { success: false, error: 'Verifikasi reCAPTCHA wajib dilakukan.' };
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (remoteIp && remoteIp !== 'unknown') {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json();

    if (!data.success) {
      return { success: false, error: 'Verifikasi reCAPTCHA gagal. Silakan coba lagi.' };
    }

    return { success: true };
  } catch (error) {
    console.error('reCAPTCHA verify error:', error);
    return { success: false, error: 'Gagal memverifikasi reCAPTCHA.' };
  }
};

const requireRecaptcha = async (req, res, next) => {
  const result = await verifyRecaptcha({
    token: req.body?.recaptchaToken,
    remoteIp: getClientIp(req),
  });

  if (!result.success) {
    return res.status(400).json({
      error: result.error,
      recaptchaRequired: isRecaptchaConfigured(),
    });
  }

  next();
};

router.get('/recaptcha/config', (req, res) => {
  res.json({
    enabled: isRecaptchaConfigured(),
    siteKey: process.env.RECAPTCHA_SITE_KEY || '',
    loginThreshold: LOGIN_RECAPTCHA_THRESHOLD,
  });
});

// Helper function to generate device name from user agent
const getDeviceInfo = (userAgent) => {
  if (!userAgent) return { deviceName: 'Unknown Device', deviceType: 'desktop' };

  const ua = userAgent.toLowerCase();
  let deviceName = 'Unknown Device';
  let deviceType = 'desktop';

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
    if (ua.includes('android')) deviceName = 'Android Phone';
    else if (ua.includes('iphone')) deviceName = 'iPhone';
    else deviceName = 'Mobile Device';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
    deviceName = 'Tablet';
  } else if (ua.includes('mac')) {
    deviceName = 'Mac';
  } else if (ua.includes('windows')) {
    deviceName = 'Windows PC';
  } else if (ua.includes('linux')) {
    deviceName = 'Linux PC';
  }

  return { deviceName, deviceType };
};

const createAccessToken = (user) => {
  const tokenPayload = {
    id: user.id,
    role: user.role,
    jti: createSessionId()
  };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TOKEN_HOURS}h` });
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_HOURS * 60 * 60 * 1000);

  return { token, expiresAt };
};

const persistUserSession = async ({ req, user, token, expiresAt, deviceId, rememberMe }) => {
  const normalizedDeviceId = typeof deviceId === 'string' && deviceId.trim()
    ? deviceId.trim()
    : `device_${createSessionId()}`;
  const { deviceName, deviceType } = getDeviceInfo(req.headers['user-agent']);
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.socket?.remoteAddress || null;
  const refreshToken = rememberMe ? createRefreshToken() : null;
  const refreshTokenExpiresAt = rememberMe
    ? new Date(Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000)
    : null;

  await pool.query(
    `UPDATE user_tokens
     SET is_active = FALSE,
         refresh_token = NULL,
         refresh_token_expires_at = NULL
     WHERE user_id = $1 AND device_id = $2 AND is_active = TRUE`,
    [user.id, normalizedDeviceId]
  );

  await pool.query(
    `INSERT INTO user_tokens (
      user_id,
      token,
      device_id,
      device_name,
      device_type,
      user_agent,
      ip_address,
      is_remember_me,
      refresh_token,
      refresh_token_expires_at,
      expires_at,
      last_used_at,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), TRUE)`,
    [
      user.id,
      token,
      normalizedDeviceId,
      deviceName,
      deviceType,
      req.headers['user-agent'] || null,
      ipAddress,
      rememberMe,
      refreshToken,
      refreshTokenExpiresAt,
      expiresAt
    ]
  );

  return {
    deviceId: normalizedDeviceId,
    refreshToken,
    refreshTokenExpiresAt
  };
};

// Endpoint Login (Menyimpan sesi per perangkat, opsional dengan Remember Me)
router.post('/login', apiLimiter, async (req, res) => {
  const { email, password, deviceId, recaptchaToken } = req.body;
  const loginAttemptKey = getLoginAttemptKey(req, email);
  const failedCount = getFailedLoginCount(loginAttemptKey);
  const recaptchaRequired = isRecaptchaConfigured() && failedCount >= LOGIN_RECAPTCHA_THRESHOLD;

  try {
    console.log(`Login attempt for: ${email}`); // Debug log

    if (recaptchaRequired) {
      const recaptchaResult = await verifyRecaptcha({
        token: recaptchaToken,
        remoteIp: getClientIp(req),
      });

      if (!recaptchaResult.success) {
        return res.status(400).json({
          error: recaptchaResult.error,
          recaptchaRequired: true,
          failedAttempts: failedCount,
        });
      }
    }

    // 1. Cari user berdasarkan email ATAU username - Case Insensitive (ILIKE)
    const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username ILIKE $1', [email]);

    if (result.rows.length === 0) {
      console.log('User not found in database'); // Debug log
      const nextFailedCount = incrementFailedLogin(loginAttemptKey);
      return res.status(401).json({
        error: 'Email atau Username tidak ditemukan.',
        recaptchaRequired: isRecaptchaConfigured() && nextFailedCount >= LOGIN_RECAPTCHA_THRESHOLD,
        failedAttempts: nextFailedCount,
      });
    }

    // 2. Bandingkan password (looping jika ada nama yang sama)
    let user = null;
    for (const candidate of result.rows) {
      // 2a. Akun tanpa password hanya boleh lanjut lewat flow reset yang valid
        if (candidate.password === null) {
          if (candidate.password_reset_token_hash && !isResetTokenExpired(candidate.password_reset_expires_at)) {
            return res.status(403).json({
              success: false,
              resetRequired: true,
              email: candidate.email,
              name: candidate.nama,
              message: 'Akun ini menunggu pembuatan password dengan token reset dari admin.'
            });
        }

        return res.status(403).json({
          error: candidate.status === 'Non-Aktif'
            ? 'Akun belum diaktifkan. Hubungi Admin Laboran (Ruang 227 atau 456).'
            : 'Akun belum memiliki password aktif. Minta admin menerbitkan token reset baru.'
        });
      }

      // 2b. Normal Login Check
      const match = await bcrypt.compare(password, candidate.password);
      if (match) {
        user = candidate;
        break;
      }
    }

    if (user) {
      clearFailedLogin(loginAttemptKey);
      // Update last_login on each login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // Cek Status Akun (Hanya 'Aktif' yang boleh login)
      if (user.status !== 'Aktif') {
        return res.status(403).json({ error: 'Akun belum diaktifkan. Hubungi Admin Laboran (Ruang 227 atau 456).' });
      }

      // Cek kelengkapan profil (Opsional)
      const isProfileIncomplete = !user.telepon;

      const isRememberMe = req.body.rememberMe === true;
      const { token, expiresAt } = createAccessToken(user);
      const session = await persistUserSession({
        req,
        user,
        token,
        expiresAt,
        deviceId,
        rememberMe: isRememberMe
      });

      res.json({
        success: true,
        token,
        id: user.id,
        role: user.role,
        name: user.nama,
        email: user.email,
        profileIncomplete: isProfileIncomplete,
        isRememberMe: isRememberMe,
        expiresAt: expiresAt.toISOString(),
        deviceId: session.deviceId,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt?.toISOString() || null
      });
    } else {
      const nextFailedCount = incrementFailedLogin(loginAttemptKey);
      res.status(401).json({
        error: 'Password salah.',
        recaptchaRequired: isRecaptchaConfigured() && nextFailedCount >= LOGIN_RECAPTCHA_THRESHOLD,
        failedAttempts: nextFailedCount,
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// Endpoint GET /auth/google: Redirect user to Google OAuth Consent Page (SSO Only)
router.get('/google', async (req, res) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    response_type: 'code',
    prompt: 'select_account',
    scope: [
      'openid',
      'email',
      'profile'
    ].join(' ')
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

// Endpoint GET /auth/google/callback: Menangani callback dari Google OAuth (SSO Only)
router.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  const frontendUrl = getFrontendUrl(req);

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=Authorization+code+missing`);
  }

  try {
    // 1. Tukar Authorization Code dengan Token Google
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
      grant_type: 'authorization_code'
    };

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values).toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Error exchanging code:', errText);
      return res.redirect(`${frontendUrl}/login?error=Failed+to+exchange+authorization+code`);
    }

    const tokens = await tokenRes.json();
    const { access_token } = tokens;

    // 2. Ambil Profil Pengguna dari Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (!userRes.ok) {
      return res.redirect(`${frontendUrl}/login?error=Failed+to+fetch+user+profile`);
    }

    const googleUser = await userRes.json();
    const { email, name } = googleUser;

    // 3. Validasi Domain SSO (jika dikonfigurasi di DB)
    const configRes = await pool.query('SELECT * FROM sso_config LIMIT 1');
    const config = configRes.rows[0];
    if (config && config.enabled && config.domain && config.domain.trim() !== '') {
      const allowedDomains = config.domain.split(',').map(d => d.trim()).filter(d => d !== '');
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(domain => email.endsWith(`@${domain}`));
        if (!isAllowed) {
          console.log(`SSO Domain validation failed for email: ${email}. Allowed domains: ${allowedDomains.join(', ')}`);
          return res.redirect(`${frontendUrl}/login?error=Domain+not+allowed`);
        }
      }
    }

    // 4. Sinkronisasi ke tabel sso_users
    const ssoId = `SSO-${Date.now()}`;
    await pool.query(
      `INSERT INTO sso_users (id, email, name, status, updated_at)
       VALUES ($1, $2, $3, 'Aktif', NOW())
       ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, updated_at = NOW()`,
      [ssoId, email, name]
    );

    // 5. Cari atau Registrasi User Baru
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userCheck.rows[0];

    if (!user) {
      // Auto register
      const newId = `USER-${Date.now()}`;
      const username = email.split('@')[0];
      let assignedRole = 'Mahasiswa';
      if (email.endsWith('@student.uksw.edu') || email.endsWith('@students.uksw.edu')) {
        assignedRole = 'Mahasiswa';
      } else if (email.endsWith('@uksw.edu')) {
        assignedRole = 'Dosen';
      }

      const insertQuery = `
        INSERT INTO users (id, nama, email, username, password, role, identifier, status, created_at)
        VALUES ($1, $2, $3, $4, NULL, $5, $6, 'Aktif', NOW())
        RETURNING *
      `;
      const newUserRes = await pool.query(insertQuery, [newId, name, email, username, assignedRole, username]);
      user = newUserRes.rows[0];

      // Buat Notifikasi Admin
      const notifId = `NOTIF-${Date.now()}`;
      await pool.query(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES ($1, NULL, $2, $3, 'info')",
        [notifId, 'User Baru via SSO', `User ${name} (${email}) telah mendaftar otomatis via Google SSO.`]
      );
    } else {
      if (user.status !== 'Aktif') {
        return res.redirect(`${frontendUrl}/login?error=Account+is+disabled`);
      }
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    }

    // 6. Buat Sesi JWT Lokal
    const { token, expiresAt } = createAccessToken(user);
    const session = await persistUserSession({
      req,
      user,
      token,
      expiresAt,
      deviceId: `device_${createSessionId()}`,
      rememberMe: true
    });

    // 7. Redirect ke Frontend dengan Parameter URL
    const params = new URLSearchParams({
      token,
      id: user.id,
      role: user.role,
      name: user.nama,
      email: user.email,
      deviceId: session.deviceId,
      expiresAt: expiresAt.toISOString()
    });
    if (session.refreshToken) {
      params.append('refreshToken', session.refreshToken);
    }

    return res.redirect(`${frontendUrl}/login?${params.toString()}`);
  } catch (err) {
    console.error('SSO Callback Error:', err);
    return res.redirect(`${frontendUrl}/login?error=Callback+internal+server+error`);
  }
});

// Endpoint POST /auth/google: Verifikasi Access Token Google SSO dari Frontend
router.post('/google', async (req, res) => {
  const { accessToken, deviceId, rememberMe } = req.body;

  if (!accessToken) {
    return res.status(400).json({ success: false, error: 'Access token Google diperlukan.' });
  }

  try {
    // 1. Ambil Profil Pengguna dari Google menggunakan access token
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('Error fetching user info from Google:', errText);
      return res.status(400).json({ success: false, error: 'Gagal mengambil profil pengguna dari Google.' });
    }

    const googleUser = await userRes.json();
    const { email, name } = googleUser;

    // 2. Validasi Domain SSO (jika dikonfigurasi di DB)
    const configRes = await pool.query('SELECT * FROM sso_config LIMIT 1');
    const config = configRes.rows[0];
    if (config && config.enabled && config.domain && config.domain.trim() !== '') {
      const allowedDomains = config.domain.split(',').map(d => d.trim()).filter(d => d !== '');
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(domain => email.endsWith(`@${domain}`));
        if (!isAllowed) {
          console.log(`SSO Domain validation failed for email: ${email}. Allowed domains: ${allowedDomains.join(', ')}`);
          return res.status(400).json({ success: false, error: 'Domain email tidak diizinkan untuk login.' });
        }
      }
    }

    // 3. Sinkronisasi ke tabel sso_users
    const ssoId = `SSO-${Date.now()}`;
    await pool.query(
      `INSERT INTO sso_users (id, email, name, status, updated_at)
       VALUES ($1, $2, $3, 'Aktif', NOW())
       ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, updated_at = NOW()`,
      [ssoId, email, name]
    );

    // 4. Cari atau Registrasi User Baru
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userCheck.rows[0];

    if (!user) {
      // Auto register
      const newId = `USER-${Date.now()}`;
      const username = email.split('@')[0];
      let assignedRole = 'Mahasiswa';
      if (email.endsWith('@student.uksw.edu') || email.endsWith('@students.uksw.edu')) {
        assignedRole = 'Mahasiswa';
      } else if (email.endsWith('@uksw.edu')) {
        assignedRole = 'Dosen';
      }

      const insertQuery = `
        INSERT INTO users (id, nama, email, username, password, role, identifier, status, created_at)
        VALUES ($1, $2, $3, $4, NULL, $5, $6, 'Aktif', NOW())
        RETURNING *
      `;
      const newUserRes = await pool.query(insertQuery, [newId, name, email, username, assignedRole, username]);
      user = newUserRes.rows[0];

      // Buat Notifikasi Admin
      const notifId = `NOTIF-${Date.now()}`;
      await pool.query(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES ($1, NULL, $2, $3, 'info')",
        [notifId, 'User Baru via SSO', `User ${name} (${email}) telah mendaftar otomatis via Google SSO.`]
      );
    } else {
      if (user.status !== 'Aktif') {
        return res.status(400).json({ success: false, error: 'Akun dinonaktifkan.' });
      }
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    }

    // 5. Buat Sesi JWT Lokal
    const { token, expiresAt } = createAccessToken(user);
    const session = await persistUserSession({
      req,
      user,
      token,
      expiresAt,
      deviceId: deviceId || `device_${createSessionId()}`,
      rememberMe: Boolean(rememberMe)
    });

    // 6. Kembalikan Response Sukses
    res.json({
      success: true,
      token,
      id: user.id,
      role: user.role,
      name: user.nama,
      email: user.email,
      deviceId: session.deviceId,
      refreshToken: session.refreshToken
    });
  } catch (err) {
    console.error('SSO Token Error:', err);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan internal server saat memproses SSO.' });
  }
});

// Endpoint GET /auth/google/calendar: Redirect user to Google OAuth for Calendar permission
router.get('/google/calendar', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Token tidak disediakan.' });
  }

  try {
    // Verifikasi JWT token local
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const userRole = decoded.role ? decoded.role.toUpperCase() : '';

    const calendarWriteRoles = ['ADMIN', 'LABORAN', 'SUPERVISOR'];
    if (!calendarWriteRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Akses ditolak. Peran Anda tidak diizinkan untuk menghubungkan Google Calendar.' });
    }

    // Generate state parameter signed with JWT to prevent CSRF and keep context
    const state = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/calendar/callback`;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    const options = {
      redirect_uri: redirectUri,
      client_id: clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent', // Pastikan consent agar mendapatkan refresh token
      state: state,
      scope: 'https://www.googleapis.com/auth/calendar.events'
    };

    const qs = new URLSearchParams(options);
    res.redirect(`${rootUrl}?${qs.toString()}`);
  } catch (err) {
    console.error('Calendar Auth Initiating Error:', err);
    return res.status(401).json({ error: 'Sesi tidak valid atau kadaluarsa.' });
  }
});

// Endpoint GET /auth/google/calendar/callback: Google Calendar OAuth Callback
router.get('/google/calendar/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = getFrontendUrl(req);

  if (error) {
    console.error('Google Calendar OAuth error:', error);
    return res.redirect(`${frontendUrl}/jadwal-ruang?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/jadwal-ruang?error=Missing+code+or+state`);
  }

  try {
    // 1. Verifikasi state JWT untuk mendapatkan userId
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 2. Tukar Authorization Code dengan Google Tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/calendar/callback`;
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values).toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Error exchanging code for calendar:', errText);
      return res.redirect(`${frontendUrl}/jadwal-ruang?error=Failed+to+exchange+calendar+token`);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;
    const expiryDate = new Date(Date.now() + (expires_in || 3600) * 1000);

    // 3. Simpan token ke database user
    if (refresh_token) {
      await pool.query(
        `UPDATE users
         SET google_access_token = $1,
             google_refresh_token = $2,
             google_token_expiry = $3,
             google_granted_scopes = $4
         WHERE id = $5`,
        [access_token, refresh_token, expiryDate, scope, userId]
      );
    } else {
      // Jika refresh token tidak ada, update access token dan fields lainnya tanpa meng-overwrite refresh token yang lama
      await pool.query(
        `UPDATE users
         SET google_access_token = $1,
             google_token_expiry = $2,
             google_granted_scopes = $3
         WHERE id = $4`,
        [access_token, expiryDate, scope, userId]
      );
    }

    // 4. Redirect kembali ke frontend jadwal ruang dengan flag sukses
    return res.redirect(`${frontendUrl}/jadwal-ruang?calendar_connected=true`);
  } catch (err) {
    console.error('Calendar Callback Error:', err);
    return res.redirect(`${frontendUrl}/jadwal-ruang?error=Callback+internal+server+error`);
  }
});

// Endpoint GET /auth/me: Mengambil data profil, SSO, dan permission Calendar internal user yang login
router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    const result = await pool.query('SELECT id, nama, email, role, password, google_refresh_token FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const calendarWriteRoles = ['ADMIN', 'LABORAN', 'SUPERVISOR'];
    const hasWriteAccess = calendarWriteRoles.includes(user.role.toUpperCase());
    const googleCalendarConnected = !!user.google_refresh_token;
    const authProvider = user.password ? 'local' : 'google_sso';

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.nama,
        email: user.email,
        role: user.role,
        authProvider,
        calendarProvider: 'core',
        coreCalendarConnected: true,
        googleCalendarConnected,
        calendarConnected: true,
        permissions: {
          calendarRead: true,
          calendarWrite: hasWriteAccess,
          coreCalendarRead: true,
          coreCalendarWrite: hasWriteAccess,
          googleCalendarRead: googleCalendarConnected,
          googleCalendarWrite: hasWriteAccess && googleCalendarConnected,
          canConnectCalendar: hasWriteAccess,
          canConnectGoogleCalendar: hasWriteAccess
        }
      }
    });
  } catch (err) {
    console.error('Error in /auth/me:', err);
    res.status(500).json({ error: 'Gagal mengambil data user.' });
  }
});

// Endpoint Register (Buat Akun Baru)
router.post('/register', apiLimiter,
  requireRecaptcha,
  // --- 6. Input Validation ---
  body('email', 'Format email tidak valid').isEmail().normalizeEmail(),
  body('password', 'Password minimal 8 karakter').isLength({ min: 8 }),
  body('fullName', 'Nama lengkap tidak boleh kosong').notEmpty().trim().escape(),
  body('username', 'Username tidak boleh kosong').notEmpty().trim().escape(),
  body('username', 'Username tidak boleh mengandung spasi').custom(value => !/\s/.test(value)),
  async (req, res) => {

  // Cek hasil validasi
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { fullName, nim, email, password, username } = req.body;

  try {
    // 1. Cek apakah email atau username sudah terdaftar
    const check = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Email atau Username sudah terdaftar.' });
    }

    // 2. Hash Password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Generate ID (Format: USER-Timestamp)
    const id = `USER-${Date.now()}`;

    // 4. Insert ke Database (Status default: Non-Aktif agar butuh ACC Admin)
    const query = `
      INSERT INTO users (id, nama, email, username, password, role, identifier, status)
      VALUES ($1, $2, $3, $4, $5, 'Lembaga Kemahasiswaan', $6, 'Non-Aktif')
      RETURNING id, nama, email
    `;

    await pool.query(query, [id, fullName, email, username, hashedPassword, nim]);

    // Buat Notifikasi untuk Admin
    const notifId = `NOTIF-${Date.now()}`;
    await pool.query(
      "INSERT INTO notifications (id, user_id, title, message, type) VALUES ($1, NULL, $2, $3, 'info')",
      [notifId, 'Registrasi Pengguna Baru', `User ${fullName} (${email}) menunggu persetujuan.`]
    );

    res.json({ success: true, message: 'Registrasi berhasil. Tunggu persetujuan Admin.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal mendaftar. Silakan coba lagi.' });
  }
});

// Endpoint Set Password Baru (Setelah Reset Admin)
router.post('/set-password', apiLimiter, async (req, res) => {
  const { email, newPassword, resetToken } = req.body;
  const normalizedEmail = String(email || '').trim();

  if (!normalizedEmail || !newPassword || !resetToken) {
    return res.status(400).json({ error: 'Email, password baru, dan token reset wajib diisi.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter.' });
  }

  try {
    const userResult = await pool.query(
      `SELECT id, status, password_reset_token_hash, password_reset_expires_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const user = userResult.rows[0];

    if (!user.password_reset_token_hash || !user.password_reset_expires_at) {
      return res.status(400).json({ error: 'Akun ini tidak memiliki token reset yang aktif.' });
    }

    if (isResetTokenExpired(user.password_reset_expires_at)) {
      return res.status(400).json({ error: 'Token reset sudah kadaluarsa. Minta admin menerbitkan token baru.' });
    }

    if (!['Reset', 'Aktif'].includes(user.status)) {
      return res.status(403).json({ error: 'Akun ini belum bisa membuat password baru.' });
    }

    const providedTokenHash = hashResetToken(String(resetToken).trim().toUpperCase());
    const savedTokenBuffer = Buffer.from(user.password_reset_token_hash, 'utf8');
    const providedTokenBuffer = Buffer.from(providedTokenHash, 'utf8');

    if (
      savedTokenBuffer.length !== providedTokenBuffer.length ||
      !crypto.timingSafeEqual(savedTokenBuffer, providedTokenBuffer)
    ) {
      return res.status(400).json({ error: 'Token reset tidak valid.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.query(
      `UPDATE users
       SET password = $1,
           status = CASE WHEN status = 'Reset' THEN 'Aktif' ELSE status END,
           password_changed_at = NOW(),
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    res.json({ success: true, message: 'Password berhasil diperbarui. Silakan login.' });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: 'Gagal memperbarui password.' });
  }
});

// Endpoint Check User Existence (Untuk Lupa Password)
router.post('/check-user-exists', requireRecaptcha, async (req, res) => {
  const { identifier } = req.body;
  try {
    const result = await pool.query('SELECT id, nama FROM users WHERE email = $1 OR username = $1', [identifier]);
    if (result.rows.length > 0) {
      res.json({ exists: true, name: result.rows[0].nama });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('Check user exists error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// Endpoint Logout (mencabut sesi aktif pada perangkat ini bila tersedia)
router.post('/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const accessToken = authHeader && authHeader.split(' ')[1];
  const { refreshToken, deviceId } = req.body || {};

  try {
    if (refreshToken && deviceId) {
      await pool.query(
        `UPDATE user_tokens
         SET is_active = FALSE,
             refresh_token = NULL,
             refresh_token_expires_at = NULL
         WHERE refresh_token = $1 AND device_id = $2 AND is_active = TRUE`,
        [refreshToken, deviceId]
      );
    } else if (accessToken) {
      await pool.query(
        `UPDATE user_tokens
         SET is_active = FALSE,
             refresh_token = NULL,
             refresh_token_expires_at = NULL
         WHERE token = $1 AND is_active = TRUE`,
        [accessToken]
      );
    }
  } catch (err) {
    console.error('Logout revoke error:', err);
  }

  res.json({ success: true, message: 'Logout berhasil.' });
});

// **[BARU]** Endpoint Verify Session (Silent Verification)
router.get('/verify', async (req, res) => {
  try {
    // Token sudah divalidasi oleh middleware verifyToken
    // Cek kembali status user di database untuk memastikan akun belum dinonaktifkan
    const userCheck = await pool.query('SELECT id, nama, role, status, email FROM users WHERE id = $1', [req.user.id]);

    if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'Aktif') {
      return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    res.json({
      success: true,
      user: {
        id: userCheck.rows[0].id,
        name: userCheck.rows[0].nama,
        role: userCheck.rows[0].role,
        email: userCheck.rows[0].email
      }
    });
  } catch (err) {
    console.error('Verify token error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat memverifikasi sesi.' });
  }
});

// **[BARU]** Endpoint Refresh Token (for Remember Me auto-login)
router.post('/refresh', async (req, res) => {
  const { refreshToken, deviceId } = req.body;

  if (!refreshToken || !deviceId) {
    return res.status(400).json({ error: 'Refresh token dan device ID diperlukan.' });
  }

  try {
    // Find the session with this refresh token and device ID
    const result = await pool.query(
      `SELECT ut.*, u.role, u.nama, u.status, u.email
       FROM user_tokens ut
       JOIN users u ON ut.user_id = u.id
       WHERE ut.refresh_token = $1 AND ut.device_id = $2 AND ut.is_active = TRUE`,

       [refreshToken, deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sesi tidak valid atau telah kadaluarsa.' });
    }

    const session = result.rows[0];

    // Check if refresh token is still valid
    if (session.refresh_token_expires_at && new Date(session.refresh_token_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Sesi telah kadaluarsa. Silakan login kembali.' });
    }

    // Check if user is still active
    if (session.status !== 'Aktif') {
      return res.status(403).json({ error: 'Akun sudah tidak aktif.' });
    }

    // Generate new access token
    const { token: newToken, expiresAt: newExpiresAt } = createAccessToken({
      id: session.user_id,
      role: session.role
    });
    const newRefreshTokenExpiresAt = session.is_remember_me
      ? new Date(Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000)
      : session.refresh_token_expires_at;

    // Update token in database
    await pool.query(
      `UPDATE user_tokens
       SET token = $1,
           expires_at = $2,
           refresh_token_expires_at = $3,
           last_used_at = NOW()
       WHERE id = $4`,
      [newToken, newExpiresAt, newRefreshTokenExpiresAt, session.id]
    );

    res.json({
      success: true,
      token: newToken,
      expiresAt: newExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: newRefreshTokenExpiresAt?.toISOString() || null,
      user: {
        id: session.user_id,
        name: session.nama,
        role: session.role,
        email: session.email
      }
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Gagal memperbarui sesi.' });
  }
});

// Endpoint Ubah Password User (Dari Halaman Profile)
router.put('/users/:id/change-password', verifyRole(['Admin', 'Laboran', 'Lembaga Kemahasiswaan', 'Dosen', 'Supervisor', 'Admin TU', 'User TU']), async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Pastikan user hanya bisa mengubah passwordnya sendiri (kecuali admin)
  if (req.user.id !== id && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Tidak diizinkan mengubah password user lain.' });
  }

  try {
    // Ambil password saat ini dari DB
    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const user = userRes.rows[0];

    // Verifikasi password lama
    if (user.password !== null) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({ error: 'Password saat ini salah.' });
      }
    }

    // Hash password baru dan update ke DB beserta tanggal perubahannya
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.query(
      'UPDATE users SET password = $1, password_changed_at = NOW() WHERE id = $2',
      [hashedPassword, id]
    );

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Gagal mengubah password.' });
  }
});

export default router;
