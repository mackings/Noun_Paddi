const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../utils/emailService');
const { normalizeEmail } = require('../utils/securityValidation');
const { auditLog } = require('../utils/securityAudit');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

const setAuthCookie = (res, token) => {
  res.cookie('np_token', token, getCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie('np_token', {
    ...getCookieOptions(),
    maxAge: 0,
  });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  try {
    const { name, email, password, faculty, department, studyCenter, matricNumber } = req.body;
    const safeEmail = normalizeEmail(email);

    // Check if user exists
    const userExists = await User.findOne({ email: safeEmail });
    if (userExists) {
      await auditLog({
        eventType: 'auth.signup',
        req,
        email: safeEmail,
        success: false,
        message: 'User already exists',
      });
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email: safeEmail,
      password,
      role: 'student',
      faculty,
      department,
      studyCenter,
      matricNumber,
    });
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    await auditLog({
      eventType: 'auth.signup',
      req,
      userId: user._id,
      email: user.email,
      success: true,
      message: 'Signup successful',
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studyCenter: user.studyCenter,
        token,
      },
    });
  } catch (error) {
    await auditLog({
      eventType: 'auth.signup',
      req,
      email: normalizeEmail(req.body?.email),
      success: false,
      message: error.message,
    });
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

    // Check for user
    const user = await User.findOne({ email: safeEmail }).select('+password');
    if (!user) {
      await auditLog({
        eventType: 'auth.login',
        req,
        email: safeEmail,
        success: false,
        message: 'Invalid credentials',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await auditLog({
        eventType: 'auth.login',
        req,
        userId: user._id,
        email: safeEmail,
        success: false,
        message: 'Invalid credentials',
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    await auditLog({
      eventType: 'auth.login',
      req,
      userId: user._id,
      email: user.email,
      success: true,
      message: 'Login successful',
    });

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    await auditLog({
      eventType: 'auth.login',
      req,
      email: normalizeEmail(req.body?.email),
      success: false,
      message: error.message,
    });
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

// @desc    Get a bearer token for cross-origin service calls
// @route   GET /api/auth/session-token
// @access  Private
exports.getSessionToken = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      data: { token },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not refresh session token.',
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

    const user = await User.findOne({ email: safeEmail });

    if (!user) {
      await auditLog({
        eventType: 'auth.forgot_password',
        req,
        email: safeEmail,
        success: false,
        message: 'No account found',
      });
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
      await auditLog({
        eventType: 'auth.forgot_password',
        req,
        userId: user._id,
        email: user.email,
        success: true,
        message: 'Password reset email sent',
      });

      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (error) {
      console.error('Email send error:', error);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      await auditLog({
        eventType: 'auth.forgot_password',
        req,
        userId: user._id,
        email: user.email,
        success: false,
        message: 'Reset email send failed',
      });

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
      await auditLog({
        eventType: 'auth.reset_password',
        req,
        success: false,
        message: 'Invalid or expired reset token',
      });
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
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    await auditLog({
      eventType: 'auth.reset_password',
      req,
      userId: user._id,
      email: user.email,
      success: true,
      message: 'Password reset successful',
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    await auditLog({
      eventType: 'auth.reset_password',
      req,
      success: false,
      message: error.message,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
  clearAuthCookie(res);
  await auditLog({
    eventType: 'auth.logout',
    req,
    userId: req.user?._id,
    success: true,
    message: 'Logout',
  });
  return res.status(200).json({
    success: true,
    message: 'Logged out',
  });
};
