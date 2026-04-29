const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['active', 'notified', 'cancelled'],
    default: 'active'
  },
  notifiedAt: Date
}, {
  timestamps: true
});

stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('StockAlert', stockAlertSchema);