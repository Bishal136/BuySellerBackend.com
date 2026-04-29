const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['product_not_received', 'damaged_product', 'wrong_product', 'quality_issue', 'payment_issue', 'other']
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    name: String,
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  resolution: {
    type: String,
    enum: ['refund', 'return', 'replacement', 'partial_refund', 'none'],
    default: 'none'
  },
  resolutionAmount: Number,
  resolutionNotes: String,
  messages: [{
    sender: String,
    message: String,
    attachments: [String],
    createdAt: Date
  }],
  resolvedAt: Date,
  closedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

disputeSchema.index({ order: 1, customer: 1, seller: 1 });
disputeSchema.index({ status: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);