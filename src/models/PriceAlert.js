const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'triggered', 'cancelled'],
    default: 'active'
  },
  triggeredAt: Date,
  notifiedAt: Date
}, {
  timestamps: true
});

priceAlertSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('PriceAlert', priceAlertSchema);