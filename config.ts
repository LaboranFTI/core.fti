// Konfigurasi Global Aplikasi
export const APP_VERSION = "1.24.7";
export const APP_NAME = "CORE.FTI";
export const APP_FULL_NAME = "Campus Operational Resource Environment";
export const INSTITUTION_NAME = "Fakultas Teknologi Informasi - UKSW";

// Logika API URL Dinamis:
// 1. Gunakan nilai dari .env jika ada
// 2. Di Production (Nginx), gunakan string kosong "" agar menggunakan domain saat ini tanpa port
// 3. Di Development, otomatis deteksi IP/Domain yang sedang diakses dan arahkan ke port 5000
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : `${window.location.protocol}//${window.location.hostname}:5000`);