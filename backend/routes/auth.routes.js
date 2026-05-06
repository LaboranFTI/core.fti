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

// Endpoint Login (Simplified - No token storage in DB)
router.post('/login', apiLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`Login attempt for: ${email}`); // Debug log

    // 1. Cari user berdasarkan email ATAU username - Case Insensitive (ILIKE)
    const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username ILIKE $1', [email]);
    
    if (result.rows.length === 0) {
      console.log('User not found in database'); // Debug log
      return res.status(401).json({ error: 'Email atau Username tidak ditemukan.' });
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
      // Update last_login on each login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // Cek Status Akun (Hanya 'Aktif' yang boleh login)
      if (user.status !== 'Aktif') {
        return res.status(403).json({ error: 'Akun belum diaktifkan. Hubungi Admin Laboran (Ruang 227 atau 456).' });
      }

      // Cek kelengkapan profil (Opsional)
      const isProfileIncomplete = !user.telepon;

      // Tentukan expiration token (8 jam untuk regular, 30 hari untuk remember me)
      // Kita tetap perlu rememberMe dari frontend untuk menentukan expiry
      const isRememberMe = req.body.rememberMe === true;
      const tokenExpiryHours = isRememberMe ? 30 * 24 : 8;

      // Buat JWT Token (tanpa simpan ke database)
      const tokenPayload = { 
        id: user.id, 
        role: user.role,
        jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: `${tokenExpiryHours}h` });
      const expiresAt = new Date(Date.now() + tokenExpiryHours * 60 * 60 * 1000);

      res.json({ 
        success: true, 
        token,
        id: user.id, 
        role: user.role, 
        name: user.nama, 
        email: user.email,
        profileIncomplete: isProfileIncomplete,
        isRememberMe: isRememberMe,
        expiresAt: expiresAt.toISOString()
      });
    } else {
      res.status(401).json({ error: 'Password salah.' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// **[BARU]** Endpoint Google SSO Login (Updated for Production Security)
router.post('/auth/google', async (req, res) => {
  const { accessToken, deviceId } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access Token diperlukan.' });
  }

  try {
    // 1. Ambil konfigurasi SSO
    const configRes = await pool.query('SELECT * FROM sso_config LIMIT 1');
    const config = configRes.rows[0];

    if (!config || !config.enabled) {
      return res.status(403).json({ error: 'SSO Login dinonaktifkan oleh administrator.' });
    }

    // 2. [SECURITY CHECK] Verifikasi Token & Client ID via TokenInfo
    // Ini penting untuk production agar token dari aplikasi lain tidak bisa dipakai login kesini
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    
    if (!tokenInfoRes.ok) {
      return res.status(401).json({ error: 'Token Google tidak valid atau kadaluarsa.' });
    }

    const tokenInfo = await tokenInfoRes.json();

    // Pastikan token ini diterbitkan KHUSUS untuk Client ID aplikasi kita
    if (tokenInfo.aud !== config.client_id) {
      console.error(`SSO Security Alert: Token audience mismatch. Expected ${config.client_id}, got ${tokenInfo.aud}`);
      return res.status(403).json({ error: 'Validasi keamanan gagal. Token tidak dikenali.' });
    }

    // 3. Ambil Info Detail User (Nama, Foto) via UserInfo
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Token Google tidak valid.' });
    }

    const googleUser = await googleRes.json();
    const { email, name, sub: googleId, picture } = googleUser;

    // 4. Validasi Domain (Support multiple domains, separated by comma)
    // Jika domain dikosongkan di config, skip validasi (untuk development/testing)
    if (config.domain && config.domain.trim() !== '') {
      const allowedDomains = config.domain.split(',').map(d => d.trim()).filter(d => d !== '');
      if (allowedDomains.length > 0) {
        const isAllowed = allowedDomains.some(domain => email.endsWith(`@${domain}`));
        
        if (!isAllowed) {
          console.log(`SSO Domain validation failed for email: ${email}. Allowed domains: ${allowedDomains.join(', ')}`);
          return res.status(403).json({ 
            error: `Akses ditolak. Email harus menggunakan domain: ${allowedDomains.join(', ')}`,
            details: `Email ${email} tidak memiliki domain yang diizinkan.`
          });
        }
      }
    }

    // Sinkronisasi ke tabel sso_users hanya setelah token dan domain lolos validasi
    const ssoId = `SSO-${Date.now()}`;
    await pool.query(
      `INSERT INTO sso_users (id, email, name, status, updated_at)
       VALUES ($1, $2, $3, 'Aktif', NOW())
       ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, updated_at = NOW()`,
      [ssoId, email, name]
    );

    // 5. Cek apakah user sudah ada di database
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userCheck.rows[0];

    if (!user) {
      // --- AUTO REGISTER USER BARU ---
      const newId = `USER-${Date.now()}`;
      const username = email.split('@')[0]; // Gunakan bagian depan email sebagai username
      
      // Insert User Baru (Role: Lembaga Kemahasiswaan, Status: Aktif)
      const insertQuery = `
        INSERT INTO users (id, nama, email, username, password, role, identifier, status, created_at)
        VALUES ($1, $2, $3, $4, NULL, 'Lembaga Kemahasiswaan', $5, 'Aktif', NOW())
        RETURNING *
      `;
      // Identifier default menggunakan bagian depan email jika tidak ada info lain
      const newUserRes = await pool.query(insertQuery, [newId, name, email, username, username]);
      user = newUserRes.rows[0];

      // Buat Notifikasi untuk Admin (Info user baru via SSO)
      const notifId = `NOTIF-${Date.now()}`;
      await pool.query(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES ($1, NULL, $2, $3, 'info')",
        [notifId, 'User Baru via SSO', `User ${name} (${email}) telah mendaftar otomatis via Google SSO.`]
      );
    } else {
      // Jika user ada tapi status Non-Aktif
      if (user.status !== 'Aktif') {
        return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi Admin.' });
      }
      // Update last login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    }

    // 6. Generate Token JWT (Sama seperti login biasa)
    const tokenPayload = { 
      id: user.id, 
      role: user.role,
      jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    res.json({ success: true, token, id: user.id, role: user.role, name: user.nama, email: user.email, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('SSO Login Error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      config: config ? { enabled: config.enabled, clientId: config.client_id ? `${config.client_id.substring(0, 10)}...` : 'not set', domain: config.domain } : 'no config'
    });
    res.status(500).json({ 
      error: 'Terjadi kesalahan saat login dengan Google.',
      details: err.message 
    });
  }
});

// Endpoint Register (Buat Akun Baru)
router.post('/register', apiLimiter, 
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

  if (!email || !newPassword || !resetToken) {
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
      [email]
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
router.post('/check-user-exists', async (req, res) => {
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

// Endpoint Logout (Simplified - stateless, no DB operations needed)
router.post('/logout', async (req, res) => {
  // Since we're using stateless JWT, we just return success
  // The client should discard the token locally
  res.json({ success: true, message: 'Logout berhasil.' });
});

// **[BARU]** Endpoint Verify Session (Silent Verification)
router.get('/auth/verify', async (req, res) => {
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
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken, deviceId } = req.body;

  if (!refreshToken || !deviceId) {
    return res.status(400).json({ error: 'Refresh token dan device ID diperlukan.' });
  }

  try {
    // Find the session with this refresh token and device ID
    const result = await pool.query(
      `SELECT ut.*, u.role, u.nama, u.status 
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
    const tokenPayload = { 
      id: session.user_id, 
      role: session.role,
      jti: crypto.randomUUID() ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    };
    const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
    const newExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    // Update token in database
    await pool.query(
      'UPDATE user_tokens SET token = $1, expires_at = $2, last_used_at = NOW() WHERE id = $3',
      [newToken, newExpiresAt, session.id]
    );

    res.json({
      success: true,
      token: newToken,
      expiresAt: newExpiresAt.toISOString()
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