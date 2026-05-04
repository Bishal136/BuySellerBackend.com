const Banner = require('../models/Banner');

// @desc    Get public active banners
// @route   GET /api/banners
// @access  Public
exports.getPublicBanners = async (req, res) => {
  try {
    const now = new Date();
    
    // Find active banners where the current date falls between startDate and endDate
    // or dates are not set.
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $gte: now } },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $exists: false } },
        { startDate: { $lte: now }, endDate: null }
      ]
    }).sort('position');

    res.status(200).json({
      success: true,
      banners
    });
  } catch (error) {
    console.error('Get public banners error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
