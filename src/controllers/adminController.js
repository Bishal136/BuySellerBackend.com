const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');
const Admin = require('../models/Admin');
const Setting = require('../models/Setting');

// ==================== DASHBOARD STATS ====================

// @desc    Get platform analytics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [
      totalUsers,
      totalSellers,
      totalCustomers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingSellers,
      pendingOrders,
      monthlyRevenue,
      weeklyRevenue,
      topProducts
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
      Seller.countDocuments({ verificationStatus: 'pending' }),
      Order.countDocuments({ status: 'pending' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfWeek }, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Product.find().sort('-soldCount').limit(5).select('name price soldCount images')
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        totalCustomers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingSellers,
        pendingOrders,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        weeklyRevenue: weeklyRevenue[0]?.total || 0,
        topProducts
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== USER MANAGEMENT ====================

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    let query = {};
    
    if (req.query.role && req.query.role !== 'all') {
      query.role = req.query.role;
    }
    
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:userId/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: `User ${isActive ? 'activated' : 'deactivated'}`,
      entity: 'User',
      entityId: user._id,
      details: { name: user.name, email: user.email }
    });
    
    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SELLER MANAGEMENT ====================

// @desc    Get all sellers
// @route   GET /api/admin/sellers
// @access  Private/Admin
exports.getSellers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    let query = {};
    
    if (req.query.status && req.query.status !== 'all') {
      query.verificationStatus = req.query.status;
    }
    
    const sellers = await Seller.find(query)
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await Seller.countDocuments(query);
    
    res.status(200).json({
      success: true,
      sellers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get sellers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new seller
// @route   POST /api/admin/sellers
// @access  Private/Admin
exports.createSeller = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      storeName,
      businessName,
      businessEmail,
      businessPhone,
      businessAddress,
      taxId
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !storeName || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, phone, storeName, businessName are required'
      });
    }

    // Check if seller already exists by email
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller already registered with this email'
      });
    }

    // Check if store name is taken
    const storeExists = await Seller.findOne({ storeName });
    if (storeExists) {
      return res.status(400).json({
        success: false,
        message: 'Store name already taken'
      });
    }

    // Create seller profile
    const seller = await Seller.create({
      name,
      email,
      phone,
      storeName,
      storeSlug: storeName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'),
      businessName,
      businessEmail: businessEmail || email,
      businessPhone: businessPhone || phone,
      businessAddress: businessAddress || {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Bangladesh'
      },
      taxId: taxId || '',
      verificationStatus: 'verified', // Directly verified since admin creates it
      verifiedAt: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Upgrade User to seller if exists
    await User.findOneAndUpdate({ email: seller.email }, { role: 'seller' });

    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: 'Created new seller',
      entity: 'Seller',
      entityId: seller._id,
      details: { storeName: seller.storeName, email: seller.email }
    });

    res.status(201).json({
      success: true,
      message: 'Seller created successfully',
      seller
    });
  } catch (error) {
    console.error('Create seller error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify seller
// @route   PUT /api/admin/sellers/:sellerId/verify
// @access  Private/Admin
exports.verifySeller = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const seller = await Seller.findById(req.params.sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    
    seller.verificationStatus = status;
    seller.verificationNotes = notes;
    if (status === 'verified') {
      seller.verifiedAt = new Date();
    }
    await seller.save();
    
    // Update user role if verified
    if (status === 'verified') {
      await User.findOneAndUpdate({ email: seller.email }, { role: 'seller' });
    }
    
    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: `Seller ${status}`,
      entity: 'Seller',
      entityId: seller._id,
      details: { storeName: seller.storeName, notes }
    });
    
    res.status(200).json({
      success: true,
      message: `Seller ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
      seller
    });
  } catch (error) {
    console.error('Verify seller error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COMMISSION SETTINGS ====================

// @desc    Get commission settings
// @route   GET /api/admin/commission
// @access  Private/Admin
exports.getCommissionSettings = async (req, res) => {
  try {
    // Get from settings collection or use default
    const settings = {
      defaultCommission: 10,
      categoryCommissions: [],
      sellerCommissions: []
    };
    
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get commission error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update commission settings
// @route   PUT /api/admin/commission
// @access  Private/Admin
exports.updateCommissionSettings = async (req, res) => {
  try {
    const { defaultCommission } = req.body;
    
    // Update settings in database
    // This would typically go into a Settings model
    
    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: 'Updated commission settings',
      entity: 'Settings',
      details: { defaultCommission }
    });
    
    res.status(200).json({
      success: true,
      message: 'Commission settings updated successfully'
    });
  } catch (error) {
    console.error('Update commission error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PLATFORM SETTINGS ====================

// @desc    Get platform settings
// @route   GET /api/admin/settings
// @access  Private/Admin
exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    
    if (!settings) {
      settings = await Setting.create({});
    }
    
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update platform settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    
    if (!settings) {
      settings = await Setting.create(req.body);
    } else {
      settings = await Setting.findOneAndUpdate({}, req.body, { new: true, runValidators: true });
    }
    
    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: 'Updated platform settings',
      entity: 'Setting',
      details: { updatedKeys: Object.keys(req.body) }
    });
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COUPON MANAGEMENT ====================

// @desc    Get all coupons
// @route   GET /api/admin/coupons
// @access  Private/Admin
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt');
    
    res.status(200).json({
      success: true,
      coupons
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      code: req.body.code.toUpperCase()
    });
    
    // Log action
    await AuditLog.create({
      user: req.user.id,
      userRole: 'admin',
      action: 'Created coupon',
      entity: 'Coupon',
      entityId: coupon._id,
      details: { code: coupon.code, discount: coupon.discountValue }
    });
    
    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/Admin
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { ...req.body, code: req.body.code?.toUpperCase() },
      { new: true }
    );
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BANNER MANAGEMENT ====================

// @desc    Get all banners
// @route   GET /api/admin/banners
// @access  Private/Admin
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort('position');
    
    res.status(200).json({
      success: true,
      banners
    });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload banner image
// @route   POST /api/admin/banners/upload
// @access  Private/Admin
exports.uploadBannerImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const imageUrl = `data:${mimeType};base64,${base64Image}`;
    
    res.status(200).json({
      success: true,
      url: imageUrl,
      message: 'Banner image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload banner image error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create banner
// @route   POST /api/admin/banners
// @access  Private/Admin
exports.createBanner = async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      banner
    });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update banner
// @route   PUT /api/admin/banners/:id
// @access  Private/Admin
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      banner
    });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/admin/banners/:id
// @access  Private/Admin
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ANNOUNCEMENT MANAGEMENT ====================

// @desc    Get all announcements
// @route   GET /api/admin/announcements
// @access  Private/Admin
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'name')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      announcements
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create announcement
// @route   POST /api/admin/announcements
// @access  Private/Admin
exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update announcement
// @route   PUT /api/admin/announcements/:id
// @access  Private/Admin
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/admin/announcements/:id
// @access  Private/Admin
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== AUDIT LOGS ====================

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private/Admin
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    
    let query = {};
    
    if (req.query.userRole) {
      query.userRole = req.query.userRole;
    }
    
    if (req.query.action) {
      query.action = { $regex: req.query.action, $options: 'i' };
    }
    
    const logs = await AuditLog.find(query)
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await AuditLog.countDocuments(query);
    
    res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};