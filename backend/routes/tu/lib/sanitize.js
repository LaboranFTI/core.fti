
export const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `***@${domain}`;
  return `${local.substring(0, 3)}***@${domain}`;
};

export const maskNim = (nim) => {
  if (!nim || typeof nim !== 'string' || nim.length < 5) return nim;
  return `${nim.substring(0, 4)}****`;
};

export const maskDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  return '***DISENSOR***';
};
