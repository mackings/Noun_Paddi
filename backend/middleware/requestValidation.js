const {
  sanitizeText,
  hasDangerousPattern,
  normalizeEmail,
  isValidEmailWithAllowlist,
  isValidName,
  validateStrongPassword,
} = require('../utils/securityValidation');

const fail = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

exports.validateSignupInput = (req, res, next) => {
  const { name, email, password, faculty, department, studyCenter, matricNumber } = req.body || {};

  if (
    hasDangerousPattern(name) ||
    hasDangerousPattern(email) ||
    hasDangerousPattern(faculty) ||
    hasDangerousPattern(department) ||
    hasDangerousPattern(studyCenter) ||
    hasDangerousPattern(matricNumber)
  ) {
    return fail(res, 'Invalid characters detected in signup fields');
  }

  const safeName = sanitizeText(name);
  const safeEmail = normalizeEmail(email);
  if (!isValidName(safeName)) {
    return fail(res, 'Enter a valid full name (letters, spaces, apostrophe, hyphen only)');
  }
  if (!isValidEmailWithAllowlist(safeEmail)) {
    return fail(res, 'Enter a valid email address');
  }

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return fail(res, passwordCheck.message);
  }

  req.body.name = safeName;
  req.body.email = safeEmail;
  req.body.faculty = sanitizeText(faculty);
  req.body.department = sanitizeText(department);
  req.body.studyCenter = sanitizeText(studyCenter);
  req.body.matricNumber = sanitizeText(matricNumber);
  return next();
};

exports.validateLoginInput = (req, res, next) => {
  const { email, password } = req.body || {};
  const safeEmail = normalizeEmail(email);
  if (!safeEmail || !password) {
    return fail(res, 'Please provide email and password');
  }
  req.body.email = safeEmail;
  return next();
};

exports.validatePasswordResetInput = (req, res, next) => {
  const { password } = req.body || {};
  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return fail(res, passwordCheck.message);
  }
  return next();
};

exports.validateForgotPasswordInput = (req, res, next) => {
  const safeEmail = normalizeEmail(req.body?.email);
  if (!safeEmail) {
    return fail(res, 'Please provide an email address');
  }
  if (!isValidEmailWithAllowlist(safeEmail)) {
    return fail(res, 'Please provide a valid email address');
  }
  req.body.email = safeEmail;
  return next();
};

exports.validateLeaderboardSubmitInput = (req, res, next) => {
  const { courseId, answers, duration, timeTaken } = req.body || {};
  if (!courseId) {
    return fail(res, 'courseId is required');
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return fail(res, 'answers are required');
  }
  const durationNum = Number(duration);
  const timeTakenNum = Number(timeTaken);
  if (!Number.isFinite(durationNum) || durationNum <= 0) {
    return fail(res, 'duration must be a positive number');
  }
  if (!Number.isFinite(timeTakenNum) || timeTakenNum < 0) {
    return fail(res, 'timeTaken must be a non-negative number');
  }
  return next();
};
