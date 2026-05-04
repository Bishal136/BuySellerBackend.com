const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Import from productManagementController
const {
  createProduct,
  getSellerProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  updateProductStatus,
  bulkUploadProducts,
  downloadCsvTemplate,
  getCategories,
  uploadProductImage,
  uploadMultipleImages,
  deleteProductImage,
  setPrimaryImage,
  getProductStats,
  bulkDeleteProducts,
  bulkUpdateStock,
} = require('../controllers/productManagementController');

// Import from sellerController (this has the correct updateOrderStatus)
const {
  registerSeller,
  getDashboardStats,
  getSalesAnalytics,
  getRecentOrders,
  getLowStockProducts,
  getSellerProfile,
  updateSellerProfile,
  getInventory,
  getSellerOrders,
  getShippingOrders,
  updateShippingStatus,
  updateOrderStatus,      // ✅ This is the correct function from sellerController
  getStockLogs,
  getRevenueReport,
  exportReport,
  sendMessage,
  getMessages,
  getDisputes,
  updateDispute,
  updateStoreSettings,
  generateShippingLabel,
  processReturn
} = require('../controllers/sellerController');

console.log('✓ Seller controller functions loaded:', {
  getDashboardStats: typeof getDashboardStats,
  registerSeller: typeof registerSeller,
  updateOrderStatus: typeof updateOrderStatus
});

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv') {
    cb(null, true);
  } else if (file.mimetype.startsWith('image/')) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[Seller Route] ${req.method} ${req.url}`);
  next();
});

// All seller routes require authentication and seller/admin role
router.use(protect);
router.use(authorize('seller', 'admin'));

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Seller routes working',
    user: { id: req.user.id, role: req.user.role }
  });
});

// ==================== REGISTRATION ====================
router.post('/register', registerSeller);

// ==================== DASHBOARD ====================
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getSalesAnalytics);
router.get('/recent-orders', getRecentOrders);
router.get('/low-stock', getLowStockProducts);
router.get('/profile', getSellerProfile);
router.put('/profile', updateSellerProfile);

// ==================== PRODUCT MANAGEMENT ====================
router.post('/products', createProduct);
router.get('/products', getSellerProducts);
router.get('/products/stats/summary', getProductStats);
router.get('/products/:id', getProductById);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/duplicate', duplicateProduct);
router.put('/products/:id/status', updateProductStatus);

// Image upload
router.post('/products/upload-image', upload.single('image'), uploadProductImage);
router.post('/products/upload-images', upload.array('images', 10), uploadMultipleImages);
router.delete('/products/:productId/images/:imageId', deleteProductImage);
router.put('/products/:productId/images/:imageId/primary', setPrimaryImage);

// Bulk operations
router.post('/products/bulk-upload', upload.single('file'), bulkUploadProducts);
router.get('/products/download-template', downloadCsvTemplate);
router.put('/products/bulk-stock', bulkUpdateStock);
router.delete('/products/bulk-delete', bulkDeleteProducts);

// Categories
router.get('/categories', getCategories);

// ==================== INVENTORY MANAGEMENT ====================
router.get('/inventory', getInventory);
router.put('/inventory/bulk-stock', bulkUpdateStock);
router.get('/stock-logs', getStockLogs);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders', getSellerOrders);
router.get('/orders/shipping', getShippingOrders);
router.put('/orders/:orderId/shipping', updateShippingStatus);
router.get('/orders/:orderId', getSellerOrders);
router.put('/orders/:orderId/status', updateOrderStatus);  // ✅ Use the function from sellerController
router.put('/orders/:orderId/return', processReturn);
router.get('/orders/:orderId/shipping-label', generateShippingLabel);

// ==================== REPORTS & ANALYTICS ====================
router.get('/reports/revenue', getRevenueReport);
router.get('/reports/export', exportReport);

// ==================== COMMUNICATION ====================
router.post('/messages', sendMessage);
router.get('/messages', getMessages);

// ==================== DISPUTES ====================
router.get('/disputes', getDisputes);
router.put('/disputes/:disputeId', updateDispute);

// ==================== STORE SETTINGS ====================
router.put('/store-settings', updateStoreSettings);

module.exports = router;