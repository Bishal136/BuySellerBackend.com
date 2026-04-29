const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  image: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  stock: Number
}, {
  timestamps: true
});

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscount: Number,
  minPurchase: {
    type: Number,
    default: 0
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  coupon: couponSchema,
  subtotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate cart totals before saving
cartSchema.pre('save', async function(next) {
  try {
    // Calculate subtotal
    this.subtotal = this.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    // Calculate discount
    if (this.coupon) {
      if (this.coupon.discountType === 'percentage') {
        let discount = (this.subtotal * this.coupon.discountValue) / 100;
        if (this.coupon.maxDiscount && discount > this.coupon.maxDiscount) {
          discount = this.coupon.maxDiscount;
        }
        this.discount = discount;
      } else {
        this.discount = Math.min(this.coupon.discountValue, this.subtotal);
      }
    } else {
      this.discount = 0;
    }

    // Calculate tax (10% tax rate)
    const taxableAmount = this.subtotal - this.discount;
    this.tax = taxableAmount * 0.10;

    // Calculate shipping (free over $50)
    if (this.subtotal - this.discount > 50) {
      this.shippingCost = 0;
    } else {
      this.shippingCost = 5.99;
    }

    // Calculate total
    this.total = this.subtotal - this.discount + this.tax + this.shippingCost;
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Cart', cartSchema);