const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const sendEmail = require('../utils/sendEmail');
const PDFDocument = require('pdfkit');

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
exports.getUserOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    let query = { user: req.user.id };
    
    // Filter by status
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }
    
    const orders = await Order.find(query)
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex)
      .populate('orderItems.product', 'name images slug brand');
    
    const total = await Order.countDocuments(query);
    
    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: startIndex + limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name images brand slug');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user owns order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user owns order
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status}`
      });
    }
    
    // Restore product stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, soldCount: -item.quantity }
      });
    }
    
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Request return/refund
// @route   POST /api/orders/:id/return
// @access  Private
exports.requestReturn = async (req, res) => {
  try {
    const { reason, itemId, quantity, comments } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user owns order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Order must be delivered to request return'
      });
    }
    
    const item = order.orderItems.find(i => i._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in order'
      });
    }
    
    // Create return request
    order.returnRequest = {
      items: [{
        itemId: itemId,
        product: item.product,
        quantity: quantity,
        price: item.price,
        reason: reason
      }],
      comments: comments || '',
      status: 'pending',
      requestedAt: new Date(),
      refundAmount: item.price * quantity
    };
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully',
      returnRequest: order.returnRequest
    });
  } catch (error) {
    console.error('Return request error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Track order status
// @route   GET /api/orders/:id/track
// @access  Private
exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const timeline = [
      {
        status: 'Order Placed',
        completed: true,
        timestamp: order.createdAt,
        description: 'Your order has been placed successfully'
      },
      {
        status: 'Order Confirmed',
        completed: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status),
        timestamp: order.confirmedAt,
        description: 'Your order has been confirmed and is being processed'
      },
      {
        status: 'Processing',
        completed: ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status),
        timestamp: order.processingAt,
        description: 'Your order is being prepared for shipment'
      },
      {
        status: 'Shipped',
        completed: ['shipped', 'out_for_delivery', 'delivered'].includes(order.status),
        timestamp: order.shippedAt,
        description: order.trackingNumber 
          ? `Your order has been shipped via ${order.carrier}. Tracking #: ${order.trackingNumber}`
          : 'Your order has been shipped',
        trackingNumber: order.trackingNumber,
        carrier: order.carrier
      },
      {
        status: 'Out for Delivery',
        completed: ['out_for_delivery', 'delivered'].includes(order.status),
        timestamp: order.outForDeliveryAt,
        description: 'Your order is out for delivery'
      },
      {
        status: 'Delivered',
        completed: order.status === 'delivered',
        timestamp: order.deliveredAt,
        description: 'Your order has been delivered'
      }
    ];
    
    res.status(200).json({
      success: true,
      tracking: {
        status: order.status,
        estimatedDelivery: order.estimatedDelivery,
        timeline: timeline
      }
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Download invoice PDF
// @route   GET /api/orders/:id/invoice
// @access  Private
exports.downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name brand sku');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Simple text response for now (PDF generation can be added later)
    res.status(200).json({
      success: true,
      message: 'Invoice download feature coming soon',
      orderId: order._id
    });
  } catch (error) {
    console.error('Invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats/summary
// @access  Private
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { user: req.user._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalPrice' }
      }}
    ]);
    
    const statusMap = {};
    stats.forEach(stat => {
      statusMap[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
    });
    
    res.status(200).json({
      success: true,
      stats: {
        pending: statusMap.pending || { count: 0, amount: 0 },
        confirmed: statusMap.confirmed || { count: 0, amount: 0 },
        shipped: statusMap.shipped || { count: 0, amount: 0 },
        delivered: statusMap.delivered || { count: 0, amount: 0 },
        cancelled: statusMap.cancelled || { count: 0, amount: 0 },
        totalOrders: await Order.countDocuments({ user: req.user._id }),
        totalSpent: await Order.aggregate([
          { $match: { user: req.user._id, status: 'delivered' } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]).then(res => res[0]?.total || 0)
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};