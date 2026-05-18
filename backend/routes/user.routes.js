import express from 'express';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
const router = express.Router();

const ASSIGNABLE_ROLES = ['Mahasiswa', 'Laboran', 'Lembaga Kemahasiswaan', 'Dosen', 'Supervisor', 'Admin TU', 'User TU'];
const CREATEABLE_STATUSES = ['Aktif', 'Non-Aktif'];
const EDITABLE_STATUSES = ['Aktif', 'Non-Aktif', 'Reset'];
const TOGGLEABLE_STATUSES = ['Aktif', 'Non-Aktif'];
const RESET_TOKEN_TTL_HOURS = 24;
const PROFILE_ACCESS_ROLES = ['Admin', 'Laboran', 'Mahasiswa', 'Lembaga Kemahasiswaan', 'Dosen', 'Supervisor', 'Admin TU', 'User TU'];

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const generateResetToken = () => crypto.randomBytes(8).toString('hex').toUpperCase();
const buildResetTokenPayload = () => {
  const resetToken = generateResetToken();
  const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  return {
    resetToken,
    resetTokenHash: hashResetToken(resetToken),
    resetTokenExpiresAt,
  };
};

const canViewAnyProfile = (role) => ['Admin', 'Laboran', 'Supervisor'].includes(role);
const canEditOwnProfile = (role) => PROFILE_ACCESS_ROLES.includes(role);
const parseAvatarImageBuffer = (avatar) => {
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image') || !avatar.includes(',')) {
    return undefined;
  }

  const base64Data = avatar.split(',')[1];
  return Buffer.from(base64Data, 'base64');
};

// Endpoint untuk mengambil data users
router.get('/users', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
  try {
    const { type } = req.query;
    
    // Sort by last_login agar user yang baru aktif (Internal/SSO) muncul paling atas
    let query = `
      SELECT u.*, su.email AS sso_email
      FROM users u
      LEFT JOIN sso_users su ON su.email = u.email
    `;
    let params = [];
    
    // Filter berdasarkan tipe user (internal vs SSO)
    if (type === 'internal') {
      // Internal: user yang tidak terdaftar sebagai SSO user
      query += ' WHERE su.email IS NULL';
    } else if (type === 'sso') {
      // SSO: user yang terdaftar pada tabel sso_users
      query += ' WHERE su.email IS NOT NULL';
    }
    
    query += ' ORDER BY u.last_login DESC NULLS LAST, u.created_at DESC';
    
    const result = await pool.query(query, params);
    
    // Mapping data dari format Database ke format Frontend
    const users = result.rows.map(row => ({
      id: row.id,
      name: row.nama,
      email: row.email,
      username: row.username,
      role: row.role,
      identifier: row.identifier,
      status: row.status,
      lastLogin: row.last_login ? new Date(row.last_login).toLocaleString('id-ID') : '-',
      phone: row.telepon
    }));

    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Gagal mengambil data user' });
  }
});

