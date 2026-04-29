const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createPriceAlert,
  createStockAlert,
  getPriceAlerts,
  getStockAlerts,
  deletePriceAlert,
  deleteStockAlert
} = require('../controllers/notificationController');

router.use(protect);

// Notification routes
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.delete('/delete-all', deleteAllNotifications);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

// Price alert routes
router.post('/price-alert', createPriceAlert);
router.get('/price-alerts', getPriceAlerts);
router.delete('/price-alert/:id', deletePriceAlert);

// Stock alert routes
router.post('/stock-alert', createStockAlert);
router.get('/stock-alerts', getStockAlerts);
router.delete('/stock-alert/:id', deleteStockAlert);

module.exports = router;