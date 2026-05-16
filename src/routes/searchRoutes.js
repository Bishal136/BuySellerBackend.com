const express = require('express');
const router = express.Router();
const { advancedSearch, getSuggestions, getSearchAnalytics } = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, advancedSearch);
router.get('/suggestions', getSuggestions);
router.get('/analytics', optionalAuth, getSearchAnalytics);

module.exports = router;
