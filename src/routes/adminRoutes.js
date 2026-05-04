const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
const {
  // Dashboard
  getDashboardStats,
  
  // User Management
  getUsers,
  updateUserStatus,
  
  // Seller Management
  getSellers,
  createSeller,
  verifySeller,
  
  // Commission
  getCommissionSettings,
  updateCommissionSettings,
  
  // Settings
  getSettings,
  updateSettings,
  
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
  uploadBannerImage,
  
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
router.post('/sellers', createSeller);
router.put('/sellers/:sellerId/verify', verifySeller);

// Commission Settings
router.get('/commission', getCommissionSettings);
router.put('/commission', updateCommissionSettings);

// Platform Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Coupon Management
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Banner Management
router.get('/banners', getBanners);
router.post('/banners/upload', upload.single('image'), uploadBannerImage);
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