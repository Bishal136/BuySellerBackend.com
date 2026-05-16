const express = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');
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
  deleteReview,
  getUserReviews
} = require('../controllers/productController');

// Public routes
router.get('/', getProducts);
router.get('/suggestions', getProductSuggestions);
router.get('/filter', filterProducts);
router.get('/my-reviews', protect, getUserReviews);

// IMPORTANT: Put slug route BEFORE id route
router.get('/slug/:slug', getProductBySlug);  // Add this route for slug-based lookup

router.get('/:id/related', getRelatedProducts);
router.get('/:id/reviews', optionalAuth, getProductReviews);
router.get('/:id', getProductById);  // This should come AFTER slug route

// Protected routes for sellers
router.post('/', protect, authorize('seller', 'admin'), createProduct);
router.put('/:id', protect, authorize('seller', 'admin'), updateProduct);
router.delete('/:id', protect, authorize('seller', 'admin'), deleteProduct);

// Review routes
router.post('/:id/reviews', protect, addReview);
router.put('/reviews/:reviewId', protect, updateReview);
router.delete('/reviews/:reviewId', protect, deleteReview);
router.post('/reviews/:reviewId/helpful', protect, require('../controllers/productController').markHelpful);
router.post('/reviews/:reviewId/reply', protect, authorize('seller', 'admin'), require('../controllers/productController').replyToReview);

module.exports = router;