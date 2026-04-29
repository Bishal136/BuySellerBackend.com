const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  requestOTP,
  verifyOTPAndLogin,
  resendOTP,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');

// Public routes
router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTPAndLogin);
router.post('/resend-otp', resendOTP);
router.post('/refresh-token', refreshToken);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;