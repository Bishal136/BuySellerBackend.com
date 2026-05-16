const Notification = require('../models/Notification');
const PriceAlert = require('../models/PriceAlert');
const StockAlert = require('../models/StockAlert');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    const query = { user: req.user.id, isDeleted: false };
    
    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    // Filter by read status
    if (req.query.isRead === 'true') {
      query.isRead = true;
    } else if (req.query.isRead === 'false') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex)
      .populate('data.orderId', '_id status totalPrice')
      .populate('data.productId', 'name price images slug');
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false, 
      isDeleted: false 
    });
    
    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isDeleted: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete all notifications
// @route   DELETE /api/notifications/delete-all
// @access  Private
exports.deleteAllNotifications = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id },
      { isDeleted: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications deleted'
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create price alert
// @route   POST /api/notifications/price-alert
// @access  Private
exports.createPriceAlert = async (req, res) => {
  try {
    const { productId, targetPrice } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if alert already exists
    let alert = await PriceAlert.findOne({
      user: req.user.id,
      product: productId,
      status: 'active'
    });
    
    if (alert) {
      // Update existing alert
      alert.targetPrice = targetPrice;
      alert.currentPrice = product.price;
      await alert.save();
    } else {
      // Create new alert
      alert = await PriceAlert.create({
        user: req.user.id,
        product: productId,
        targetPrice,
        currentPrice: product.price
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Price alert created successfully',
      alert
    });
  } catch (error) {
    console.error('Create price alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create back in stock alert
// @route   POST /api/notifications/stock-alert
// @access  Private
exports.createStockAlert = async (req, res) => {
  try {
    const { productId } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if alert already exists
    let alert = await StockAlert.findOne({
      user: req.user.id,
      product: productId,
      status: 'active'
    });
    
    if (alert) {
      return res.status(400).json({
        success: false,
        message: 'Stock alert already exists for this product'
      });
    }
    
    alert = await StockAlert.create({
      user: req.user.id,
      product: productId
    });
    
    res.status(200).json({
      success: true,
      message: 'You will be notified when this product is back in stock',
      alert
    });
  } catch (error) {
    console.error('Create stock alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user price alerts
// @route   GET /api/notifications/price-alerts
// @access  Private
exports.getPriceAlerts = async (req, res) => {
  try {
    const alerts = await PriceAlert.find({
      user: req.user.id,
      status: 'active'
    }).populate('product', 'name price images slug');
    
    res.status(200).json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Get price alerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user stock alerts
// @route   GET /api/notifications/stock-alerts
// @access  Private
exports.getStockAlerts = async (req, res) => {
  try {
    const alerts = await StockAlert.find({
      user: req.user.id,
      status: 'active'
    }).populate('product', 'name price images slug stock');
    
    res.status(200).json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Get stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete price alert
// @route   DELETE /api/notifications/price-alert/:id
// @access  Private
exports.deletePriceAlert = async (req, res) => {
  try {
    await PriceAlert.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Price alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete price alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete stock alert
// @route   DELETE /api/notifications/stock-alert/:id
// @access  Private
exports.deleteStockAlert = async (req, res) => {
  try {
    await StockAlert.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Stock alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete stock alert error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
