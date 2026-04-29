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

// ============== Utility Functions for Creating Notifications ==============

// Create order status notification
exports.createOrderNotification = async (userId, orderId, status) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;
    
    const statusMessages = {
      confirmed: {
        title: 'Order Confirmed',
        message: `Your order #${orderId.slice(-8)} has been confirmed successfully.`
      },
      shipped: {
        title: 'Order Shipped',
        message: `Great news! Your order #${orderId.slice(-8)} has been shipped.`
      },
      out_for_delivery: {
        title: 'Out for Delivery',
        message: `Your order #${orderId.slice(-8)} is out for delivery!`
      },
      delivered: {
        title: 'Order Delivered',
        message: `Your order #${orderId.slice(-8)} has been delivered. Hope you enjoy your purchase!`
      },
      cancelled: {
        title: 'Order Cancelled',
        message: `Your order #${orderId.slice(-8)} has been cancelled.`
      }
    };
    
    const statusInfo = statusMessages[status];
    if (!statusInfo) return;
    
    await Notification.create({
      user: userId,
      type: 'order',
      title: statusInfo.title,
      message: statusInfo.message,
      data: { orderId },
      link: `/orders/${orderId}`
    });
    
    // Also send email notification
    const user = await User.findById(userId);
    if (user && user.email) {
      await sendOrderStatusEmail(user.email, order, status);
    }
  } catch (error) {
    console.error('Create order notification error:', error);
  }
};

// Check and trigger price drop alerts
exports.checkPriceDrops = async () => {
  try {
    const activeAlerts = await PriceAlert.find({ status: 'active' })
      .populate('product');
    
    for (const alert of activeAlerts) {
      const product = alert.product;
      if (!product) continue;
      
      // Check if price dropped below target
      if (product.price <= alert.targetPrice && product.price < alert.currentPrice) {
        // Create notification
        await Notification.create({
          user: alert.user,
          type: 'price_drop',
          title: 'Price Drop Alert! 🎉',
          message: `${product.name} is now $${product.price} (was $${alert.currentPrice}). Save $${(alert.currentPrice - product.price).toFixed(2)}!`,
          data: {
            productId: product._id,
            oldPrice: alert.currentPrice,
            newPrice: product.price,
            discount: alert.currentPrice - product.price
          },
          link: `/product/${product.slug || product._id}`
        });
        
        // Mark alert as triggered
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        alert.notifiedAt = new Date();
        await alert.save();
        
        // Send email notification
        const user = await User.findById(alert.user);
        if (user && user.email) {
          await sendPriceDropEmail(user.email, product, alert.currentPrice);
        }
      } else {
        // Update current price
        alert.currentPrice = product.price;
        await alert.save();
      }
    }
  } catch (error) {
    console.error('Check price drops error:', error);
  }
};

// Check and trigger back in stock notifications
exports.checkBackInStock = async () => {
  try {
    const activeAlerts = await StockAlert.find({ status: 'active' })
      .populate('product');
    
    for (const alert of activeAlerts) {
      const product = alert.product;
      if (!product) continue;
      
      // Check if product is back in stock (was out, now has stock)
      if (product.stock > 0 && alert.product.stock === 0) {
        // Create notification
        await Notification.create({
          user: alert.user,
          type: 'back_in_stock',
          title: 'Back in Stock! 🔔',
          message: `Good news! ${product.name} is back in stock. Don't miss out!`,
          data: {
            productId: product._id,
            stock: product.stock
          },
          link: `/product/${product.slug || product._id}`
        });
        
        // Mark alert as notified
        alert.status = 'notified';
        alert.notifiedAt = new Date();
        await alert.save();
        
        // Send email notification
        const user = await User.findById(alert.user);
        if (user && user.email) {
          await sendBackInStockEmail(user.email, product);
        }
      }
    }
  } catch (error) {
    console.error('Check back in stock error:', error);
  }
};

// Create promotional notification
exports.createPromotionalNotification = async (userId, title, message, couponCode = null) => {
  try {
    const notificationData = {
      user: userId,
      type: 'promotion',
      title: title,
      message: message,
      link: '/products'
    };
    
    if (couponCode) {
      notificationData.data = { couponCode };
      notificationData.message += ` Use code: ${couponCode}`;
    }
    
    await Notification.create(notificationData);
  } catch (error) {
    console.error('Create promotional notification error:', error);
  }
};

// Send bulk promotional notifications
exports.sendBulkPromotion = async (userIds, title, message, couponCode = null) => {
  try {
    const notifications = userIds.map(userId => ({
      user: userId,
      type: 'promotion',
      title: title,
      message: couponCode ? `${message} Use code: ${couponCode}` : message,
      data: couponCode ? { couponCode } : {},
      link: '/products'
    }));
    
    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Send bulk promotion error:', error);
  }
};

// Email helper functions
async function sendOrderStatusEmail(email, order, status) {
  const statusMessages = {
    confirmed: 'Your order has been confirmed',
    shipped: 'Your order has been shipped',
    delivered: 'Your order has been delivered'
  };
  
  const subject = `Order ${status.toUpperCase()} - #${order._id}`;
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Order ${status.toUpperCase()}</h2>
      <p>Dear ${order.shippingAddress.name},</p>
      <p>${statusMessages[status] || `Your order status has been updated to ${status}`}.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Total Amount:</strong> $${order.totalPrice.toFixed(2)}</p>
      <a href="${process.env.FRONTEND_URL}/orders/${order._id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
    </div>
  `;
  await sendEmail({ email, subject, message });
}

async function sendPriceDropEmail(email, product, oldPrice) {
  const subject = `Price Drop Alert: ${product.name}`;
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Price Drop Alert! 🎉</h2>
      <p>A product in your wishlist has dropped in price!</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">
        <h3>${product.name}</h3>
        <p>Old Price: <del>$${oldPrice.toFixed(2)}</del></p>
        <p>New Price: <strong style="color: #10b981;">$${product.price.toFixed(2)}</strong></p>
        <p>You save: <strong>$${(oldPrice - product.price).toFixed(2)}</strong></p>
      </div>
      <a href="${process.env.FRONTEND_URL}/product/${product.slug || product._id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">Shop Now</a>
    </div>
  `;
  await sendEmail({ email, subject, message });
}

async function sendBackInStockEmail(email, product) {
  const subject = `Back in Stock: ${product.name}`;
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Back in Stock! 🔔</h2>
      <p>Good news! A product you've been waiting for is back in stock.</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">
        <h3>${product.name}</h3>
        <p>Price: <strong>$${product.price.toFixed(2)}</strong></p>
        <p>Stock: ${product.stock} units available</p>
      </div>
      <a href="${process.env.FRONTEND_URL}/product/${product.slug || product._id}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;">Shop Now</a>
    </div>
  `;
  await sendEmail({ email, subject, message });
}