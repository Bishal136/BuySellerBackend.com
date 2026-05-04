const express = require('express');
const router = express.Router();
const { getPublicBanners } = require('../controllers/bannerController');

// Public route to get active banners
router.get('/', getPublicBanners);

module.exports = router;
