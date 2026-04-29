const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initiateBkashPayment,
  confirmBkashPayment,
  initiateNagadPayment,
  confirmNagadPayment,
  confirmCashOnDelivery
} = require('../controllers/paymentController');

router.use(protect);

// bKash routes
router.post('/bkash/init', initiateBkashPayment);
router.post('/bkash/confirm', confirmBkashPayment);

// Nagad routes
router.post('/nagad/init', initiateNagadPayment);
router.post('/nagad/confirm', confirmNagadPayment);

// Cash on Delivery
router.post('/cod/confirm', confirmCashOnDelivery);

module.exports = router;