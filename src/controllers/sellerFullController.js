const Product = require('../models/Product');
const Order = require('../models/Order');
const Seller = require('../models/Seller');
const StockLog = require('../models/StockLog');
const Message = require('../models/Message');
const Dispute = require('../models/Dispute');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');

// ==================== INVENTORY MANAGEMENT ====================

// @desc    Get all products with stock status
// @route   GET /api/seller/inventory
// @access  Private/Seller
exports.getInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    let query = { seller: req.user.id };
    
    // Filter by stock status
    if (req.query.stockStatus === 'low') {
      query.stock = { $lte: 10, $gt: 0 };
    } else if (req.query.stockStatus === 'out') {
      query.stock = 0;
    } else if (req.query.stockStatus === 'instock') {
      query.stock = { $gt: 0 };
    }
    
    // Search
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }
    
    const products = await Product.find(query)
      .select('name sku stock price images status')
      .sort('stock')
      .limit(limit)
      .skip(startIndex);
    
    const total = await Product.countDocuments(query);
    
    // Get stock statistics
    const stats = {
      totalProducts: await Product.countDocuments({ seller: req.user.id }),
      lowStock: await Product.countDocuments({ seller: req.user.id, stock: { $lte: 10, $gt: 0 } }),
      outOfStock: await Product.countDocuments({ seller: req.user.id, stock: 0 }),
      totalValue: await Product.aggregate([
        { $match: { seller: req.user._id } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$stock'] } } } }
      ]).then(res => res[0]?.total || 0)
    };
    
    res.status(200).json({
      success: true,
      products,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk update stock
// @route   PUT /api/seller/inventory/bulk-stock
// @access  Private/Seller
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates, reason, note } = req.body;
    const results = [];
    
    for (const update of updates) {
      const product = await Product.findOne({
        _id: update.productId,
        seller: req.user.id
      });
      
      if (product) {
        const previousStock = product.stock;
        product.stock = update.newStock;
        await product.save();
        
        // Create stock log
        await StockLog.create({
          seller: req.user.id,
          product: product._id,
          previousStock,
          newStock: update.newStock,
          adjustment: update.newStock - previousStock,
          reason: reason || 'manual',
          note
        });
        
        results.push({
          productId: update.productId,
          name: product.name,
          success: true,
          previousStock,
          newStock: update.newStock
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `${results.filter(r => r.success).length} products updated`,
      results
    });
  } catch (error) {
    console.error('Bulk stock update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get stock adjustment logs
// @route   GET /api/seller/stock-logs
// @access  Private/Seller
exports.getStockLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    
    const logs = await StockLog.find({ seller: req.user.id })
      .populate('product', 'name sku')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await StockLog.countDocuments({ seller: req.user.id });
    
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
    console.error('Get stock logs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ORDER MANAGEMENT ====================

// @desc    Get all seller orders with filtering
// @route   GET /api/seller/orders
// @access  Private/Seller
exports.getSellerOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    // Get seller's products
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    
    let query = { 'orderItems.product': { $in: productIds } };
    
    // Filter by status
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }
    
    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    const orders = await Order.find(query)
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name images');
    
    // Format orders for seller view
    const formattedOrders = orders.map(order => {
      const sellerItems = order.orderItems.filter(item => 
        productIds.includes(item.product._id)
      );
      
      return {
        _id: order._id,
        orderId: order._id,
        customer: order.user,
        items: sellerItems,
        totalAmount: sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier
      };
    });
    
    const total = orders.length;
    
    res.status(200).json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order details for seller
// @route   GET /api/seller/orders/:orderId
// @access  Private/Seller
exports.getSellerOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name images sku brand');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Verify seller has products in this order
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    const sellerItems = order.orderItems.filter(item => 
      productIds.includes(item.product._id)
    );
    
    if (sellerItems.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    res.status(200).json({
      success: true,
      order: {
        ...order.toObject(),
        sellerItems
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/seller/orders/:orderId/status
// @access  Private/Seller
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, carrier } = req.body;
    
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Verify seller has products in this order
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    const hasSellerProducts = order.orderItems.some(item => 
      productIds.includes(item.product)
    );
    
    if (!hasSellerProducts) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrier) order.carrier = carrier;
    
    // Set status timestamps
    switch(status) {
      case 'confirmed':
        order.confirmedAt = new Date();
        break;
      case 'shipped':
        order.shippedAt = new Date();
        break;
      case 'delivered':
        order.deliveredAt = new Date();
        order.isDelivered = true;
        break;
      case 'cancelled':
        order.cancelledAt = new Date();
        break;
    }
    
    await order.save();
    
    // Send notification to customer
    const Notification = require('../models/Notification');
    await Notification.create({
      user: order.user,
      type: 'order',
      title: `Order ${status.toUpperCase()}`,
      message: `Your order #${order._id.toString().slice(-8)} status has been updated to ${status}`,
      data: { orderId: order._id },
      link: `/orders/${order._id}`
    });
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process return request
// @route   PUT /api/seller/orders/:orderId/return
// @access  Private/Seller
exports.processReturn = async (req, res) => {
  try {
    const { action, refundAmount, adminComments } = req.body;
    
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (!order.returnRequest) {
      return res.status(400).json({ success: false, message: 'No return request found' });
    }
    
    if (action === 'approve') {
      order.returnRequest.status = 'approved';
      order.returnRequest.approvedAt = new Date();
      order.returnRequest.refundAmount = refundAmount || order.returnRequest.refundAmount;
      order.returnRequest.adminComments = adminComments;
      order.status = 'refunded';
    } else if (action === 'reject') {
      order.returnRequest.status = 'rejected';
      order.returnRequest.rejectedAt = new Date();
      order.returnRequest.adminComments = adminComments;
    }
    
    await order.save();
    
    // Send notification to customer
    const Notification = require('../models/Notification');
    await Notification.create({
      user: order.user,
      type: 'order',
      title: `Return Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Your return request for order #${order._id.toString().slice(-8)} has been ${action === 'approve' ? 'approved' : 'rejected'}`,
      data: { orderId: order._id },
      link: `/orders/${order._id}`
    });
    
    res.status(200).json({
      success: true,
      message: `Return request ${action}d successfully`,
      order
    });
  } catch (error) {
    console.error('Process return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate shipping label
// @route   POST /api/seller/orders/:orderId/shipping-label
// @access  Private/Seller
exports.generateShippingLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Create PDF shipping label
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shipping-label-${order._id}.pdf`);
    
    doc.pipe(res);
    
    // Shipping Label Content
    doc.fontSize(16).font('Helvetica-Bold').text('SHIPPING LABEL', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica-Bold').text('FROM:');
    doc.fontSize(10).font('Helvetica');
    const seller = await Seller.findOne({ user: req.user.id });
    doc.text(seller?.storeName || 'Seller Store');
    doc.text(seller?.businessAddress?.street || '');
    doc.text(`${seller?.businessAddress?.city || ''}, ${seller?.businessAddress?.state || ''} ${seller?.businessAddress?.postalCode || ''}`);
    doc.text(seller?.businessAddress?.country || '');
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica-Bold').text('TO:');
    doc.fontSize(10).font('Helvetica');
    doc.text(order.shippingAddress.name);
    doc.text(order.shippingAddress.street);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`);
    doc.text(order.shippingAddress.country);
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica-Bold').text('ORDER DETAILS:');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Order ID: ${order._id}`);
    doc.text(`Tracking #: ${order.trackingNumber || 'N/A'}`);
    doc.text(`Carrier: ${order.carrier || 'N/A'}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    
    doc.end();
  } catch (error) {
    console.error('Generate shipping label error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORTS & ANALYTICS ====================

// @desc    Get revenue reports
// @route   GET /api/seller/reports/revenue
// @access  Private/Seller
exports.getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    
    let dateFormat;
    switch(groupBy) {
      case 'day': dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }; break;
      case 'month': dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } }; break;
      case 'year': dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } }; break;
      default: dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }
    
    const revenueData = await Order.aggregate([
      {
        $match: {
          'orderItems.product': { $in: productIds },
          status: 'delivered',
          ...(startDate && endDate && { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } })
        }
      },
      {
        $group: {
          _id: dateFormat,
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalPrice' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Get product performance
    const productPerformance = await Order.aggregate([
      {
        $match: {
          'orderItems.product': { $in: productIds },
          status: 'delivered'
        }
      },
      { $unwind: '$orderItems' },
      {
        $match: {
          'orderItems.product': { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$orderItems.product',
          totalSold: { $sum: '$orderItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);
    
    // Populate product details
    const populatedProducts = await Product.populate(productPerformance, {
      path: '_id',
      select: 'name price images'
    });
    
    res.status(200).json({
      success: true,
      revenueData,
      productPerformance: populatedProducts,
      summary: {
        totalRevenue: revenueData.reduce((sum, d) => sum + d.revenue, 0),
        totalOrders: revenueData.reduce((sum, d) => sum + d.orders, 0),
        avgOrderValue: revenueData.length > 0 ? revenueData.reduce((sum, d) => sum + d.avgOrderValue, 0) / revenueData.length : 0
      }
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export report to CSV
// @route   GET /api/seller/reports/export
// @access  Private/Seller
exports.exportReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    
    let data = [];
    
    if (type === 'orders') {
      const orders = await Order.find({
        'orderItems.product': { $in: productIds },
        ...(startDate && endDate && { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } })
      }).populate('user', 'name email');
      
      data = orders.map(order => ({
        'Order ID': order._id,
        'Customer Name': order.user?.name,
        'Customer Email': order.user?.email,
        'Total Amount': order.totalPrice,
        'Status': order.status,
        'Payment Method': order.paymentMethod,
        'Date': order.createdAt.toLocaleDateString()
      }));
    } else if (type === 'products') {
      data = products.map(product => ({
        'Product Name': product.name,
        'SKU': product.sku,
        'Price': product.price,
        'Stock': product.stock,
        'Total Sold': product.soldCount,
        'Status': product.status
      }));
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type === 'orders' ? 'Orders' : 'Products');
    
    if (data.length > 0) {
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key: key,
        width: 20
      }));
      
      worksheet.addRows(data);
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COMMUNICATION ====================

// @desc    Send message to customer
// @route   POST /api/seller/messages
// @access  Private/Seller
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, orderId, subject, message, attachments } = req.body;
    
    const customer = await User.findById(receiverId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    const newMessage = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      order: orderId,
      subject,
      message,
      attachments: attachments || []
    });
    
    // Send email notification to customer
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: customer.email,
      subject: `New message from seller regarding order #${orderId?.slice(-8)}`,
      message: `<p>You have a new message from the seller.</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong> ${message}</p><a href="${process.env.FRONTEND_URL}/messages/${newMessage._id}">View Message</a>`
    });
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get messages
// @route   GET /api/seller/messages
// @access  Private/Seller
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, isDeletedBySender: false },
        { receiver: req.user.id, isDeletedByReceiver: false }
      ]
    })
      .populate('sender', 'name')
      .populate('receiver', 'name')
      .populate('order', '_id')
      .sort('-createdAt')
      .limit(50);
    
    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DISPUTES ====================

// @desc    Get disputes
// @route   GET /api/seller/disputes
// @access  Private/Seller
exports.getDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find({ seller: req.user.id })
      .populate('customer', 'name email')
      .populate('order', '_id totalPrice')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      disputes
    });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update dispute resolution
// @route   PUT /api/seller/disputes/:disputeId
// @access  Private/Seller
exports.updateDispute = async (req, res) => {
  try {
    const { resolution, resolutionNotes, resolutionAmount } = req.body;
    
    const dispute = await Dispute.findOne({
      _id: req.params.disputeId,
      seller: req.user.id
    });
    
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }
    
    dispute.status = 'resolved';
    dispute.resolution = resolution;
    dispute.resolutionNotes = resolutionNotes;
    dispute.resolutionAmount = resolutionAmount;
    dispute.resolvedAt = new Date();
    
    await dispute.save();
    
    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully',
      dispute
    });
  } catch (error) {
    console.error('Update dispute error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STORE SETTINGS ====================

// @desc    Update store settings
// @route   PUT /api/seller/store-settings
// @access  Private/Seller
exports.updateStoreSettings = async (req, res) => {
  try {
    const { storeLogo, storeBanner, storeDescription, policies, shippingZones, taxSettings, payoutSettings } = req.body;
    
    const seller = await Seller.findOne({ user: req.user.id });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    
    if (storeLogo) seller.storeLogo = storeLogo;
    if (storeBanner) seller.storeBanner = storeBanner;
    if (storeDescription) seller.storeDescription = storeDescription;
    if (policies) {
      if (policies.returnPolicy) seller.settings.returnPolicy = policies.returnPolicy;
      if (policies.shippingPolicy) seller.settings.shippingPolicy = policies.shippingPolicy;
    }
    if (shippingZones) seller.settings.shippingZones = shippingZones;
    if (taxSettings) seller.settings.taxSettings = taxSettings;
    if (payoutSettings) seller.settings.paymentPreferences = payoutSettings;
    
    await seller.save();
    
    res.status(200).json({
      success: true,
      message: 'Store settings updated successfully',
      seller
    });
  } catch (error) {
    console.error('Update store settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};