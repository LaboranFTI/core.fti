
import rateLimit from "express-rate-limit";

const publicObservationAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan kode akses. Silakan coba lagi beberapa menit lagi.' }
});

const publicValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request validasi. Silakan coba lagi beberapa menit lagi.' }
});






export {
  publicObservationAccessLimiter,
  publicValidationLimiter
};
