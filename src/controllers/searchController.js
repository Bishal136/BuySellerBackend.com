const Product = require('../models/Product');
const SearchAnalytics = require('../models/SearchAnalytics');
const mongoose = require('mongoose');

// @desc    Advanced search with Atlas Search, Facets, and Filtering
// @route   GET /api/search
// @access  Public
exports.advancedSearch = async (req, res) => {
  try {
    const {
      q = '',
      page = 1,
      limit = 12,
      sort = 'relevance',
      minPrice,
      maxPrice,
      category,
      brand,
      rating,
      inStock,
      discount
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skipNum = (pageNum - 1) * limitNum;

    // Record Analytics if it's a new query (not just pagination)
    if (q && pageNum === 1) {
      const userId = req.user ? req.user.id : null;
      await SearchAnalytics.findOneAndUpdate(
        { query: q.toLowerCase(), userId },
        { 
          $inc: { count: 1 },
          lastSearchedAt: Date.now()
        },
        { upsert: true, new: true }
      );
    }

    // Pipeline building
    let pipeline = [];

    // 1. Search Stage (Fuzzy matching with MongoDB Atlas Search)
    if (q) {
      pipeline.push({
        $search: {
          index: 'default', // MUST be created in Atlas: { mappings: { dynamic: true } }
          text: {
            query: q,
            path: ['name', 'description', 'brand', 'tags', 'category.name'],
            fuzzy: {
              maxEdits: 2,
              prefixLength: 1
            }
          }
        }
      });
    }

    // 2. Base Match (Status active)
    let matchStage = { status: 'active' };

    // Apply Filters
    if (minPrice || maxPrice) {
      matchStage.price = {};
      if (minPrice) matchStage.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.price.$lte = parseFloat(maxPrice);
    }

    if (category) {
      // Handle multiple categories if comma separated
      const categories = category.split(',').map(c => new mongoose.Types.ObjectId(c));
      matchStage.category = { $in: categories };
    }

    if (brand) {
      const brands = brand.split(',');
      matchStage.brand = { $in: brands };
    }

    if (rating) {
      matchStage['ratings.average'] = { $gte: parseFloat(rating) };
    }

    if (inStock === 'true') {
      matchStage.stock = { $gt: 0 };
    }

    if (discount === 'true') {
      matchStage.comparePrice = { $gt: 0 };
      matchStage.$expr = { $lt: ["$price", "$comparePrice"] };
    }

    pipeline.push({ $match: matchStage });

    // 3. Sorting
    let sortStage = {};
    if (q && sort === 'relevance') {
      sortStage = { score: { $meta: 'textScore' } }; // If using text index instead of $search, but for $search it's already sorted by score unless overridden.
      // Wait, Atlas Search automatically sorts by score.
    } else {
      switch (sort) {
        case 'price_asc': sortStage.price = 1; break;
        case 'price_desc': sortStage.price = -1; break;
        case 'newest': sortStage.createdAt = -1; break;
        case 'best_selling': sortStage.soldCount = -1; break;
        case 'rating': sortStage['ratings.average'] = -1; break;
        default: 
          if(q) {
            // Keep Atlas Search score sorting by default
          } else {
             sortStage.createdAt = -1;
          }
      }
    }

    if (Object.keys(sortStage).length > 0) {
      pipeline.push({ $sort: sortStage });
    }

    // 4. Facets (For counts and pagination)
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skipNum },
          { $limit: limitNum },
          // Lookup category and seller data
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'categoryInfo'
            }
          },
          {
            $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true }
          }
        ],
        categoriesFacet: [
          { $group: { _id: "$category", count: { $sum: 1 } } }
        ],
        brandsFacet: [
          { $group: { _id: "$brand", count: { $sum: 1 } } },
          { $match: { _id: { $ne: null } } }
        ]
      }
    });

    // We also want to update the result count in Analytics if it was a search
    let results = [];
    try {
      results = await Product.aggregate(pipeline);
    } catch (error) {
      // Fallback if Atlas Search is not configured (e.g. local MongoDB)
      console.warn('Atlas Search aggregation failed, falling back to regex search. Original error:', error.message);
      
      let fallbackPipeline = [];
      let fallbackMatch = { ...matchStage };
        
        if (q) {
          fallbackMatch.$or = [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
            { brand: { $regex: q, $options: 'i' } }
          ];
        }
        
        fallbackPipeline.push({ $match: fallbackMatch });
        if (Object.keys(sortStage).length > 0) {
          fallbackPipeline.push({ $sort: sortStage });
        }
        
        fallbackPipeline.push({
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: skipNum },
              { $limit: limitNum },
              {
                $lookup: {
                  from: 'categories',
                  localField: 'category',
                  foreignField: '_id',
                  as: 'categoryInfo'
                }
              },
              {
                $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true }
              }
            ],
            categoriesFacet: [
              { $group: { _id: "$category", count: { $sum: 1 } } }
            ],
            brandsFacet: [
              { $group: { _id: "$brand", count: { $sum: 1 } } },
              { $match: { _id: { $ne: null } } }
            ]
          }
        });
        
        results = await Product.aggregate(fallbackPipeline);
    }

    const output = results[0];
    const total = output.metadata[0] ? output.metadata[0].total : 0;
    
    // Update analytics with result count
    if (q && pageNum === 1) {
      const userId = req.user ? req.user.id : null;
      await SearchAnalytics.findOneAndUpdate(
        { query: q.toLowerCase(), userId },
        { resultsCount: total }
      );
    }

    // Populate category names for facets
    const categoryIds = output.categoriesFacet.map(c => c._id);
    const categories = await mongoose.model('Category').find({ _id: { $in: categoryIds } }).select('name slug');
    
    const enrichedCategoriesFacet = output.categoriesFacet.map(c => {
      const catInfo = categories.find(cat => cat._id.toString() === c._id.toString());
      return {
        _id: c._id,
        count: c.count,
        name: catInfo ? catInfo.name : 'Unknown'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        products: output.data.map(p => ({
          ...p,
          category: p.categoryInfo // Map back to match frontend expectations
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        facets: {
          categories: enrichedCategoriesFacet,
          brands: output.brandsFacet
        }
      }
    });
  } catch (error) {
    console.error('Advanced Search error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get autocomplete suggestions
// @route   GET /api/search/suggestions
// @access  Public
exports.getSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(200).json({ success: true, suggestions: [], popular: [] });
    }

    // Try Atlas Search first for typos, fallback to regex
    let suggestions = [];
    try {
      suggestions = await Product.aggregate([
        {
          $search: {
            index: 'default',
            autocomplete: {
              query: q,
              path: 'name',
              fuzzy: { maxEdits: 1 }
            }
          }
        },
        { $match: { status: 'active' } },
        { $limit: 8 },
        { $project: { name: 1, slug: 1, price: 1, images: { $slice: 1 } } }
      ]);
    } catch (e) {
      // Fallback
      suggestions = await Product.find({
        status: 'active',
        name: { $regex: q, $options: 'i' }
      })
      .select('name slug price images')
      .limit(8);
    }

    // Get popular searches
    const popular = await SearchAnalytics.find({ resultsCount: { $gt: 0 } })
      .sort({ count: -1 })
      .limit(5)
      .select('query');

    res.status(200).json({
      success: true,
      suggestions,
      popular: popular.map(p => p.query)
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get recent and popular searches
// @route   GET /api/search/analytics
// @access  Public
exports.getSearchAnalytics = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    let recent = [];
    if (userId) {
      recent = await SearchAnalytics.find({ userId })
        .sort({ lastSearchedAt: -1 })
        .limit(5)
        .select('query');
    }

    const popular = await SearchAnalytics.find({ resultsCount: { $gt: 0 } })
      .sort({ count: -1 })
      .limit(8)
      .select('query');

    res.status(200).json({
      success: true,
      recent: recent.map(r => r.query),
      popular: popular.map(p => p.query)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
