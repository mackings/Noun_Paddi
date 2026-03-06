const ALLOWED_EMAIL_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'ng', 'co', 'io', 'info', 'me', 'app',
]);

const sanitizeText = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const hasDangerousPattern = (value) =>
  /<[^>]+>|javascript:|on\w+\s*=|script/gi.test(String(value || ''));

const normalizeEmail = (value) => sanitizeText(value).toLowerCase();

const isValidEmailWithAllowlist = (email) => {
  const normalized = normalizeEmail(email);
  const basicRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;
  if (!basicRegex.test(normalized)) return false;
  const parts = normalized.split('.');
  const tld = parts[parts.length - 1];
  return ALLOWED_EMAIL_TLDS.has(tld);
};

const isValidName = (name) => {
  const normalized = sanitizeText(name);
  if (normalized.length < 2 || normalized.length > 80) return false;
  return /^[a-zA-Z][a-zA-Z\s'.-]{1,79}$/.test(normalized);
};

const validateStrongPassword = (password) => {
  const raw = String(password || '');
  if (raw.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(raw)) {
    return { valid: false, message: 'Password must include at least one uppercase letter' };
  }
  if (!/[a-z]/.test(raw)) {
    return { valid: false, message: 'Password must include at least one lowercase letter' };
  }
  if (!/[0-9]/.test(raw)) {
    return { valid: false, message: 'Password must include at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(raw)) {
    return { valid: false, message: 'Password must include at least one special character' };
  }
  return { valid: true, message: '' };
};

module.exports = {
  ALLOWED_EMAIL_TLDS,
  sanitizeText,
  hasDangerousPattern,
  normalizeEmail,
  isValidEmailWithAllowlist,
  isValidName,
  validateStrongPassword,
};
