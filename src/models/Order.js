const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  image: String,
  price: Number,
  quantity: Number,
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
   seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true }
});

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['bkash', 'nagad', 'cash_on_delivery'],
    required: true
  },
  transactionId: String,
  paymentId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: Number,
  paidAt: Date,
  paymentDetails: mongoose.Schema.Types.Mixed
});

// Return/Refund Item Schema
const returnItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  }
});

// Return Request Schema
const returnRequestSchema = new mongoose.Schema({
  items: [returnItemSchema],
  comments: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  rejectedAt: Date,
  refundAmount: Number,
  refundedAt: Date,
  adminComments: String
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  paymentMethod: {
    type: String,
    required: true
  },
  paymentResult: paymentSchema,
  itemsPrice: {
    type: Number,
    required: true,
    default: 0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0
  },
  coupon: {
    code: String,
    discount: Number
  },
  
  // Order Status Timeline
  status: {
    type: String,
    enum: ['pending', 'processing', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Status Timestamps
  confirmedAt: Date,
  processingAt: Date,
  shippedAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  
  // Cancellation Info
  cancelReason: {
    type: String,
    default: ''
  },
  
  // Shipping/Tracking Info
  trackingNumber: {
    type: String,
    default: ''
  },
  carrier: {
    type: String,
    default: ''
  },
  estimatedDelivery: Date,
  
  // Return/Refund Info
  returnRequest: returnRequestSchema,
  refundAmount: {
    type: Number,
    default: 0
  },
  refundedAt: Date,
  
  // Payment Status
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: Date,
  
  // Delivery Status
  isDelivered: {
    type: Boolean,
    default: false
  },
  
  // Additional Info
  notes: {
    type: String,
    default: ''
  },
  
  // Admin Notes
  adminNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Add index for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'returnRequest.status': 1 });

// Virtual for order age
orderSchema.virtual('orderAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for can cancel
orderSchema.virtual('canCancel').get(function() {
  return ['pending', 'confirmed'].includes(this.status);
});

// Virtual for can return
orderSchema.virtual('canReturn').get(function() {
  if (this.status !== 'delivered') return false;
  if (this.returnRequest && this.returnRequest.status !== 'rejected') return false;
  
  const deliveredDate = new Date(this.deliveredAt);
  const currentDate = new Date();
  const daysSinceDelivery = Math.floor((currentDate - deliveredDate) / (1000 * 60 * 60 * 24));
  
  return daysSinceDelivery <= 30;
});

// Method to update order status
orderSchema.methods.updateStatus = async function(newStatus) {
  this.status = newStatus;
  
  switch(newStatus) {
    case 'confirmed':
      this.confirmedAt = new Date();
      break;
    case 'processing':
      this.processingAt = new Date();
      break;
    case 'shipped':
      this.shippedAt = new Date();
      break;
    case 'out_for_delivery':
      this.outForDeliveryAt = new Date();
      break;
    case 'delivered':
      this.deliveredAt = new Date();
      this.isDelivered = true;
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      break;
  }
  
  await this.save();
  return this;
};

// Method to add tracking info
orderSchema.methods.addTracking = async function(trackingNumber, carrier) {
  this.trackingNumber = trackingNumber;
  this.carrier = carrier;
  await this.save();
  return this;
};

module.exports = mongoose.model('Order', orderSchema);