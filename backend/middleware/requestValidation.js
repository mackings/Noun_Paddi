const {
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

  const safeFaculty = sanitizeText(faculty);
  const safeDepartment = sanitizeText(department);
  const safeStudyCenter = sanitizeText(studyCenter);
  const safeMatricNumber = normalizeMatricNumber(matricNumber);

  if (!isValidProfileText(safeFaculty)) {
    return fail(res, 'Select or enter a valid faculty');
  }
  if (!isValidProfileText(safeDepartment)) {
    return fail(res, 'Select or enter a valid department');
  }
  if (!isValidStudyCenter(safeStudyCenter)) {
    return fail(res, 'Select a valid study center');
  }
  if (!isValidMatricNumber(safeMatricNumber)) {
    return fail(res, 'Enter a valid matric number');
  }

  req.body.name = safeName;
  req.body.email = safeEmail;
  req.body.faculty = safeFaculty;
  req.body.department = safeDepartment;
  req.body.studyCenter = safeStudyCenter;
  req.body.matricNumber = safeMatricNumber;
  return next();
};

exports.validateProfileUpdateInput = (req, res, next) => {
  const { name, bio, faculty, department, studyCenter, matricNumber } = req.body || {};

  if (
    hasDangerousPattern(name) ||
    hasDangerousPattern(bio) ||
    hasDangerousPattern(faculty) ||
    hasDangerousPattern(department) ||
    hasDangerousPattern(studyCenter) ||
    hasDangerousPattern(matricNumber)
  ) {
    return fail(res, 'Invalid characters detected in profile fields');
  }

  if (name !== undefined) {
    const safeName = sanitizeText(name);
    if (!isValidName(safeName)) {
      return fail(res, 'Enter a valid full name (letters, spaces, apostrophe, hyphen only)');
    }
    req.body.name = safeName;
  }

  if (bio !== undefined) {
    req.body.bio = sanitizeText(bio).slice(0, 500);
  }

  if (faculty !== undefined) {
    const safeFaculty = sanitizeText(faculty);
    if (!isValidProfileText(safeFaculty)) {
      return fail(res, 'Select or enter a valid faculty');
    }
    req.body.faculty = safeFaculty;
  }

  if (department !== undefined) {
    const safeDepartment = sanitizeText(department);
    if (!isValidProfileText(safeDepartment)) {
      return fail(res, 'Select or enter a valid department');
    }
    req.body.department = safeDepartment;
  }

  if (studyCenter !== undefined) {
    const safeStudyCenter = sanitizeText(studyCenter);
    if (!isValidStudyCenter(safeStudyCenter)) {
      return fail(res, 'Select a valid study center');
    }
    req.body.studyCenter = safeStudyCenter;
  }

  if (matricNumber !== undefined) {
    const safeMatricNumber = normalizeMatricNumber(matricNumber);
    if (!isValidMatricNumber(safeMatricNumber)) {
      return fail(res, 'Enter a valid matric number');
    }
    req.body.matricNumber = safeMatricNumber;
  }

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
