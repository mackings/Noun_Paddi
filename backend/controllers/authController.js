const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');

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

const isValidSignupEmail = (email) => {
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

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role, faculty, department, studyCenter, matricNumber } = req.body;

    if (
      hasDangerousPattern(name) ||
      hasDangerousPattern(email) ||
      hasDangerousPattern(faculty) ||
      hasDangerousPattern(department) ||
      hasDangerousPattern(studyCenter) ||
      hasDangerousPattern(matricNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid characters detected in signup fields',
      });
    }

    const safeName = sanitizeText(name);
    const safeEmail = normalizeEmail(email);
    const safeFaculty = sanitizeText(faculty);
    const safeDepartment = sanitizeText(department);
    const safeStudyCenter = sanitizeText(studyCenter);
    const safeMatricNumber = sanitizeText(matricNumber);

    if (!isValidName(safeName)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid full name (letters, spaces, apostrophe, hyphen only)',
      });
    }

    if (!isValidSignupEmail(safeEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address',
      });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: safeEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Create user
    const user = await User.create({
      name: safeName,
      email: safeEmail,
      password,
      role: role || 'student',
      faculty: safeFaculty,
      department: safeDepartment,
      studyCenter: safeStudyCenter,
      matricNumber: safeMatricNumber,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studyCenter: user.studyCenter,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const safeEmail = normalizeEmail(email);

    // Validate email & password
    if (!safeEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user
    const user = await User.findOne({ email: safeEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const safeEmail = normalizeEmail(email);

    if (!safeEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      });
    }

    const user = await User.findOne({ email: safeEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address',
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Send email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.name);

      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (error) {
      console.error('Email send error:', error);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent. Please try again later.',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
