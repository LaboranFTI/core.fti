import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// --- 4. Rate Limiting ---
// Mencegah serangan brute-force pada endpoint otentikasi
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 menit
	max: 20, // Dikembalikan ke limit yang ketat karena hanya diterapkan pada login & register
	standardHeaders: true,
	legacyHeaders: false,
  message: { error: 'Terlalu banyak request, silakan coba lagi setelah 15 menit.' }
});

// --- 5. Role-Based Access Control (RBAC) Middleware ---
export const verifyRole = (allowedRoles) => (req, res, next) => {
  const currentRole = req.user?.role?.toString().toUpperCase();
  const hasAccess = !!currentRole && allowedRoles.some(role => role.toString().toUpperCase() === currentRole);

  if (!req.user || !hasAccess) {
    return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin yang cukup.' });
  }
  next();
};

export const requireCalendarWriteRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  const allowedRoles = ['ADMIN', 'LABORAN', 'SUPERVISOR'];
  const userRole = req.user.role ? req.user.role.toUpperCase() : '';

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk mengedit Calendar.' });
  }
  next();
};

// --- MIDDLEWARE: Verifikasi Token JWT (Stateless - tidak perlu DB check) ---
export const verifyToken = (req, res, next) => {
  // Path di sini tidak perlu '/api' karena middleware ini sudah di-mount pada '/api'.
  // req.path akan menjadi '/login', bukan '/api/login'.
  const publicPaths = [
    '/login', '/auth/login',
    '/register', '/auth/register',
    '/set-password', '/auth/set-password',
    '/logout', '/auth/logout',
    '/auth/refresh', '/refresh',
    '/auth/google', '/google',
    '/check-user-exists', '/auth/check-user-exists',
    '/tu/public'
  ];
  const publicGetPaths = ['/settings/maintenance', '/settings/announcement', '/settings/sso-config', '/recaptcha/config'];
  const isPublicGet = req.method === 'GET' && publicGetPaths.includes(req.path);
  if (publicPaths.some(path => req.path.startsWith(path)) || isPublicGet || req.path === '/') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

  if (token == null) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak disediakan.' });
  }

  // Verify JWT token (stateless - no database check needed)
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa.' });
    }
    // Add user payload to request object
    req.user = user;
    next();
  });
};
