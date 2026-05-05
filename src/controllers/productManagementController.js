const Product = require('../models/Product');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// ==================== PRODUCT CRUD ====================

// @desc    Create new product
// @route   POST /api/seller/products
// @access  Private/Seller
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      comparePrice,
      stock,
      sku,
      category,
      brand,
      tags,
      specifications,
      images,
      status
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !stock || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, description, price, stock, category'
      });
    }

    // Generate slug
    const slug = name.toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-');

    // Check if slug already exists
    const existingProduct = await Product.findOne({ slug });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with similar name already exists'
      });
    }

    // Process images - ensure they have proper structure
    let processedImages = [];
    if (images && images.length > 0) {
      processedImages = images.map((img, index) => ({
        url: img.url,
        publicId: img.publicId || `temp_${Date.now()}_${index}`,
        alt: img.alt || name,
        isPrimary: index === 0,
        order: index
      }));
    }

    // Create product
    const productData = {
      seller: req.user.id,
      name,
      slug,
      description,
      shortDescription: shortDescription || '',
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
      stock: parseInt(stock),
      sku: sku || '',
      category,
      brand: brand || '',
      tags: tags || [],
      specifications: specifications || {},
      images: processedImages,
      status: status || 'draft'
    };

    const product = await Product.create(productData);

    // Update seller's total products count
    await Seller.findOneAndUpdate(
      { user: req.user.id },
      { $inc: { totalProducts: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
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

// @desc    Get seller's products
// @route   GET /api/seller/products
// @access  Private/Seller
exports.getSellerProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    let query = { seller: req.user.id };
    
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }
    
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }
    
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(limit)
      .skip(startIndex);
    
    const total = await Product.countDocuments(query);
    
    const summary = {
      total: total,
      active: await Product.countDocuments({ seller: req.user.id, status: 'active' }),
      inactive: await Product.countDocuments({ seller: req.user.id, status: 'inactive' }),
      draft: await Product.countDocuments({ seller: req.user.id, status: 'draft' }),
      lowStock: await Product.countDocuments({ seller: req.user.id, stock: { $lte: 10, $gt: 0 } }),
      outOfStock: await Product.countDocuments({ seller: req.user.id, stock: 0 })
    };
    
    res.status(200).json({
      success: true,
      products,
      summary,
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

// @desc    Get single product
// @route   GET /api/seller/products/:id
// @access  Private/Seller
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    }).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/seller/products/:id
// @access  Private/Seller
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name,
      description,
      shortDescription,
      price,
      comparePrice,
      stock,
      sku,
      category,
      brand,
      tags,
      specifications,
      images,
      status
    } = req.body;

    if (name) {
      product.name = name;
      product.slug = name.toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-');
    }
    if (description) product.description = description;
    if (shortDescription) product.shortDescription = shortDescription;
    if (price) product.price = parseFloat(price);
    if (comparePrice) product.comparePrice = parseFloat(comparePrice);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (sku) product.sku = sku;
    if (category) product.category = category;
    if (brand) product.brand = brand;
    if (tags) product.tags = tags;
    if (specifications) product.specifications = specifications;
    if (status) product.status = status;
    
    if (images && images.length > 0) {
      product.images = images.map((img, index) => ({
        url: img.url,
        publicId: img.publicId,
        alt: img.alt || product.name,
        isPrimary: img.isPrimary || index === 0,
        order: index
      }));
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
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
// @route   DELETE /api/seller/products/:id
// @access  Private/Seller
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await Seller.findOneAndUpdate(
      { user: req.user.id },
      { $inc: { totalProducts: -1 } }
    );

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

// @desc    Duplicate product
// @route   POST /api/seller/products/:id/duplicate
// @access  Private/Seller
exports.duplicateProduct = async (req, res) => {
  try {
    const originalProduct = await Product.findOne({
      _id: req.params.id,
      seller: req.user.id
    });

    if (!originalProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const duplicateData = originalProduct.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.__v;
    
    duplicateData.name = `${originalProduct.name} (Copy)`;
    duplicateData.slug = `${originalProduct.slug}-copy-${Date.now()}`;
    duplicateData.status = 'draft';
    
    const duplicatedProduct = await Product.create(duplicateData);

    await Seller.findOneAndUpdate(
      { user: req.user.id },
      { $inc: { totalProducts: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Product duplicated successfully',
      product: duplicatedProduct
    });
  } catch (error) {
    console.error('Duplicate product error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update product status
// @route   PUT /api/seller/products/:id/status
// @access  Private/Seller
exports.updateProductStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller: req.user.id },
      { status },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Product ${status === 'active' ? 'published' : status === 'inactive' ? 'unpublished' : 'saved as draft'}`,
      product
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== IMAGE MANAGEMENT ====================

// @desc    Upload single product image
// @route   POST /api/seller/products/upload-image
// @access  Private/Seller
exports.uploadProductImage = async (req, res) => {
  try {
    // console.log('Upload request received:', req.file ? 'File present' : 'No file');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const imageUrl = `data:${mimeType};base64,${base64Image}`;
    
    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      publicId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload multiple images
// @route   POST /api/seller/products/upload-images
// @access  Private/Seller
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload image files'
      });
    }

    const uploadedImages = [];
    
    for (const file of req.files) {
      const base64Image = file.buffer.toString('base64');
      const mimeType = file.mimetype;
      const imageUrl = `data:${mimeType};base64,${base64Image}`;
      
      uploadedImages.push({
        url: imageUrl,
        publicId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alt: '',
        isPrimary: false
      });
    }
    
    res.status(200).json({
      success: true,
      images: uploadedImages,
      message: `${uploadedImages.length} images uploaded successfully`
    });
  } catch (error) {
    console.error('Upload multiple images error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete product image
// @route   DELETE /api/seller/products/:productId/images/:imageId
// @access  Private/Seller
exports.deleteProductImage = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.images = product.images.filter(img => img._id.toString() !== req.params.imageId);
    
    if (product.images.length > 0 && !product.images.some(img => img.isPrimary)) {
      product.images[0].isPrimary = true;
    }
    
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      images: product.images
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Set primary image
// @route   PUT /api/seller/products/:productId/images/:imageId/primary
// @access  Private/Seller
exports.setPrimaryImage = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      seller: req.user.id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.images.forEach(img => {
      img.isPrimary = img._id.toString() === req.params.imageId;
    });
    
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Primary image updated',
      images: product.images
    });
  } catch (error) {
    console.error('Set primary image error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== BULK OPERATIONS ====================

// @desc    Bulk upload products via CSV
// @route   POST /api/seller/products/bulk-upload
// @access  Private/Seller
exports.bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV file'
      });
    }

    res.status(200).json({
      success: true,
      message: 'CSV upload feature coming soon'
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Download CSV template
// @route   GET /api/seller/products/download-template
// @access  Private/Seller
exports.downloadCsvTemplate = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Template download feature coming soon'
    });
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Bulk update stock
// @route   PUT /api/seller/products/bulk-stock
// @access  Private/Seller
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;
    
    const results = [];
    for (const update of updates) {
      const product = await Product.findOneAndUpdate(
        { _id: update.productId, seller: req.user.id },
        { stock: update.newStock },
        { new: true }
      );
      
      if (product) {
        results.push({ productId: update.productId, success: true });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `${results.length} products updated`,
      results
    });
  } catch (error) {
    console.error('Bulk stock update error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Bulk delete products
// @route   DELETE /api/seller/products/bulk-delete
// @access  Private/Seller
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body;
    
    const result = await Product.deleteMany({
      _id: { $in: productIds },
      seller: req.user.id
    });
    
    await Seller.findOneAndUpdate(
      { user: req.user.id },
      { $inc: { totalProducts: -result.deletedCount } }
    );
    
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} products deleted`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== UTILITIES ====================

// @desc    Get categories for dropdown
// @route   GET /api/seller/categories
// @access  Private/Seller
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name slug');
    
    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get product statistics
// @route   GET /api/seller/products/stats/summary
// @access  Private/Seller
exports.getProductStats = async (req, res) => {
  try {
    const stats = {
      total: await Product.countDocuments({ seller: req.user.id }),
      active: await Product.countDocuments({ seller: req.user.id, status: 'active' }),
      inactive: await Product.countDocuments({ seller: req.user.id, status: 'inactive' }),
      draft: await Product.countDocuments({ seller: req.user.id, status: 'draft' }),
      lowStock: await Product.countDocuments({ seller: req.user.id, stock: { $lte: 10, $gt: 0 } }),
      outOfStock: await Product.countDocuments({ seller: req.user.id, stock: 0 })
    };
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};