const mongoose = require('mongoose');

const searchAnalyticsSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  count: {
    type: Number,
    default: 1
  },
  lastSearchedAt: {
    type: Date,
    default: Date.now
  },
  resultsCount: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index to quickly find common searches
searchAnalyticsSchema.index({ count: -1 });
searchAnalyticsSchema.index({ query: 1, userId: 1 });

module.exports = mongoose.model('SearchAnalytics', searchAnalyticsSchema);
