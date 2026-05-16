const User = require('../models/User');
const Product = require('../models/Product');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (add to your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('wishlist', 'name price images ratings slug stock brand')
      .populate('recentlyViewed.product', 'name price images ratings slug brand');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user addresses
// @route   GET /api/users/addresses
// @access  Private
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      addresses: user.addresses || []
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { name, street, city, state, postalCode, country, phone, isDefault } = req.body;

    if (!name || !street || !city || !state || !postalCode || !country || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all address fields'
      });
    }

    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    if (user.addresses.length === 0) {
      user.addresses.push({
        name,
        street,
        city,
        state,
        postalCode,
        country,
        phone,
        isDefault: true
      });
    } else {
      user.addresses.push({
        name,
        street,
        city,
        state,
        postalCode,
        country,
        phone,
        isDefault: isDefault || false
      });
    }

    await user.save();

    res.status(201).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update address
// @route   PUT /api/users/addresses/:id
// @access  Private
exports.updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const addressId = req.params.id;
    const updates = req.body;

    const addressIndex = user.addresses.findIndex(
      addr => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    if (updates.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    Object.keys(updates).forEach(key => {
      if (user.addresses[addressIndex][key] !== undefined) {
        user.addresses[addressIndex][key] = updates[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/users/addresses/:id
// @access  Private
exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const addressId = req.params.id;

    const addressToDelete = user.addresses.find(
      addr => addr._id.toString() === addressId
    );

    if (!addressToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const wasDefault = addressToDelete.isDefault;
    
    user.addresses = user.addresses.filter(
      addr => addr._id.toString() !== addressId
    );

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get wishlist
// @route   GET /api/users/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('wishlist', 'name price images ratings slug stock brand');
    
    res.status(200).json({
      success: true,
      wishlist: user.wishlist || []
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add to wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
exports.addToWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.productId;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    await user.populate('wishlist', 'name price images ratings slug stock brand');

    res.status(200).json({
      success: true,
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Remove from wishlist
// @route   DELETE /api/users/wishlist/:productId
// @access  Private
exports.removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.productId;

    user.wishlist = user.wishlist.filter(
      id => id.toString() !== productId
    );

    await user.save();
    await user.populate('wishlist', 'name price images ratings slug stock brand');

    res.status(200).json({
      success: true,
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get recently viewed products
// @route   GET /api/users/recently-viewed
// @access  Private
exports.getRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('recentlyViewed.product', 'name price images ratings slug brand stock');
    
    res.status(200).json({
      success: true,
      recentlyViewed: user.recentlyViewed || []
    });
  } catch (error) {
    console.error('Get recently viewed error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add recently viewed product
// @route   POST /api/users/recently-viewed/:productId
// @access  Private
exports.addRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const productId = req.params.productId;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    user.recentlyViewed = user.recentlyViewed.filter(
      item => item.product.toString() !== productId
    );

    user.recentlyViewed.unshift({
      product: productId,
      viewedAt: new Date()
    });

    if (user.recentlyViewed.length > 20) {
      user.recentlyViewed = user.recentlyViewed.slice(0, 20);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Product added to recently viewed'
    });
  } catch (error) {
    console.error('Add recently viewed error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Clear recently viewed
// @route   DELETE /api/users/recently-viewed
// @access  Private
exports.clearRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.recentlyViewed = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Recently viewed cleared successfully'
    });
  } catch (error) {
    console.error('Clear recently viewed error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload profile avatar
// @route   POST /api/users/upload-avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    console.log('Upload avatar request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    console.log('File received:', req.file.originalname);

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old avatar from Cloudinary if exists
    if (user.profileImage && user.profileImage.includes('cloudinary')) {
      try {
        const publicId = user.profileImage.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`avatars/${publicId}`);
        // console.log('Old avatar deleted');
      } catch (error) {
        // console.error('Error deleting old avatar:', error);
      }
    }

    // Upload to Cloudinary using buffer
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          width: 300,
          height: 300,
          crop: 'fill',
          gravity: 'face'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(req.file.buffer);
    });

    // console.log('Uploaded to Cloudinary:', result.secure_url);

    user.profileImage = result.secure_url;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      profileImage: user.profileImage,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload avatar'
    });
  }
};

// @desc    Delete profile avatar
// @route   DELETE /api/users/delete-avatar
// @access  Private
exports.deleteAvatar = async (req, res) => {
  try {
    // console.log('Delete avatar request received');

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete avatar from Cloudinary if exists
    if (user.profileImage && user.profileImage.includes('cloudinary')) {
      try {
        const publicId = user.profileImage.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`avatars/${publicId}`);
        // console.log('Avatar deleted from Cloudinary');
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
      }
    }

    // Set default avatar
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff&rounded=true&size=200`;
    
    user.profileImage = defaultAvatar;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
      profileImage: user.profileImage
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload generic image (e.g. for reviews)
// @route   POST /api/users/upload
// @access  Private
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Upload to Cloudinary using buffer
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'reviews',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};