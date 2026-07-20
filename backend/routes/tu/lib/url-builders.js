
const formatPublicDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const buildPublicAppBaseUrl = (req) => {
  const configuredBaseUrl =
    process.env.VITE_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_BASE_URL ||
    `${req.protocol}://${req.get('host')}`;
  return configuredBaseUrl.replace(/\/$/, '');
};

const buildPublicValidationUrl = (req, token) => {
  if (!token) return '';
  
  // Gunakan URL khusus validasi jika ada, jika tidak fallback ke base URL utama
  const validationBaseUrl = process.env.VITE_PUBLIC_VALIDATION_URL || buildPublicAppBaseUrl(req);
  const baseUrl = validationBaseUrl.replace(/\/$/, '');
  
  return `${baseUrl}/tu/validasi-surat/${token}`;
};






export {
  formatPublicDate,
  buildPublicAppBaseUrl,
  buildPublicValidationUrl
};