// Endpoint membuat user baru dari Manajemen User
router.post('/users', verifyRole(['Admin']), async (req, res) => {
  const { name, email, username, role, identifier, phone, status } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim();
  const normalizedUsername = String(username || '').trim();
  const normalizedRole = String(role || '').trim();
  const normalizedIdentifier = String(identifier || '').trim() || null;
  const normalizedPhone = String(phone || '').trim() || null;

  if (!normalizedName || !normalizedEmail || !normalizedUsername || !normalizedRole) {
    return res.status(400).json({ error: 'Nama, email, username, dan role wajib diisi.' });
  }

  if (!ASSIGNABLE_ROLES.includes(normalizedRole)) {
    return res.status(400).json({ error: 'Role user tidak valid.' });
  }

  if (status && !CREATEABLE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status user tidak valid.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [normalizedEmail, normalizedUsername]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email atau username sudah terdaftar.' });
    }

    const id = `USER-${Date.now()}`;
    const resolvedStatus = status || 'Aktif';
    const shouldIssueResetToken = resolvedStatus === 'Aktif';
    const resetTokenPayload = shouldIssueResetToken ? buildResetTokenPayload() : null;

    await pool.query(
      `INSERT INTO users (
         id, nama, email, username, password, role, identifier, telepon, status,
         password_reset_token_hash, password_reset_expires_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        id,
        normalizedName,
        normalizedEmail,
        normalizedUsername,
        normalizedRole,
        normalizedIdentifier,
        normalizedPhone,
        resolvedStatus,
        resetTokenPayload?.resetTokenHash || null,
        resetTokenPayload?.resetTokenExpiresAt || null,
      ]
    );

    res.status(201).json({
      success: true,
      id,
      resetToken: resetTokenPayload?.resetToken || null,
      resetTokenExpiresAt: resetTokenPayload?.resetTokenExpiresAt?.toISOString() || null,
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Gagal membuat user baru.' });
  }
});

// Endpoint update user dari Manajemen User / Profile
router.put('/users/:id', verifyRole(PROFILE_ACCESS_ROLES), async (req, res) => {
  const { name, email, username, role, identifier, phone, status, avatar } = req.body;
  const { id } = req.params;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim();
  const normalizedUsername = String(username || '').trim();
  const normalizedRole = role ? String(role).trim() : '';
  const normalizedIdentifier = String(identifier || '').trim() || null;
  const normalizedPhone = String(phone || '').trim() || null;

  try {
    const targetUser = await pool.query(
      'SELECT id, role, status, password FROM users WHERE id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const currentUser = targetUser.rows[0];

    if (req.user.id === id) {
      if (!canEditOwnProfile(req.user.role)) {
        return res.status(403).json({ error: 'Role Anda tidak diizinkan mengubah profil sendiri.' });
      }

      if (!normalizedName || !normalizedEmail || !normalizedUsername) {
        return res.status(400).json({ error: 'Nama, email, dan username wajib diisi.' });
      }

      const existing = await pool.query(
        'SELECT id FROM users WHERE (email = $1 OR username = $2) AND id <> $3',
        [normalizedEmail, normalizedUsername, id]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email atau username sudah dipakai user lain.' });
      }

      const avatarImageBuffer = parseAvatarImageBuffer(avatar);
      const params = [normalizedName, normalizedEmail, normalizedUsername, normalizedIdentifier, normalizedPhone, id];
      let query = `
        UPDATE users
        SET nama = $1,
            email = $2,
            username = $3,
            identifier = $4,
            telepon = $5,
            updated_at = NOW()
      `;

      if (avatarImageBuffer !== undefined) {
        query += ', avatar_image = $6';
        params.splice(5, 0, avatarImageBuffer);
      }

      query += avatarImageBuffer !== undefined ? ' WHERE id = $7 RETURNING id' : ' WHERE id = $6 RETURNING id';

      await pool.query(query, params);
      return res.json({ success: true });
    }

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Anda hanya dapat mengubah profil akun Anda sendiri.' });
    }

    if (currentUser.role === 'Admin') {
      return res.status(403).json({ error: 'Akun admin hanya dapat dikelola langsung dari database.' });
    }

    if (!normalizedName || !normalizedEmail || !normalizedUsername || !normalizedRole) {
      return res.status(400).json({ error: 'Nama, email, username, dan role wajib diisi.' });
    }

    if (!ASSIGNABLE_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ error: 'Role user tidak valid.' });
    }

    if (status && !EDITABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status user tidak valid.' });
    }

    if (status === 'Reset' && currentUser.status !== 'Reset') {
      return res.status(400).json({ error: 'Gunakan fitur reset password untuk memindahkan akun ke status Reset.' });
    }

    if (currentUser.status === 'Reset' && status === 'Aktif' && currentUser.password === null) {
      return res.status(400).json({ error: 'Akun reset tidak dapat diaktifkan manual sebelum password baru dibuat.' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE (email = $1 OR username = $2) AND id <> $3',
      [normalizedEmail, normalizedUsername, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email atau username sudah dipakai user lain.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET nama = $1,
           email = $2,
           username = $3,
           role = $4,
           identifier = $5,
           telepon = $6,
           status = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING id`,
      [normalizedName, normalizedEmail, normalizedUsername, normalizedRole, normalizedIdentifier, normalizedPhone, status || currentUser.status, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Gagal memperbarui user.' });
  }
});

// Endpoint hapus user dari Manajemen User
router.delete('/users/:id', verifyRole(['Admin']), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    const targetUser = await pool.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    if (targetUser.rows[0].role === 'Admin') {
      return res.status(403).json({ error: 'Akun admin hanya dapat dikelola langsung dari database.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Gagal menghapus user.' });
  }
});

// Endpoint ubah status user
router.put('/users/:id/status', verifyRole(['Admin']), async (req, res) => {
  const { status } = req.body;

  if (!status || !TOGGLEABLE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status user tidak valid.' });
  }

  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Anda tidak dapat mengubah status akun Anda sendiri.' });
    }

    const targetUser = await pool.query(
      'SELECT id, role, status, password FROM users WHERE id = $1',
      [req.params.id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const user = targetUser.rows[0];

    if (user.role === 'Admin') {
      return res.status(403).json({ error: 'Akun admin hanya dapat dikelola langsung dari database.' });
    }

    if (user.status === 'Reset' && status === 'Aktif' && user.password === null) {
      return res.status(400).json({ error: 'Akun reset tidak dapat diaktifkan manual sebelum password baru dibuat.' });
    }

    await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ error: 'Gagal mengubah status user.' });
  }
});

