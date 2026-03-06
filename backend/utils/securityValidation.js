const ALLOWED_EMAIL_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'ng', 'co', 'io', 'info', 'me', 'app',
]);

const NIGERIA_STUDY_CENTERS = new Set([
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'Federal Capital Territory (FCT)',
]);

const DISALLOWED_PLACEHOLDERS = new Set([
  'n/a',
  'na',
  'none',
  'nil',
  'null',
  'undefined',
  'tbd',
  'test',
  'unknown',
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
  const [localPart = '', domainPart = ''] = normalized.split('@');
  if (localPart.length < 2 || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;

  const labels = domainPart.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length < 2 || label.length > 63)) return false;
  if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;
  if (labels.some((label) => !/^[a-z0-9-]+$/i.test(label))) return false;

  const tld = labels[labels.length - 1];
  return ALLOWED_EMAIL_TLDS.has(tld);
};

const isValidName = (name) => {
  const normalized = sanitizeText(name);
  if (normalized.length < 5 || normalized.length > 80) return false;
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((part) => /^[a-zA-Z][a-zA-Z'.-]{1,39}$/.test(part));
};

const isValidProfileText = (value, { min = 3, max = 80 } = {}) => {
  const normalized = sanitizeText(value);
  if (normalized.length < min || normalized.length > max) return false;
  if (DISALLOWED_PLACEHOLDERS.has(normalized.toLowerCase())) return false;
  return /^[a-zA-Z][a-zA-Z\s'&().,-]{2,79}$/.test(normalized);
};

const isValidStudyCenter = (value) => NIGERIA_STUDY_CENTERS.has(sanitizeText(value));

const normalizeMatricNumber = (value) => sanitizeText(value).toUpperCase();

const isValidMatricNumber = (value) => {
  const normalized = normalizeMatricNumber(value);
  if (normalized.length < 6 || normalized.length > 24) return false;
  if (DISALLOWED_PLACEHOLDERS.has(normalized.toLowerCase())) return false;
  if (!/[A-Z]/.test(normalized) || !/[0-9]/.test(normalized)) return false;
  return /^[A-Z0-9/-]+$/.test(normalized);
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
  NIGERIA_STUDY_CENTERS,
  sanitizeText,
  hasDangerousPattern,
  normalizeEmail,
  isValidEmailWithAllowlist,
  isValidName,
  isValidProfileText,
  isValidStudyCenter,
  normalizeMatricNumber,
  isValidMatricNumber,
  validateStrongPassword,
};
