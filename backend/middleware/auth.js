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

// --- MIDDLEWARE: Verifikasi Token JWT (Stateless - tidak perlu DB check) ---
export const verifyToken = (req, res, next) => {
  // Path di sini tidak perlu '/api' karena middleware ini sudah di-mount pada '/api'.
  // req.path akan menjadi '/login', bukan '/api/login'.
  // Updated public paths to include sso-config (used on login page)
  const publicPaths = ['/login', '/register', '/set-password', '/settings/maintenance', '/logout', '/settings/sso-config', '/auth/refresh', '/tu/public/qr-download'];
  if (publicPaths.some(path => req.path.startsWith(path)) || req.path === '/') {
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
      return res.status(403).json({ error: 'Token tidak valid atau kadaluarsa.' });
    }
    // Add user payload to request object
    req.user = user;
    next();
  });
};
