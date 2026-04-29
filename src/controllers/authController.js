const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpService = require('../utils/otpService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
};

// @desc    Request OTP for login/registration
// @route   POST /api/auth/request-otp
// @access  Public
exports.requestOTP = async (req, res) => {
  try {
    const { email, purpose = 'login' } = req.body;
    
    console.log(`[Auth] Request OTP for ${email} with purpose: ${purpose}`);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists for login purpose
    if (purpose === 'login') {
      const userExists = await User.findOne({ email });
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this email. Please register first.',
        });
      }
    }

    // Check if user already exists for registration
    if (purpose === 'registration') {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'User already exists. Please login instead.',
        });
      }
    }

    // Send OTP
    const result = await otpService.createAndSendOTP(email, purpose);

    res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${email}`,
      email,
    });
  } catch (error) {
    console.error('[Auth] Request OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP',
    });
  }
};

// @desc    Verify OTP and login/register
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTPAndLogin = async (req, res) => {
  try {
    const { email, otp, purpose, name, phone } = req.body;

    console.log('Verify OTP request:', { email, otp, purpose, name, phone });

    if (!email || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and purpose are required',
      });
    }

    // Verify OTP
    const verification = await otpService.verifyOTP(email, otp, purpose);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message,
      });
    }

    let user;

    if (purpose === 'registration') {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists. Please login.',
        });
      }

      // Create new user
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        phone: phone || '',
        isVerified: true,
        lastLogin: new Date(),
        loginCount: 1,
        role: 'customer' // Default role for registration
      });
      
      console.log(`[Auth] New user registered: ${email} with role: ${user.role}`);
    } else if (purpose === 'login') {
      // Find existing user
      user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found. Please register first.',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      // Update login info
      user.lastLogin = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();
      
      console.log(`[Auth] User logged in: ${email} with role: ${user.role}`);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid purpose',
      });
    }

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Return user with role
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      addresses: user.addresses,
      isVerified: user.isVerified,
    };

    console.log(`[Auth] User response:`, userResponse);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: userResponse,
    });
  } catch (error) {
    console.error('[Auth] Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify OTP',
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    console.log(`[Auth] Resend OTP for ${email}`);

    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email and purpose are required',
      });
    }

    const result = await otpService.resendOTP(email, purpose);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
    });
  } catch (error) {
    console.error('[Auth] Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend OTP',
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('[Auth] Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('wishlist')
      .populate('recentlyViewed.product');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};