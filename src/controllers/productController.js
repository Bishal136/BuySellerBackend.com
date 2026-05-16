const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');

exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const startIndex = (page - 1) * limit;

    let query = { status: 'active' };

    // Search functionality
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { brand: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Brand filter
    if (req.query.brand) {
      const brands = req.query.brand.split(',');
      query.brand = { $in: brands };
    }

    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Rating filter
    if (req.query.rating) {
      query['ratings.average'] = { $gte: parseFloat(req.query.rating) };
    }

    // Featured products
    if (req.query.isFeatured === 'true') {
      query.isFeatured = true;
    }

    // Sorting
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price_asc':
          sort = { price: 1 };
          break;
        case 'price_desc':
          sort = { price: -1 };
          break;
        case 'newest':
          sort = { createdAt: -1 };
          break;
        case 'popularity':
          sort = { soldCount: -1 };
          break;
        case 'rating':
          sort = { 'ratings.average': -1 };
          break;
      }
    }

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('seller', 'name storeName')
      .sort(sort)
      .limit(limit)
      .skip(startIndex);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get related products
// @route   GET /api/products/:id/related
// @access  Public
exports.getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      status: 'active',
      category: product.category,
      stock: { $gt: 0 }
    })
      .limit(parseInt(req.query.limit) || 4)
      .populate('category', 'name')
      .populate('seller', 'storeName');

    res.status(200).json({
      success: true,
      products: relatedProducts
    });
  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get product suggestions for autocomplete
// @route   GET /api/products/suggestions
// @access  Public
exports.getProductSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term too short'
      });
    }

    const suggestions = await Product.find({
      status: 'active',
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } }
      ]
    })
      .select('name slug price images brand')
      .limit(10);

    res.status(200).json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get filtered products for advanced filtering
