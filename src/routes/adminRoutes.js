const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  // Dashboard
  getDashboardStats,
  
  // User Management
  getUsers,
  updateUserStatus,
  
  // Seller Management
  getSellers,
  verifySeller,
  
  // Commission
  getCommissionSettings,
  updateCommissionSettings,
  
  // Coupons
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  
  // Banners
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  
  // Announcements
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  
  // Audit Logs
  getAuditLogs
} = require('../controllers/adminController');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.put('/users/:userId/status', updateUserStatus);

// Seller Management
router.get('/sellers', getSellers);
router.put('/sellers/:sellerId/verify', verifySeller);

// Commission Settings
router.get('/commission', getCommissionSettings);
router.put('/commission', updateCommissionSettings);

// Coupon Management
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Banner Management
router.get('/banners', getBanners);
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);

// Announcements
router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// Audit Logs
router.get('/audit-logs', getAuditLogs);

module.exports = router;