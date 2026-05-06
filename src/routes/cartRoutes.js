const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  applyCoupon,
  removeCoupon,
  clearCart,
  syncCart,
  validateCoupon
} = require('../controllers/cartController');

// Public route to validate coupon (for guest carts)
router.get('/coupon/validate/:code', validateCoupon);

// All cart routes are protected
router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update/:itemId', updateCartItem);
router.delete('/remove/:itemId', removeFromCart);
router.post('/coupon', applyCoupon);
router.delete('/coupon', removeCoupon);
router.delete('/clear', clearCart);
router.post('/sync', syncCart);

module.exports = router;