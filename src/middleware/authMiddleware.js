const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check for token in cookies
    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.',
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('User not found for id:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      console.log('User account deactivated:', user.email);
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }
    
    console.log(`User authenticated: ${user.email} with role: ${user.role}`);
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    res.status(401).json({
      success: false,
      message: 'Not authorized. Please login.',
    });
  }
};

// Role-based authorization middleware
exports.authorize = (...roles) => {
  return (req, res, next) => {
    console.log(`Checking authorization. User role: ${req.user?.role}, Required roles: ${roles}`);
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    if (!roles.includes(req.user.role)) {
      console.log(`Authorization failed. User role ${req.user.role} not in ${roles}`);
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role}s are not authorized to access this route.`,
      });
    }
    
    console.log(`Authorization successful for role: ${req.user.role}`);
    next();
  };
};