const express = require('express');
const router = express.Router();
const { advancedSearch, getSuggestions, getSearchAnalytics } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware'); // For optional user ID extraction

// Wrapper middleware to optionally extract user without requiring auth
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return protect(req, res, (err) => {
      // Ignore auth errors, just proceed without req.user
      next();
    });
  }
  next();
};

router.get('/', optionalAuth, advancedSearch);
router.get('/suggestions', getSuggestions);
router.get('/analytics', optionalAuth, getSearchAnalytics);

module.exports = router;
