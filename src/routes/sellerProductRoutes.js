const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const {
  // Product CRUD
  createProduct,
  getSellerProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  updateProductStatus,
  
  // Image Management
  uploadProductImage,
  uploadMultipleImages,
  deleteProductImage,
  setPrimaryImage,
  
  // Bulk Operations
  bulkUploadProducts,
  downloadCsvTemplate,
  bulkUpdateStock,
  bulkDeleteProducts,
  
  // Utilities
  getCategories,
  getProductStats
} = require('../controllers/productManagementController');

// Configure multer for memory storage (better for Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check for CSV files
  if (file.mimetype === 'text/csv') {
    cb(null, true);
  }
  // Check for image files
  else if (file.mimetype.startsWith('image/')) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
  else {
    cb(new Error('Invalid file type. Only CSV and image files are allowed'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit for CSV
  },
  fileFilter: fileFilter
});

// All routes require authentication and seller/admin role
router.use(protect);
router.use(authorize('seller', 'admin'));

// ==================== PRODUCT CRUD ROUTES ====================
router.post('/products', createProduct);
router.get('/products', getSellerProducts);
router.get('/products/:id', getProductById);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/duplicate', duplicateProduct);
router.put('/products/:id/status', updateProductStatus);

// ==================== IMAGE MANAGEMENT ROUTES ====================
// Single image upload
router.post('/products/upload-image', upload.single('image'), uploadProductImage);
// Multiple images upload (max 10 images)
router.post('/products/upload-images', upload.array('images', 10), uploadMultipleImages);
// Delete image from product
router.delete('/products/:productId/images/:imageId', deleteProductImage);
// Set primary image
router.put('/products/:productId/images/:imageId/primary', setPrimaryImage);

// ==================== BULK OPERATIONS ROUTES ====================
// CSV bulk upload (CSV file)
router.post('/products/bulk-upload', upload.single('file'), bulkUploadProducts);
// Download CSV template
router.get('/products/download-template', downloadCsvTemplate);
// Bulk update stock
router.put('/products/bulk-stock', bulkUpdateStock);
// Bulk delete products
router.delete('/products/bulk-delete', bulkDeleteProducts);

// ==================== UTILITY ROUTES ====================
// Get categories for dropdown
router.get('/categories', getCategories);
// Get product statistics
router.get('/products/stats/summary', getProductStats);

module.exports = router;