// Endpoint reset password user
router.put('/users/:id/reset-password', verifyRole(['Admin']), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Gunakan halaman profil untuk mengubah password akun Anda sendiri.' });
    }

    const targetUser = await pool.query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [req.params.id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const user = targetUser.rows[0];

    if (user.role === 'Admin') {
      return res.status(403).json({ error: 'Akun admin hanya dapat dikelola langsung dari database.' });
    }

    if (user.status === 'Non-Aktif') {
      return res.status(400).json({ error: 'Aktifkan akun terlebih dahulu sebelum menerbitkan token reset.' });
    }

    const { resetToken, resetTokenHash, resetTokenExpiresAt } = buildResetTokenPayload();

    await pool.query(
      `UPDATE users
       SET password = NULL,
           status = 'Reset',
           password_changed_at = NULL,
           password_reset_token_hash = $2,
           password_reset_expires_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [req.params.id, resetTokenHash, resetTokenExpiresAt]
    );

    res.json({
      success: true,
      resetToken,
      resetTokenExpiresAt: resetTokenExpiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Gagal mereset password user.' });
  }
});

// Endpoint Get Single User (Profile)
router.get('/users/:id', verifyRole(PROFILE_ACCESS_ROLES), async (req, res) => {
  try {
    if (!canViewAnyProfile(req.user.role) && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Tidak diizinkan melihat profil user lain.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' });
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.nama,
      email: row.email,
      username: row.username,
      role: row.role,
      identifier: row.identifier,
      phone: row.telepon || '',
      status: row.status,
      lastLogin: row.last_login ? new Date(row.last_login).toLocaleString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : null,
      memberSince: row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { 
        month: 'long', 
        year: 'numeric' 
      }) : null,
      avatar: row.avatar_image ? `data:image/jpeg;base64,${row.avatar_image.toString('base64')}` : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil profil' });
  }
});

// Endpoint Get User Account Info (for Profile page)
router.get('/users/:id/account-info', verifyRole(PROFILE_ACCESS_ROLES), async (req, res) => {
  try {
    const userId = req.params.id;

    if (!canViewAnyProfile(req.user.role) && req.user.id !== userId) {
      return res.status(403).json({ error: 'Tidak diizinkan melihat informasi akun user lain.' });
    }
    
    // Get user data
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' });
    
    const user = userResult.rows[0];
    
    // Get unread notifications count
    const notifResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    const unreadCount = parseInt(notifResult.rows[0]?.unread_count || '0');
    
    // Get user's booking count
    const bookingResult = await pool.query(
      'SELECT COUNT(*) as total_bookings FROM bookings WHERE user_id = $1',
      [userId]
    );
    const totalBookings = parseInt(bookingResult.rows[0]?.total_bookings || '0');
    
    // Get user's loan count
    const loanResult = await pool.query(
      `SELECT COUNT(DISTINCT l.id) as total_loans 
       FROM loans l 
       JOIN transactions t ON l.transaction_id = t.id 
       WHERE t.peminjam_identifier = $1`,
      [user.identifier]
    );
    const totalLoans = parseInt(loanResult.rows[0]?.total_loans || '0');
    
    res.json({
      status: user.status,
      lastLogin: user.last_login ? new Date(user.last_login).toLocaleString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : 'Belum pernah login',
      memberSince: user.created_at ? new Date(user.created_at).toLocaleString('id-ID', { 
        month: 'long', 
        year: 'numeric' 
      }) : '-',
      passwordChanged: user.password_changed_at ? new Date(user.password_changed_at).toLocaleString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }) : 'Belum pernah diubah',
      unreadNotifications: unreadCount,
      totalBookings: totalBookings,
      totalLoans: totalLoans
    });
  } catch (err) {
    console.error('Error fetching account info:', err);
    res.status(500).json({ error: 'Gagal mengambil informasi akun' });
  }
});

// --- NOTIFICATIONS ---

// Endpoint untuk mengambil data notifikasi
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let query = 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50';
    let params = [userId];
    
    // Admin dan Laboran juga melihat notifikasi sistem (user_id IS NULL)
    if (userRole === 'Admin' || userRole === 'Laboran') {
      query = 'SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 50';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Gagal mengambil notifikasi' });
  }
});

// Endpoint untuk menandai semua notifikasi sudah dibaca
router.put('/notifications/read-all', async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (userRole === 'Admin' || userRole === 'Laboran') {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 OR user_id IS NULL', [userId]);
    } else {
      await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating all notifications:', err);
    res.status(500).json({ error: 'Gagal update semua notifikasi' });
  }
});

// Endpoint untuk menandai notifikasi sudah dibaca
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: 'Gagal update notifikasi' });
  }
});

export default router;