// @route   POST /api/products/filter
// @access  Public
exports.filterProducts = async (req, res) => {
  try {
    const filters = req.body;
    let query = { status: 'active' };

    // Apply all filters
    if (filters.categories && filters.categories.length) {
      query.category = { $in: filters.categories };
    }

    if (filters.brands && filters.brands.length) {
      query.brand = { $in: filters.brands };
    }

    if (filters.priceRange) {
      query.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max
      };
    }

    if (filters.ratings && filters.ratings.length) {
      query['ratings.average'] = { $gte: Math.min(...filters.ratings) };
    }

    if (filters.inStock) {
      query.stock = { $gt: 0 };
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .limit(filters.limit || 50);

    res.status(200).json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Filter products error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// @desc    Create product
// @route   POST /api/products
// @access  Private/Seller
exports.createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      seller: req.user.id
    };

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Seller
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Seller
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// @desc    Get product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const product = await Product.findOne({ slug, status: 'active' })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('seller', 'name storeName storeLogo storeDescription');
      // REMOVED: .populate('reviews.user', 'name profileImage') - Product doesn't have reviews embedded

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    product.views = (product.views || 0) + 1;
    await product.save();

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if ID is a valid MongoDB ObjectId
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const product = await Product.findById(id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('seller', 'name storeName storeLogo storeDescription');
      // REMOVED: .populate('reviews.user', 'name profileImage') - Product doesn't have reviews embedded

    if (!product || product.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment view count
    product.views = (product.views || 0) + 1;
    await product.save();

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ==================== REVIEW CONTROLLERS ====================

// @desc    Get product reviews - CORRECT VERSION
// @route   GET /api/products/:id/reviews
// @access  Public
exports.getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;
    
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    
    const reviews = await Review.find({ product: id, status: 'approved' })
      .populate('user', 'name')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await Review.countDocuments({ product: id, status: 'approved' });
    
    const allReviews = await Review.find({ product: id, status: 'approved' });
    const average = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;
    
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach(review => {
      distribution[review.rating]++;
    });
    
    // Check if user can review (if authenticated)
    let canReview = false;
    if (req.user) {
      const order = await Order.findOne({
        user: req.user.id,
        'orderItems.product': id,
        status: 'delivered'
      });
      const existingReview = await Review.findOne({ product: id, user: req.user.id });
      canReview = !!order && !existingReview;
    }
    
    res.status(200).json({
      success: true,
      canReview,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        average: Number(average.toFixed(1)),
        total,
        distribution
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add review - CORRECT VERSION
// @route   POST /api/products/:id/reviews
// @access  Private
exports.addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if user already reviewed
    const existingReview = await Review.findOne({
      product: id,
      user: req.user.id
    });
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    
    // Check if user purchased the product and it is delivered
    const hasPurchased = await Order.findOne({
      user: req.user.id,
      'orderItems.product': id,
      status: 'delivered'
    });
    
    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: 'You must purchase this product before reviewing'
      });
    }
    
    // Create review
    const review = await Review.create({
      product: id,
      user: req.user.id,
      rating: parseInt(rating),
      title: title || '',
      comment: comment,
      images: req.body.images || [],
      verifiedPurchase: true,
      status: 'approved'
    });

    // Mark as reviewed in Order Item
    await Order.updateOne(
      { _id: hasPurchased._id, 'orderItems.product': id },
      { $set: { 'orderItems.$.hasReviewed': true } }
    );
    
    // Update product rating
    const allReviews = await Review.find({ product: id, status: 'approved' });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
    
    product.ratings = {
      average: Number(averageRating.toFixed(1)),
      count: allReviews.length
    };
    await product.save();
    
    // Populate user info
    await review.populate('user', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review
    });
  } catch (error) {
    console.error('Add review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update review
// @route   PUT /api/products/reviews/:reviewId
// @access  Private
exports.updateReview = async (req, res) => {
  try {
    const { rating, title, comment } = req.body;
    
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    review.rating = rating;
    review.title = title;
    review.comment = comment;
    await review.save();
    
    const product = await Product.findById(review.product);
    const allReviews = await Review.find({ product: review.product, status: 'approved' });
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    product.ratings = {
      average: totalRating / allReviews.length,
      count: allReviews.length
    };
    await product.save();
    
    res.status(200).json({
      success: true,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/products/reviews/:reviewId
// @access  Private
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const productId = review.product;
    await review.deleteOne();
    
    const product = await Product.findById(productId);
    const allReviews = await Review.find({ product: productId, status: 'approved' });
    
    if (allReviews.length > 0) {
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      product.ratings = {
        average: totalRating / allReviews.length,
        count: allReviews.length
      };
    } else {
      product.ratings = {
        average: 0,
        count: 0
      };
    }
    await product.save();
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// @desc    Mark review as helpful
// @route   POST /api/products/reviews/:reviewId/helpful
// @access  Private
exports.markHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.user.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot vote on own review' });
    }

    const hasVoted = review.helpful.includes(req.user.id);
    
    if (hasVoted) {
      review.helpful = review.helpful.filter(id => id.toString() !== req.user.id);
    } else {
      review.helpful.push(req.user.id);
    }
    
    await review.save();
    
    res.status(200).json({ success: true, helpfulCount: review.helpful.length, hasVoted: !hasVoted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Seller reply to review
// @route   POST /api/products/reviews/:reviewId/reply
// @access  Private
exports.replyToReview = async (req, res) => {
  try {
    const { comment } = req.body;
    const review = await Review.findById(req.params.reviewId).populate('product', 'seller');
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.product.seller.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to reply' });
    }

    review.sellerReply = {
      comment,
      createdAt: new Date()
    };
    
    await review.save();
    
    res.status(200).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function for rating distribution
function getRatingDistribution(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(review => {
    distribution[review.rating]++;
  });
  return distribution;
}

// @desc    Get logged in user's reviews
// @route   GET /api/products/my-reviews
// @access  Private
exports.getUserReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const reviews = await require('../models/Review').find({ user: req.user.id })
      .populate('product', 'name images slug brand')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);

    const total = await require('../models/Review').countDocuments({ user: req.user.id });

    // Also get "To Review" items
    const orders = await require('../models/Order').find({ 
      user: req.user.id, 
      status: 'delivered' 
    }).populate('orderItems.product', 'name images slug brand');

    let toReviewMap = new Map();
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        // If hasn't reviewed, and product exists, and not already in map
        if (!item.hasReviewed && item.product && !toReviewMap.has(item.product._id.toString())) {
          toReviewMap.set(item.product._id.toString(), {
            orderId: order._id,
            deliveredAt: order.deliveredAt || order.updatedAt,
            product: item.product
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      reviews,
      toReview: Array.from(toReviewMap.values()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};