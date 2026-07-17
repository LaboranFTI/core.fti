
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
  const configuredBaseUrl = buildPublicAppBaseUrl(req);
  return `${configuredBaseUrl}/tu/validasi-surat/${token}`;
};






export {
  formatPublicDate,
  buildPublicAppBaseUrl,
  buildPublicValidationUrl
};
