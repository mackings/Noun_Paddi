const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');
const {
  validateSignupInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validatePasswordResetInput,
} = require('../middleware/requestValidation');

const signupLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth:signup',
  message: 'Too many signup attempts. Please try again later.',
});

const loginLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyPrefix: 'auth:login',
  message: 'Too many login attempts. Please try again later.',
});

const resetLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyPrefix: 'auth:reset',
  message: 'Too many password reset attempts. Please try again later.',
});

router.post('/signup', signupLimiter, validateSignupInput, signup);
router.post('/login', loginLimiter, validateLoginInput, login);
router.get('/me', protect, getMe);
router.post('/forgot-password', resetLimiter, validateForgotPasswordInput, forgotPassword);
router.post('/reset-password/:resetToken', resetLimiter, validatePasswordResetInput, resetPassword);
router.post('/logout', protect, logout);

module.exports = router;
