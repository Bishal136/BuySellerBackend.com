const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  // NO user field - Seller is completely independent
  
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  storeName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  storeSlug: {
    type: String,
    required: true,
    unique: true
  },
  storeLogo: {
    type: String,
    default: ''
  },
  storeBanner: {
    type: String,
    default: ''
  },
  storeDescription: {
    type: String,
    maxLength: 1000,
    default: ''
  },
  businessName: {
    type: String,
    required: true
  },
  businessEmail: {
    type: String,
    required: true
  },
  businessPhone: {
    type: String,
    required: true
  },
  businessAddress: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: 'Bangladesh' }
  },
  taxId: {
    type: String,
    default: ''
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  verificationDocuments: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  verificationNotes: {
    type: String,
    default: ''
  },
  verifiedAt: Date,
  commissionRate: {
    type: Number,
    default: 10
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalProducts: {
    type: Number,
    default: 0
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  settings: {
    shippingZones: [{
      name: String,
      countries: [String],
      cost: Number,
      freeShippingThreshold: Number
    }],
    taxSettings: {
      taxRate: { type: Number, default: 0 },
      isTaxIncluded: { type: Boolean, default: false }
    },
    returnPolicy: { type: String, default: '' },
    shippingPolicy: { type: String, default: '' },
    paymentPreferences: {
      payoutMethod: {
        type: String,
        enum: ['bank', 'bkash', 'nagad', 'paypal'],
        default: 'bank'
      },
      payoutDetails: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true
});

// Create slug from store name
sellerSchema.pre('save', function(next) {
  if (this.isModified('storeName')) {
    this.storeSlug = this.storeName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-');
  }
  next();
});

module.exports = mongoose.model('Seller', sellerSchema);