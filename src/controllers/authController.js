const User = require('../models/User');
const Seller = require('../models/Seller');
const jwt = require('jsonwebtoken');
const otpService = require('../utils/otpService');

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Generate Refresh Token
const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
};

const findUserByEmail = async (email) => {
  // First check in User collection (customers)
  let user = await User.findOne({ email });
  if (user) {
    return { user, source: 'user', role: user.role };
  }
  
  // Then check in Seller collection (sellers) - check email field only
  // Since sellers use 'email' field for login
  let seller = await Seller.findOne({ email: email });
  if (seller) {
    return { user: seller, source: 'seller', role: 'seller' };
  }
  
  return null;
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
      const found = await findUserByEmail(email);
      
      if (!found) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this email. Please register first.',
        });
      }
      
      console.log(`[Auth] User found in ${found.source} collection with role: ${found.role}`);
    }

    // Check if user already exists for registration
    if (purpose === 'registration') {
      const userExists = await User.findOne({ email });
      const sellerExists = await Seller.findOne({ email });
      
      if (userExists || sellerExists) {
        return res.status(400).json({
          success: false,
          message: 'User already exists. Please login instead.',
        });
      }
    }

    // Send OTP
    await otpService.createAndSendOTP(email, purpose);

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
    let userSource;
    let userRole;

    if (purpose === 'registration') {
      // REGISTRATION - Create new customer (not seller)
      const userExists = await User.findOne({ email });
      const sellerExists = await Seller.findOne({ email });
      
      if (userExists || sellerExists) {
        return res.status(400).json({
          success: false,
          message: 'User already exists. Please login.',
        });
      }

      // Create new customer
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        phone: phone || '',
        isVerified: true,
        lastLogin: new Date(),
        loginCount: 1,
        role: 'customer'
      });
      userSource = 'user';
      userRole = 'customer';
      
      console.log(`[Auth] New customer registered: ${email}`);
      
    } else if (purpose === 'login') {
      // LOGIN - Find existing user
      const found = await findUserByEmail(email);
      
      if (!found) {
        return res.status(404).json({
          success: false,
          message: 'User not found. Please register first.',
        });
      }
      
      user = found.user;
      userSource = found.source;
      userRole = found.role;
      
      // Check if user is active
      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      // Update last login
      user.lastLogin = new Date();
      if (userSource === 'user') {
        user.loginCount = (user.loginCount || 0) + 1;
      }
      await user.save();
      
      console.log(`[Auth] ${userSource === 'seller' ? 'Seller' : 'Customer'} logged in: ${email}`);
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid purpose',
      });
    }

    // Generate tokens
    const token = generateToken(user._id, userRole);
    const refreshToken = generateRefreshToken(user._id, userRole);

    // Prepare user response based on source
    let userResponse;
    if (userSource === 'seller') {
      userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'seller',
        phone: user.phone,
        profileImage: user.storeLogo || '',
        addresses: [],
        isVerified: user.verificationStatus === 'verified',
        storeName: user.storeName,
        storeSlug: user.storeSlug,
        storeLogo: user.storeLogo
      };
    } else {
      userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        addresses: user.addresses,
        isVerified: user.isVerified,
      };
    }

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
    
    let user = await User.findById(decoded.id);
    let userRole = 'customer';
    
    if (!user) {
      user = await Seller.findById(decoded.id);
      userRole = 'seller';
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const newToken = generateToken(user._id, userRole);
    const newRefreshToken = generateRefreshToken(user._id, userRole);

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
    let user = await User.findById(req.user.id)
      .select('-password')
      .populate('wishlist')
      .populate('recentlyViewed.product');
    
    let userSource = 'user';
    
    if (!user) {
      user = await Seller.findById(req.user.id);
      userSource = 'seller';
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
      source: userSource
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};