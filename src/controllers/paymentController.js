const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Mock bKash API (Replace with actual bKash API integration)
const bkashConfig = {
  baseURL: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
  appKey: process.env.BKASH_APP_KEY,
  appSecret: process.env.BKASH_APP_SECRET,
  username: process.env.BKASH_USERNAME,
  password: process.env.BKASH_PASSWORD
};

// Mock Nagad API (Replace with actual Nagad API integration)
const nagadConfig = {
  baseURL: process.env.NAGAD_BASE_URL || 'https://sandbox.mynagad.com/api/dfs',
  merchantId: process.env.NAGAD_MERCHANT_ID,
  merchantKey: process.env.NAGAD_MERCHANT_KEY
};

// @desc    Create order
// @route   POST /api/orders/create
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      paymentMethod,
      orderItems,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountPrice,
      totalPrice,
      coupon,
      notes
    } = req.body;

    // Validate order items
    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No order items'
      });
    }

    // Create order
    const order = await Order.create({
      user: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      discountPrice,
      totalPrice,
      coupon,
      notes,
      status: 'pending',
      isPaid: false
    });

    // Clear user's cart after order creation
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { items: [], coupon: null },
      { new: true }
    );

    res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Initialize bKash payment
// @route   POST /api/payment/bkash/init
// @access  Private
exports.initiateBkashPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Generate bKash payment token (Mock implementation)
    // In production, you would call bKash API to get token
    const paymentId = 'BKASH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store payment details in order
    order.paymentResult = {
      method: 'bkash',
      paymentId: paymentId,
      status: 'pending',
      amount: amount
    };
    await order.save();

    // Return bKash payment URL or data
    res.status(200).json({
      success: true,
      paymentId: paymentId,
      bkashURL: `https://sandbox.bkash.com/payment?paymentId=${paymentId}`,
      orderId: order._id,
      amount: amount
    });
  } catch (error) {
    console.error('Initiate bKash payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Confirm bKash payment
// @route   POST /api/payment/bkash/confirm
// @access  Private
exports.confirmBkashPayment = async (req, res) => {
  try {
    const { orderId, paymentId, transactionId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify payment with bKash API (Mock)
    // In production, call bKash API to verify payment
    
    // Update order payment status
    order.paymentResult.status = 'completed';
    order.paymentResult.transactionId = transactionId;
    order.paymentResult.paidAt = new Date();
    order.isPaid = true;
    order.paidAt = new Date();
    order.status = 'confirmed';

    await order.save();

    // Send email confirmation
    const user = await User.findById(order.user);
    if (user) {
      await sendOrderConfirmationEmail(user.email, order);
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      order
    });
  } catch (error) {
    console.error('Confirm bKash payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Initialize Nagad payment
// @route   POST /api/payment/nagad/init
// @access  Private
exports.initiateNagadPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Generate Nagad payment ID (Mock implementation)
    const paymentId = 'NAGAD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store payment details in order
    order.paymentResult = {
      method: 'nagad',
      paymentId: paymentId,
      status: 'pending',
      amount: amount
    };
    await order.save();

    // Return Nagad payment URL or data
    res.status(200).json({
      success: true,
      paymentId: paymentId,
      nagadURL: `https://sandbox.nagad.com/payment?paymentId=${paymentId}`,
      orderId: order._id,
      amount: amount
    });
  } catch (error) {
    console.error('Initiate Nagad payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Confirm Nagad payment
// @route   POST /api/payment/nagad/confirm
// @access  Private
exports.confirmNagadPayment = async (req, res) => {
  try {
    const { orderId, paymentId, transactionId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify payment with Nagad API (Mock)
    // In production, call Nagad API to verify payment
    
    // Update order payment status
    order.paymentResult.status = 'completed';
    order.paymentResult.transactionId = transactionId;
    order.paymentResult.paidAt = new Date();
    order.isPaid = true;
    order.paidAt = new Date();
    order.status = 'confirmed';

    await order.save();

    // Send email confirmation
    const user = await User.findById(order.user);
    if (user) {
      await sendOrderConfirmationEmail(user.email, order);
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      order
    });
  } catch (error) {
    console.error('Confirm Nagad payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Cash on Delivery order
// @route   POST /api/payment/cod/confirm
// @access  Private
exports.confirmCashOnDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order for COD
    order.paymentResult = {
      method: 'cash_on_delivery',
      status: 'pending',
      amount: order.totalPrice
    };
    order.status = 'confirmed';
    order.isPaid = false;

    await order.save();

    // Send email confirmation
    const user = await User.findById(order.user);
    if (user) {
      await sendOrderConfirmationEmail(user.email, order);
    }

    res.status(200).json({
      success: true,
      message: 'Order placed successfully',
      order
    });
  } catch (error) {
    console.error('COD order error:', error);
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
      .populate('user', 'name email')
      .populate('orderItems.product', 'name images');

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
        message: 'Not authorized'
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

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort('-createdAt')
      .populate('orderItems.product', 'name images');

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to send order confirmation email
async function sendOrderConfirmationEmail(email, order) {
  const subject = `Order Confirmation - #${order._id}`;
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Order Confirmation</h2>
      <p>Dear ${order.shippingAddress.name},</p>
      <p>Thank you for your order! Your order has been confirmed.</p>
      
      <h3>Order Details:</h3>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
      <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
      <p><strong>Total Amount:</strong> $${order.totalPrice.toFixed(2)}</p>
      
      <h3>Shipping Address:</h3>
      <p>${order.shippingAddress.name}<br>
      ${order.shippingAddress.street}<br>
      ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
      ${order.shippingAddress.country}<br>
      Phone: ${order.shippingAddress.phone}</p>
      
      <h3>Order Items:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr><th style="text-align: left; padding: 8px; background-color: #f3f4f6;">Product</th>
            <th style="text-align: left; padding: 8px; background-color: #f3f4f6;">Quantity</th>
            <th style="text-align: left; padding: 8px; background-color: #f3f4f6;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${order.orderItems.map(item => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${item.price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p style="margin-top: 20px;">You can track your order status in your account dashboard.</p>
      <p>Thank you for shopping with us!</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 12px;">ShopHub - Your trusted ecommerce platform</p>
    </div>
  `;

  await sendEmail({ email, subject, message });
}