const mongoose = require('mongoose');

/**
 * Cart Item Schema
 * Represents a single product in the cart
 */
const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
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
  stock: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

/**
 * Coupon Schema
 * Represents applied coupon in the cart
 */
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
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    min: 0,
    default: null
  },
  minPurchase: {
    type: Number,
    default: 0
  }
});

/**
 * Main Cart Schema
 * Represents a user's shopping cart
 */
const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  coupon: couponSchema,
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// ==================== MIDDLEWARE ====================

/**
 * Calculate cart totals before saving
 * Updates subtotal, discount, tax, shipping, and total
 */
cartSchema.pre('save', async function(next) {
  try {
    // Calculate subtotal (sum of all item prices * quantities)
    this.subtotal = this.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    // Calculate discount based on coupon
    this.discount = 0;
    if (this.coupon && this.coupon.discountValue > 0) {
      if (this.coupon.discountType === 'percentage') {
        let discount = (this.subtotal * this.coupon.discountValue) / 100;
        if (this.coupon.maxDiscount && discount > this.coupon.maxDiscount) {
          discount = this.coupon.maxDiscount;
        }
        this.discount = Math.min(discount, this.subtotal);
      } else {
        this.discount = Math.min(this.coupon.discountValue, this.subtotal);
      }
    }

    // Calculate tax (if applicable)
    // Set to 0 if no tax is applied
    this.tax = 0; // No tax for Bangladesh market

    // Calculate shipping cost
    const subtotalAfterDiscount = this.subtotal - this.discount;
    // Free shipping for orders over 5,000 BDT
    if (subtotalAfterDiscount > 5000) {
      this.shippingCost = 0;
    } else {
      this.shippingCost = 100; // Standard shipping rate 100 BDT
    }

    // Calculate total
    this.total = this.subtotal - this.discount + this.tax + this.shippingCost;
    
    // Ensure total is not negative
    this.total = Math.max(0, this.total);
    
    next();
  } catch (error) {
    next(error);
  }
});

// ==================== VIRTUALS ====================

/**
 * Get total number of items in cart
 */
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

/**
 * Check if cart has items
 */
cartSchema.virtual('hasItems').get(function() {
  return this.items.length > 0;
});

/**
 * Get item count (different products count)
 */
cartSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// ==================== INSTANCE METHODS ====================

/**
 * Add item to cart or update quantity if exists
 * @param {Object} item - Item to add
 * @returns {Promise} Updated cart
 */
cartSchema.methods.addItem = async function(item) {
  const existingItemIndex = this.items.findIndex(
    i => i.product.toString() === item.product.toString()
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += item.quantity;
  } else {
    this.items.push(item);
  }

  await this.save();
  return this;
};

/**
 * Update item quantity
 * @param {string} itemId - Item ID
 * @param {number} quantity - New quantity
 * @returns {Promise} Updated cart
 */
cartSchema.methods.updateItemQuantity = async function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      item.remove();
    } else {
      item.quantity = quantity;
    }
    await this.save();
  }
  return this;
};

/**
 * Remove item from cart
 * @param {string} itemId - Item ID
 * @returns {Promise} Updated cart
 */
cartSchema.methods.removeItem = async function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId);
  await this.save();
  return this;
};

/**
 * Clear all items from cart
 * @returns {Promise} Updated cart
 */
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.coupon = null;
  await this.save();
  return this;
};

/**
 * Apply coupon to cart
 * @param {Object} coupon - Coupon object
 * @returns {Promise} Updated cart
 */
cartSchema.methods.applyCoupon = async function(coupon) {
  this.coupon = coupon;
  await this.save();
  return this;
};

/**
 * Remove coupon from cart
 * @returns {Promise} Updated cart
 */
cartSchema.methods.removeCoupon = async function() {
  this.coupon = null;
  await this.save();
  return this;
};

/**
 * Check if all items are in stock
 * @returns {Object} Stock status
 */
cartSchema.methods.checkStock = async function() {
  const Product = mongoose.model('Product');
  const outOfStockItems = [];
  const lowStockItems = [];

  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      if (product.stock === 0) {
        outOfStockItems.push({
          name: item.name,
          requested: item.quantity,
          available: 0
        });
      } else if (product.stock < item.quantity) {
        lowStockItems.push({
          name: item.name,
          requested: item.quantity,
          available: product.stock
        });
      }
    }
  }

  return {
    available: outOfStockItems.length === 0 && lowStockItems.length === 0,
    outOfStock: outOfStockItems,
    lowStock: lowStockItems
  };
};

/**
 * Get cart summary for checkout
 * @returns {Object} Cart summary
 */
cartSchema.methods.getCheckoutSummary = async function() {
  await this.populate('items.product', 'name slug images');
  
  return {
    items: this.items,
    subtotal: this.subtotal,
    discount: this.discount,
    tax: this.tax,
    shippingCost: this.shippingCost,
    total: this.total,
    coupon: this.coupon,
    itemCount: this.totalItems
  };
};

// ==================== STATIC METHODS ====================

/**
 * Get or create cart for user
 * @param {string} userId - User ID
 * @returns {Promise} Cart object
 */
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ user: userId });
  
  if (!cart) {
    cart = await this.create({
      user: userId,
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      shippingCost: 0,
      total: 0
    });
  }
  
  return cart;
};

/**
 * Merge guest cart with user cart
 * @param {string} userId - User ID
 * @param {Array} guestItems - Guest cart items
 * @returns {Promise} Merged cart
 */
cartSchema.statics.mergeGuestCart = async function(userId, guestItems) {
  let cart = await this.findOne({ user: userId });
  
  if (!cart) {
    cart = await this.create({
      user: userId,
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      shippingCost: 0,
      total: 0
    });
  }
  
  for (const guestItem of guestItems) {
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === guestItem.productId
    );
    
    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += guestItem.quantity;
    } else {
      cart.items.push({
        product: guestItem.productId,
        name: guestItem.name,
        image: guestItem.image,
        price: guestItem.price,
        quantity: guestItem.quantity,
        seller: guestItem.seller,
        stock: guestItem.stock
      });
    }
  }
  
  await cart.save();
  return cart;
};

/**
 * Get cart statistics for admin
 * @returns {Object} Cart statistics
 */
cartSchema.statics.getCartStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCarts: { $sum: 1 },
        totalItems: { $sum: { $size: '$items' } },
        totalValue: { $sum: '$total' },
        averageCartValue: { $avg: '$total' },
        cartsWithItems: {
          $sum: { $cond: [{ $gt: [{ $size: '$items' }, 0] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalCarts: 0,
    totalItems: 0,
    totalValue: 0,
    averageCartValue: 0,
    cartsWithItems: 0
  };
};

// ==================== INDEXES ====================

// Create indexes for better query performance
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });
cartSchema.index({ createdAt: -1 });

// ==================== EXPORT ====================

module.exports = mongoose.model('Cart', cartSchema);