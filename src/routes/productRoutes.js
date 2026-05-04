const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getProducts,
  getProductById,
  getProductBySlug,  // Add this import
  getRelatedProducts,
  getProductSuggestions,
  filterProducts,
  getProductReviews,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  updateReview,
  deleteReview
} = require('../controllers/productController');

// Public routes
router.get('/', getProducts);
router.get('/suggestions', getProductSuggestions);
router.get('/filter', filterProducts);

// IMPORTANT: Put slug route BEFORE id route
router.get('/slug/:slug', getProductBySlug);  // Add this route for slug-based lookup

router.get('/:id/related', getRelatedProducts);
router.get('/:id/reviews', getProductReviews);
router.get('/:id', getProductById);  // This should come AFTER slug route

// Protected routes for sellers
router.post('/', protect, authorize('seller', 'admin'), createProduct);
router.put('/:id', protect, authorize('seller', 'admin'), updateProduct);
router.delete('/:id', protect, authorize('seller', 'admin'), deleteProduct);

// Review routes
router.post('/:id/reviews', protect, addReview);
router.put('/reviews/:reviewId', protect, updateReview);
router.delete('/reviews/:reviewId', protect, deleteReview);

module.exports = router;