const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
    maxLength: 1000
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
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  taxId: {
    type: String
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  verificationDocuments: [{
    type: String,
    name: String,
    url: String,
    uploadedAt: Date
  }],
  verificationNotes: String,
  verifiedAt: Date,
  commissionRate: {
    type: Number,
    default: 10 // 10% commission
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
  settings: {
    shippingZones: [{
      name: String,
      countries: [String],
      cost: Number,
      freeShippingThreshold: Number
    }],
    taxSettings: {
      taxRate: { type: Number, default: 10 },
      isTaxIncluded: { type: Boolean, default: false }
    },
    returnPolicy: String,
    shippingPolicy: String,
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