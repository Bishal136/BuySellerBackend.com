const Seller = require('../models/Seller');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const StockLog = require('../models/StockLog');
const Message = require('../models/Message');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// ==================== REGISTRATION & PROFILE ====================

// @desc    Register as seller
// @route   POST /api/seller/register
// @access  Public (or Private - depends on your flow)
exports.registerSeller = async (req, res) => {
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

    console.log('Register seller request:', { name, email, storeName });

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

    // Check if seller exists by business email
    const existingBusinessEmail = await Seller.findOne({ businessEmail });
    if (existingBusinessEmail) {
      return res.status(400).json({
        success: false,
        message: 'Seller already registered with this business email'
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

    // Create seller profile (standalone, no User reference needed)
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
      verificationStatus: 'pending',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // console.log('Seller created successfully:', seller._id);

    res.status(201).json({
      success: true,
      message: 'Seller registration submitted for verification',
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        businessName: seller.businessName,
        verificationStatus: seller.verificationStatus,
        isActive: seller.isActive
      }
    });
  } catch (error) {
    console.error('Register seller error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get seller profile
// @route   GET /api/seller/profile
// @access  Private/Seller
exports.getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    res.status(200).json({
      success: true,
      seller
    });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update seller profile
// @route   PUT /api/seller/profile
// @access  Private/Seller
exports.updateSellerProfile = async (req, res) => {
  try {
    const { storeName, storeDescription, storeLogo, storeBanner, phone, businessAddress } = req.body;

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    if (storeName) {
      seller.storeName = storeName;
      seller.storeSlug = storeName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');
    }
    if (storeDescription) seller.storeDescription = storeDescription;
    if (storeLogo) seller.storeLogo = storeLogo;
    if (storeBanner) seller.storeBanner = storeBanner;
    if (phone) seller.phone = phone;
    if (businessAddress) seller.businessAddress = businessAddress;

    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully',
      seller
    });
  } catch (error) {
    console.error('Update seller profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DASHBOARD ====================

// @desc    Get seller dashboard stats
// @route   GET /api/seller/dashboard
// @access  Private/Seller
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('getDashboardStats called');
    console.log('Seller ID from token:', req.user.id);

    // Get seller directly from Seller collection using the ID from token
    const seller = await Seller.findById(req.user.id);

    if (!seller) {
      console.log('Seller not found for ID:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found. Please complete your registration.'
      });
    }

    console.log('Seller found:', seller.storeName);

    // Get seller's products - using seller._id
    const products = await Product.find({ seller: seller._id });
    console.log('Products count:', products.length);

    // Get product IDs
    const productIds = products.map(p => p._id);

    // Get orders for seller's products
    const orders = await Order.find({
      'orderItems.product': { $in: productIds }
    });
    console.log('Orders count:', orders.length);

    // Calculate stats
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalOrders = orders.length;
    const totalProducts = products.length;

    const stats = {
      totalRevenue: totalRevenue,
      totalOrders: totalOrders,
      totalProducts: totalProducts,
      totalSales: deliveredOrders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      processingOrders: orders.filter(o => o.status === 'processing').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      lowStockProducts: products.filter(p => p.stock > 0 && p.stock <= 10),
      outOfStockProducts: products.filter(p => p.stock === 0),
      todaySales: 0,
      todayRevenue: 0,
      weeklySales: 0,
      weeklyRevenue: 0,
      monthlySales: 0,
      monthlyRevenue: 0,
      yearlySales: totalOrders,
      yearlyRevenue: totalRevenue,
      rating: seller.rating || { average: 0, count: 0 },
      storeName: seller.storeName,
      storeLogo: seller.storeLogo,
      verificationStatus: seller.verificationStatus
    };

    console.log('Stats calculated successfully');

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get sales analytics
// @route   GET /api/seller/analytics
// @access  Private/Seller
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    const products = await Product.find({ seller: seller._id });
    const productIds = products.map(p => p._id);

    let startDate;
    let groupBy;

    switch (period) {
      case 'daily':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'weekly':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 84);
        groupBy = { $isoWeek: '$createdAt' };
        break;
      case 'monthly':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case 'yearly':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 5);
        groupBy = { $dateToString: { format: '%Y', date: '$createdAt' } };
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          'orderItems.product': { $in: productIds },
          createdAt: { $gte: startDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const topProducts = await Order.aggregate([
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
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);

    const populatedTopProducts = await Product.populate(topProducts, {
      path: '_id',
      select: 'name price images'
    });

    res.status(200).json({
      success: true,
      analytics: {
        salesData: salesData.map(d => ({ _id: d._id, totalSales: d.totalSales, totalRevenue: d.totalRevenue })),
        topProducts: populatedTopProducts.map(p => ({
          product: p._id,
          totalSold: p.totalSold,
          totalRevenue: p.totalRevenue
        })),
        period
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get recent orders
// @route   GET /api/seller/recent-orders
// @access  Private/Seller
exports.getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    const products = await Product.find({ seller: seller._id });
    const productIds = products.map(p => p._id);

    const orders = await Order.find({
      'orderItems.product': { $in: productIds }
    })
      .sort('-createdAt')
      .limit(limit)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name images');

    const formattedOrders = orders.map(order => {
      const sellerItems = order.orderItems.filter(item =>
        productIds.some(id => id.toString() === (item.product._id || item.product).toString())
      );

      return {
        _id: order._id,
        orderId: order._id,
        customer: order.user,
        items: sellerItems,
        totalAmount: sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      };
    });

    res.status(200).json({
      success: true,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get low stock products
// @route   GET /api/seller/low-stock
// @access  Private/Seller
exports.getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    const products = await Product.find({
      seller: seller._id,
      stock: { $lte: threshold, $gt: 0 }
    })
      .select('name sku stock price images')
      .sort('stock');

    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== INVENTORY MANAGEMENT ====================

// @desc    Get inventory
// @route   GET /api/seller/inventory
// @access  Private/Seller
exports.getInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;

    let query = { seller: req.user.id };

    if (req.query.stockStatus === 'low') {
      query.stock = { $lte: 10, $gt: 0 };
    } else if (req.query.stockStatus === 'out') {
      query.stock = 0;
    }

    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    const products = await Product.find(query)
      .select('name sku stock price images status')
      .sort('stock')
      .limit(limit)
      .skip(startIndex);

    const total = await Product.countDocuments(query);

    const stats = {
      totalProducts: await Product.countDocuments({ seller: req.user.id }),
      lowStock: await Product.countDocuments({ seller: req.user.id, stock: { $lte: 10, $gt: 0 } }),
      outOfStock: await Product.countDocuments({ seller: req.user.id, stock: 0 }),
      totalValue: (await Product.aggregate([
        { $match: { seller: req.user._id } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$price', '$stock'] } } } }
      ]))[0]?.total || 0
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

// ==================== ORDERS ====================

// @desc    Get seller orders
// @route   GET /api/seller/orders
// @access  Private/Seller
exports.getSellerOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;

    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);

    let query = { 'orderItems.product': { $in: productIds } };

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    const orders = await Order.find(query)
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex)
      .populate('user', 'name email phone');

    const formattedOrders = orders.map(order => {
      const sellerItems = order.orderItems.filter(item =>
        productIds.some(id => id.toString() === (item.product._id || item.product).toString())
      );

      return {
        _id: order._id,
        orderId: order._id,
        customer: order.user,
        items: sellerItems,
        totalAmount: sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress
      };
    });

    const total = await Order.countDocuments(query);

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

// @desc    Get shipping orders
// @route   GET /api/seller/orders/shipping
// @access  Private/Seller
exports.getShippingOrders = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);

    let query = { 'orderItems.product': { $in: productIds } };

    const orders = await Order.find(query)
      .sort('-createdAt')
      .populate('user', 'name email phone');

    const formattedOrders = orders.map(order => {
      const sellerItems = order.orderItems.filter(item =>
        productIds.some(id => id.toString() === (item.product._id || item.product).toString())
      );

      return {
        _id: order._id,
        orderId: order._id,
        customer: order.user,
        items: sellerItems,
        totalAmount: sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: order.status,
        shippingStatus: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
        trackingInfo: {
          trackingNumber: order.trackingNumber,
          courierService: order.carrier,
          estimatedDelivery: order.estimatedDelivery
        }
      };
    });

    res.status(200).json({
      success: true,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Get shipping orders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update shipping status
// @route   PUT /api/seller/orders/:orderId/shipping
// @access  Private/Seller
exports.updateShippingStatus = async (req, res) => {
  try {
    const { shippingStatus, trackingInfo } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    const hasSellerProducts = order.orderItems.some(item =>
      productIds.some(id => id.toString() === (item.product._id || item.product).toString())
    );

    if (!hasSellerProducts) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (shippingStatus) {
        order.status = shippingStatus;
        
        // Handle timestamps based on status
        if (shippingStatus === 'shipped') order.shippedAt = new Date();
        if (shippingStatus === 'delivered') {
            order.deliveredAt = new Date();
            order.isDelivered = true;
        }
        if (shippingStatus === 'cancelled') order.cancelledAt = new Date();
    }
    
    if (trackingInfo) {
        if (trackingInfo.trackingNumber) order.trackingNumber = trackingInfo.trackingNumber;
        if (trackingInfo.courierService) order.carrier = trackingInfo.courierService;
        if (trackingInfo.estimatedDelivery) order.estimatedDelivery = trackingInfo.estimatedDelivery;
    }

    await order.save();
    
    await order.populate('user', 'name email phone');

    const sellerItems = order.orderItems.filter(item =>
      productIds.some(id => id.toString() === (item.product._id || item.product).toString())
    );

    const formattedOrder = {
        _id: order._id,
        orderId: order._id,
        customer: order.user,
        items: sellerItems,
        totalAmount: sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: order.status,
        shippingStatus: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
        trackingInfo: {
          trackingNumber: order.trackingNumber,
          courierService: order.carrier,
          estimatedDelivery: order.estimatedDelivery
        }
    };

    res.status(200).json({
      success: true,
      message: 'Shipping status updated successfully',
      order: formattedOrder
    });
  } catch (error) {
    console.error('Update shipping status error:', error);
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

    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);
    const hasSellerProducts = order.orderItems.some(item =>
      productIds.some(id => id.toString() === (item.product._id || item.product).toString())
    );

    if (!hasSellerProducts) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrier) order.carrier = carrier;

    await order.save();

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

// ==================== STOCK MANAGEMENT ====================

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

// @desc    Get stock logs
// @route   GET /api/seller/stock-logs
// @access  Private/Seller
exports.getStockLogs = async (req, res) => {
  try {
    const logs = await StockLog.find({ seller: req.user.id })
      .populate('product', 'name sku')
      .sort('-createdAt')
      .limit(50);

    res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Get stock logs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REPORTS ====================

// @desc    Get revenue report
// @route   GET /api/seller/reports/revenue
// @access  Private/Seller
exports.getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const products = await Product.find({ seller: req.user.id });
    const productIds = products.map(p => p._id);

    let dateFormat;
    switch (groupBy) {
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
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.status(200).json({
      success: true,
      revenueData,
      summary: {
        totalRevenue: revenueData.reduce((sum, d) => sum + d.revenue, 0),
        totalOrders: revenueData.reduce((sum, d) => sum + d.orders, 0)
      }
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export report
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

// ==================== MESSAGES ====================

// @desc    Send message
// @route   POST /api/seller/messages
// @access  Private/Seller
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, orderId, subject, message, attachments } = req.body;

    const newMessage = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      order: orderId,
      subject,
      message,
      attachments: attachments || []
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
        { sender: req.user.id },
        { receiver: req.user.id }
      ]
    })
      .populate('sender', 'name')
      .populate('receiver', 'name')
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

// @desc    Update dispute
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

// ==================== HELPER FUNCTIONS ====================

// @desc    Generate shipping label
// @route   POST /api/seller/orders/:orderId/shipping-label
// @access  Private/Seller
exports.generateShippingLabel = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const seller = await Seller.findOne({ user: req.user.id });

    const doc = new PDFDocument({ size: 'A6', margin: 20 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shipping-label-${order._id}.pdf`);

    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('SHIPPING LABEL', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('FROM:');
    doc.fontSize(10).font('Helvetica');
    doc.text(seller?.storeName || 'Seller Store');
    doc.text(seller?.businessAddress?.street || '');
    doc.text(`${seller?.businessAddress?.city || ''}, ${seller?.businessAddress?.state || ''}`);
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('TO:');
    doc.fontSize(10).font('Helvetica');
    doc.text(order.shippingAddress.name);
    doc.text(order.shippingAddress.street);
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`);
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('ORDER DETAILS:');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Order ID: ${order._id}`);
    doc.text(`Tracking #: ${order.trackingNumber || 'N/A'}`);
    doc.text(`Carrier: ${order.carrier || 'N/A'}`);

    doc.end();
  } catch (error) {
    console.error('Generate shipping label error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process return
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
    } else if (action === 'reject') {
      order.returnRequest.status = 'rejected';
      order.returnRequest.rejectedAt = new Date();
    }

    order.returnRequest.adminComments = adminComments;
    await order.save();

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