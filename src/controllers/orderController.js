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
    const { id } = req.params;
    
    console.log('=== GET ORDER BY ID ===');
    console.log('Order ID:', id);
    console.log('Logged-in User ID:', req.user.id);
    console.log('Logged-in User Role:', req.user.role);
    
    const order = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name images brand slug');
    
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    console.log('Order found - User ID in order:', order.user._id.toString());
    console.log('Order user type:', typeof order.user._id);
    console.log('Request user type:', typeof req.user.id);
    console.log('Do they match?', order.user._id.toString() === req.user.id.toString());
    
    // Check if user owns order or is admin
    const isOwner = order.user._id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';
    
    console.log('Is owner:', isOwner);
    console.log('Is admin:', isAdmin);
    
    if (!isOwner && !isAdmin) {
      console.log('Authorization failed - User does not own this order');
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
    const { id } = req.params;
    
    console.log('=== CANCEL ORDER ===');
    console.log('Order ID:', id);
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    
    const order = await Order.findById(id);
    
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    console.log('Order user ID:', order.user.toString());
    console.log('Comparing:', order.user.toString() === req.user.id.toString());
    
    // Check if user owns order or is admin
    const isOwner = order.user.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      console.log('Not authorized - User does not own this order');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order. Order belongs to another user.'
      });
    }
    
    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.status)) {
      console.log('Order cannot be cancelled. Current status:', order.status);
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status}. Only pending, confirmed, or processing orders can be cancelled.`
      });
    }
    
    // Restore product stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 
          stock: item.quantity,
          soldCount: -item.quantity
        }
      });
    }
    
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by customer';
    
    await order.save();
    
    console.log('Order cancelled successfully');
    
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


// @desc    Create new order
// @route   POST /api/orders/create
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    // console.log('=== CREATE ORDER REQUEST ===');
    // console.log('Request body:', JSON.stringify(req.body, null, 2));
    // console.log('User ID:', req.user.id);
    
    const {
      shippingAddress,
      paymentMethod,
      orderItems,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountPrice,
      notes,
      collectionPoint
    } = req.body;

    // Detailed validation
    const errors = [];
    
    if (!paymentMethod) {
      errors.push('Payment method is required');
    }
    
    if (!orderItems || orderItems.length === 0) {
      errors.push('Order items are required');
    }
    
    if (!shippingAddress && !collectionPoint) {
      errors.push('Either shipping address or collection point is required');
    }

    if (errors.length > 0) {
      console.log('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Calculate total price
    const calculatedItemsPrice = itemsPrice || orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const calculatedTaxPrice = taxPrice || 0;
    const calculatedShippingPrice = shippingPrice || (collectionPoint ? (collectionPoint.fee || 0) : 110);
    const calculatedDiscountPrice = discountPrice || 0;
    const totalPrice = calculatedItemsPrice + calculatedTaxPrice + calculatedShippingPrice - calculatedDiscountPrice;

    // console.log('Price calculation:', {
    //   itemsPrice: calculatedItemsPrice,
    //   taxPrice: calculatedTaxPrice,
    //   shippingPrice: calculatedShippingPrice,
    //   discountPrice: calculatedDiscountPrice,
    //   totalPrice
    // });

    // Generate unique order ID
    const orderId = 'ORD-' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Prepare order data
    const orderData = {
      orderId,
      user: req.user.id,
      paymentMethod,
      orderItems: orderItems.map(item => {
        const mappedItem = {
          product: item.product,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity
        };
        if (item.seller && /^[0-9a-fA-F]{24}$/.test(item.seller.toString())) {
          mappedItem.seller = item.seller;
        }
        return mappedItem;
      }),
      itemsPrice: calculatedItemsPrice,
      taxPrice: calculatedTaxPrice,
      shippingPrice: calculatedShippingPrice,
      discountPrice: calculatedDiscountPrice,
      totalPrice,
      notes: notes || '',
      status: 'pending',
      createdAt: new Date()
    };

    // Add shipping address if provided
    if (shippingAddress) {
      orderData.shippingAddress = shippingAddress;
    }

    // Add collection point if selected
    if (collectionPoint) {
      orderData.collectionPoint = collectionPoint;
      orderData.deliveryType = 'pickup';
    }

    // console.log('Order data to save:', JSON.stringify(orderData, null, 2));

    // Create order
    const order = await Order.create(orderData);

    // console.log('Order created successfully:', order._id);

    // Update product stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 
          stock: -item.quantity,
          soldCount: item.quantity
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error details:', error);
    console.error('Error stack:', error.stack);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

