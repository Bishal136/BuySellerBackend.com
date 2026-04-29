const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  adjustment: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ['sale', 'return', 'restock', 'manual', 'damage', 'lost'],
    default: 'manual'
  },
  note: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

stockLogSchema.index({ seller: 1, createdAt: -1 });
stockLogSchema.index({ product: 1 });

module.exports = mongoose.model('StockLog', stockLogSchema);