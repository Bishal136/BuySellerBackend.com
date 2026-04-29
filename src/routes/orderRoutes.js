const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
  trackOrder,
  downloadInvoice,
  getOrderStats
} = require('../controllers/orderController');

router.use(protect);

router.get('/', getUserOrders);
router.get('/stats/summary', getOrderStats);
router.get('/:id', getOrderById);
router.get('/:id/track', trackOrder);
router.get('/:id/invoice', downloadInvoice);
router.put('/:id/cancel', cancelOrder);
router.post('/:id/return', requestReturn);

module.exports = router;