const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock seller slug');
    
    if (!cart) {
      cart = await Cart.create({ 
        user: req.user.id, 
        items: [],
        subtotal: 0,
        total: 0
      });
    }
    
    res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }
    
    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ 
        user: req.user.id, 
        items: [],
        subtotal: 0,
        total: 0
      });
    }
    
    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );
    
    const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0];
    
    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      // Check stock again
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more. Only ${product.stock - cart.items[existingItemIndex].quantity} available`
        });
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        name: product.name,
        image: primaryImage?.url || '',
        price: product.price,
        quantity: quantity,
        seller: product.seller,
        stock: product.stock
      });
    }
    
    await cart.save();
    await cart.populate('items.product', 'name price images stock seller slug');
    
    res.status(200).json({
      success: true,
      cart,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:itemId
// @access  Private
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const itemId = req.params.itemId;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }
    
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === itemId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }
    
    const product = await Product.findById(cart.items[itemIndex].product);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }
    
    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name price images stock seller slug');
    
    res.status(200).json({
      success: true,
      cart,
      message: 'Cart updated successfully'
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    cart.items = cart.items.filter(
      item => item._id.toString() !== req.params.itemId
    );
    
    await cart.save();
    await cart.populate('items.product', 'name price images stock seller slug');
    
    res.status(200).json({
      success: true,
      cart,
      message: 'Item removed from cart'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a coupon code'
      });
    }
    
    // Coupon validation (in real app, fetch from database)
    const validCoupons = {
      'SAVE10': { type: 'percentage', value: 10, minPurchase: 50, maxDiscount: 50 },
      'SAVE20': { type: 'percentage', value: 20, minPurchase: 100, maxDiscount: 100 },
      'FLAT50': { type: 'fixed', value: 50, minPurchase: 200 },
      'WELCOME': { type: 'percentage', value: 15, minPurchase: 0, maxDiscount: 30 },
      'FREESHIP': { type: 'percentage', value: 0, minPurchase: 0, freeShipping: true }
    };
    
    const couponData = validCoupons[code.toUpperCase()];
    
    if (!couponData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }
    
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Check minimum purchase
    if (cart.subtotal < couponData.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of $${couponData.minPurchase} required for this coupon`
      });
    }
    
    // Apply coupon
    cart.coupon = {
      code: code.toUpperCase(),
      discountType: couponData.type,
      discountValue: couponData.value,
      maxDiscount: couponData.maxDiscount,
      minPurchase: couponData.minPurchase
    };
    
    // Handle free shipping
    if (couponData.freeShipping) {
      cart.shippingCost = 0;
    }
    
    await cart.save();
    
    res.status(200).json({
      success: true,
      cart,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/coupon
// @access  Private
exports.removeCoupon = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    cart.coupon = undefined;
    await cart.save();
    
    res.status(200).json({
      success: true,
      cart,
      message: 'Coupon removed successfully'
    });
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = [];
      cart.coupon = undefined;
      await cart.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Sync guest cart with user cart (after login)
// @route   POST /api/cart/sync
// @access  Private
exports.syncCart = async (req, res) => {
  try {
    const { guestItems } = req.body;
    
    if (!guestItems || !guestItems.length) {
      return res.status(400).json({
        success: false,
        message: 'No guest cart items to sync'
      });
    }
    
    let userCart = await Cart.findOne({ user: req.user.id });
    
    if (!userCart) {
      userCart = await Cart.create({ 
        user: req.user.id, 
        items: [],
        subtotal: 0,
        total: 0
      });
    }
    
    // Merge guest items with user cart
    for (const guestItem of guestItems) {
      const existingItem = userCart.items.find(
        item => item.product.toString() === guestItem.productId
      );
      
      const product = await Product.findById(guestItem.productId);
      if (product && product.stock >= guestItem.quantity) {
        if (existingItem) {
          existingItem.quantity += guestItem.quantity;
        } else {
          const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0];
          userCart.items.push({
            product: guestItem.productId,
            name: product.name,
            image: primaryImage?.url || '',
            price: product.price,
            quantity: guestItem.quantity,
            seller: product.seller,
            stock: product.stock
          });
        }
      }
    }
    
    await userCart.save();
    await userCart.populate('items.product', 'name price images stock');
    
    res.status(200).json({
      success: true,
      cart: userCart,
      message: 'Cart synced successfully'
    });
  } catch (error) {
    console.error('Sync cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};