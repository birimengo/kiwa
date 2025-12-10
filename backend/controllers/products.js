const Product = require('../models/Product');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const User = require('../models/User');

// Helper function to add user filter to query
const addUserFilterToQuery = (req, query, fieldName = 'createdBy') => {
  // If createdBy is in query (added by filterByUser middleware), use it
  if (req.query[fieldName]) {
    query[fieldName] = req.query[fieldName];
    console.log(`🔍 [Products] Filtering by ${fieldName} from query: ${req.query[fieldName]}`);
  } 
  // For admin-specific personal endpoints OR when view=my is specified
  else if (req.user && req.user._id) {
    // Check if this is an admin personal view
    const isAdminPersonalView = (
      req.path.includes('/admin/') || 
      req.query.view === 'my' || 
      req.query.createdBy === 'me'
    );
    
    if (isAdminPersonalView || req.user.role !== 'admin') {
      // Non-admin users or admin in personal view: always filter by their ID
      query[fieldName] = req.user._id;
      console.log(`🔍 [Products] Filtering by ${fieldName} from user: ${req.user._id} (${req.user.role} ${isAdminPersonalView ? 'personal view' : 'regular user'})`);
    } else {
      console.log(`🔍 [Products] [ADMIN SYSTEM VIEW] No user filter applied for ${fieldName}`);
    }
  }
  return query;
};

// Helper function to get user filter based on context
const getUserFilterForContext = (req, context = 'products') => {
  const fieldMap = {
    'products': 'createdBy',
    'product-stats': 'createdBy',
    'product-performance': 'createdBy',
    'product-sales': 'soldBy'
  };
  
  const fieldName = fieldMap[context];
  const filter = {};
  
  if (req.query[fieldName]) {
    filter[fieldName] = req.query[fieldName];
  } else if (req.user && req.user._id && (req.user.role !== 'admin' || req.path.includes('/admin/') || req.query.view === 'my')) {
    // Always filter for non-admins OR admins in personal view
    filter[fieldName] = req.user._id;
  }
  
  return filter;
};

// Helper function to calculate product performance rating
function calculateProductPerformance(totalProfit, profitMargin, sellThroughRate) {
  const profitScore = totalProfit > 1000 ? 100 : (totalProfit / 1000) * 100;
  const marginScore = profitMargin;
  const sellThroughScore = sellThroughRate;
  
  const overall = (profitScore + marginScore + sellThroughScore) / 3;
  
  if (overall >= 80) return 'excellent';
  if (overall >= 60) return 'good';
  if (overall >= 40) return 'average';
  return 'poor';
}

// ==================== EXISTING FUNCTIONALITIES ====================

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    console.log('📦 Starting products fetch...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Filtering
    let query = { isActive: true };
    
    // For admin personal view or regular users, filter by creator
    if (req.user && req.user._id) {
      const isAdminPersonalView = req.path.includes('/admin/') || req.query.view === 'my';
      if (req.user.role !== 'admin' || isAdminPersonalView) {
        query.createdBy = req.user._id;
        console.log(`🔍 Filtering products by creator: ${req.user._id}`);
      }
    }
    
    // Search functionality using text index
    if (req.query.search && req.query.search.trim() !== '') {
      query.$text = { $search: req.query.search.trim() };
    }
    
    // Category filter
    if (req.query.category && req.query.category !== 'All' && req.query.category !== '') {
      query.category = { $regex: new RegExp(req.query.category, 'i') };
    }
    
    // Price range filter
    if (req.query.priceRange && req.query.priceRange !== '') {
      const [min, max] = req.query.priceRange.split('-').map(Number);
      query.sellingPrice = {};
      if (!isNaN(min) && min >= 0) query.sellingPrice.$gte = min;
      if (!isNaN(max) && max > 0) query.sellingPrice.$lte = max;
    }

    // Featured products filter
    if (req.query.featured === 'true') {
      query.featured = true;
    }

    // SIMPLIFIED Sorting - remove complex sorts that require population
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'price-low':
          sort = { sellingPrice: 1 };
          break;
        case 'price-high':
          sort = { sellingPrice: -1 };
          break;
        case 'name':
          sort = { name: 1 };
          break;
        case 'featured':
          sort = { featured: -1, createdAt: -1 };
          break;
        case 'totalSold':
          sort = { totalSold: -1 };
          break;
        default:
          sort = { createdAt: -1 };
      }
    }

    // Pagination with smaller default limit
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    console.log(`🔍 Products Query:`, { 
      page, limit, skip, 
      search: req.query.search,
      category: req.query.category,
      createdBy: query.createdBy ? 'Filtered by creator' : 'No filter (admin system view)'
    });

    // OPTIMIZED QUERY: Select only essential fields and remove heavy population
    const products = await Product.find(query)
      .select('name brand sellingPrice purchasePrice category stock images description averageRating totalReviews featured createdAt totalSold lowStockAlert createdBy')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for maximum performance

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    console.log(`✅ Successfully fetched ${products.length} products out of ${total} total`);

    res.json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      },
      products,
      filterInfo: {
        isFiltered: !!query.createdBy,
        userId: query.createdBy || null,
        viewType: query.createdBy ? 'personal' : 'system'
      }
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products',
      error: error.message
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    console.log('📦 Fetching single product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(req.params.id)
      .populate('comments.user', 'name avatar')
      .populate('likes', 'name avatar')
      .populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is active (unless admin)
    if (!product.isActive && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to view this product
    if (req.user && req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this product'
      });
    }

    console.log(`✅ Successfully fetched product: ${product.name}`);

    res.json({
      success: true,
      product,
      permissionInfo: {
        canEdit: req.user && (req.user.role === 'admin' || product.createdBy._id.toString() === req.user._id.toString()),
        isOwner: req.user && product.createdBy._id.toString() === req.user._id.toString()
      }
    });
  } catch (error) {
    console.error('❌ Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product',
      error: error.message
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    console.log('🆕 Creating new product...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate required fields
    const { name, brand, sellingPrice, category, description } = req.body;
    
    if (!name || !brand || !sellingPrice || !category || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, brand, selling price, category, and description are required'
      });
    }

    // Validate selling price
    if (sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Selling price cannot be negative'
      });
    }

    // Validate purchase price if provided
    if (req.body.purchasePrice && req.body.purchasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase price cannot be negative'
      });
    }

    // Validate stock
    if (req.body.stock && req.body.stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock cannot be negative'
      });
    }

    const product = await Product.create({
      ...req.body,
      createdBy: req.user.id,
      originalQuantity: req.body.stock || 0 // Track original quantity
    });

    // Populate the created product
    await product.populate('createdBy', 'name email');

    console.log(`✅ Product created successfully: ${product.name} by ${req.user.name}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('❌ Create product error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating product',
      error: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    console.log('✏️ Updating product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    let product = await Product.findById(req.params.id).populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to update this product
    if (req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this product'
      });
    }

    // Validate prices if provided
    if (req.body.sellingPrice && req.body.sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Selling price cannot be negative'
      });
    }

    if (req.body.purchasePrice && req.body.purchasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase price cannot be negative'
      });
    }

    if (req.body.stock && req.body.stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock cannot be negative'
      });
    }

    product = await Product.findByIdAndUpdate(
      req.params.id, 
      { 
        ...req.body,
        updatedBy: req.user.id
      }, 
      {
        new: true,
        runValidators: true
      }
    ).populate('comments.user', 'name avatar')
     .populate('likes', 'name avatar')
     .populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    console.log(`✅ Product updated successfully: ${product.name} by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Product updated successfully',
      product,
      permissionInfo: {
        updatedByUser: req.user.name,
        isOwner: product.createdBy._id.toString() === req.user._id.toString()
      }
    });
  } catch (error) {
    console.error('❌ Update product error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating product',
      error: error.message
    });
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    console.log('🗑️ Deleting product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(req.params.id).populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to delete this product
    if (req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this product'
      });
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    product.updatedBy = req.user.id;
    await product.save();

    console.log(`✅ Product deleted successfully: ${product.name} by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Product deleted successfully',
      deletedBy: req.user.name,
      productName: product.name
    });
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product',
      error: error.message
    });
  }
};

// @desc    Like/Unlike product
// @route   POST /api/products/:id/like
// @access  Private
exports.likeProduct = async (req, res) => {
  try {
    console.log('❤️ Like/Unlike product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const isLiked = product.likes.includes(req.user.id);

    if (isLiked) {
      // Unlike - remove user from likes array
      product.likes.pull(req.user.id);
    } else {
      // Like - add user to likes array
      product.likes.push(req.user.id);
    }

    await product.save();

    // Populate likes to get user details
    await product.populate('likes', 'name avatar');

    res.json({
      success: true,
      message: isLiked ? 'Product unliked' : 'Product liked',
      likes: product.likes.length,
      isLiked: !isLiked, // Return the new state
      product: {
        _id: product._id,
        name: product.name,
        likes: product.likes
      }
    });
  } catch (error) {
    console.error('❌ Like product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating like',
      error: error.message
    });
  }
};

// @desc    Add comment/review to product
// @route   POST /api/products/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    console.log('💬 Adding comment to product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const { text, rating } = req.body;

    // Validate comment data
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has already commented on this product
    const existingComment = product.comments.find(
      comment => comment.user.toString() === req.user.id.toString()
    );

    if (existingComment) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    const comment = {
      user: req.user.id,
      text: text.trim(),
      rating: parseInt(rating)
    };

    product.comments.push(comment);
    await product.save();

    // Populate all comments with user data
    await product.populate('comments.user', 'name avatar');

    const newComment = product.comments[product.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      comment: newComment,
      averageRating: product.averageRating,
      totalReviews: product.comments.length
    });
  } catch (error) {
    console.error('❌ Add comment error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while adding review',
      error: error.message
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = async (req, res) => {
  try {
    console.log('⭐ Fetching featured products...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    let query = { 
      featured: true, 
      isActive: true,
      stock: { $gt: 0 } // Only products in stock
    };
    
    // For admin personal view or regular users, filter by creator
    if (req.user && req.user._id) {
      const isAdminPersonalView = req.path.includes('/admin/') || req.query.view === 'my';
      if (req.user.role !== 'admin' || isAdminPersonalView) {
        query.createdBy = req.user._id;
        console.log(`🔍 Filtering featured products by creator: ${req.user._id}`);
      }
    }

    const featuredProducts = await Product.find(query)
      .select('name brand sellingPrice category stock images description averageRating totalSold createdBy')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(); // Remove population for better performance

    console.log(`✅ Found ${featuredProducts.length} featured products`);

    res.json({
      success: true,
      count: featuredProducts.length,
      products: featuredProducts,
      filterInfo: {
        isFiltered: !!query.createdBy,
        userId: query.createdBy || null,
        viewType: query.createdBy ? 'personal' : 'system'
      }
    });
  } catch (error) {
    console.error('❌ Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured products',
      error: error.message
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    console.log(`📂 Fetching products by category: ${category}`);

    let query = { 
      category: { $regex: new RegExp(category, 'i') },
      isActive: true 
    };
    
    // For admin personal view or regular users, filter by creator
    if (req.user && req.user._id) {
      const isAdminPersonalView = req.path.includes('/admin/') || req.query.view === 'my';
      if (req.user.role !== 'admin' || isAdminPersonalView) {
        query.createdBy = req.user._id;
        console.log(`🔍 Filtering category products by creator: ${req.user._id}`);
      }
    }

    const products = await Product.find(query)
      .select('name brand sellingPrice category stock images description averageRating totalSold createdBy')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50) // Add limit for category pages
      .lean(); // Remove population for better performance

    console.log(`✅ Found ${products.length} products in category: ${category}`);

    res.json({
      success: true,
      count: products.length,
      category,
      products,
      filterInfo: {
        isFiltered: !!query.createdBy,
        userId: query.createdBy || null,
        viewType: query.createdBy ? 'personal' : 'system'
      }
    });
  } catch (error) {
    console.error('❌ Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products by category',
      error: error.message
    });
  }
};

// @desc    Get product statistics (admin only)
// @route   GET /api/products/stats
// @access  Private/Admin
exports.getProductStats = async (req, res) => {
  try {
    console.log('📊 Fetching product statistics...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Build query with proper user filtering
    let query = { isActive: true };
    
    // Add user filter if present
    const userFilter = getUserFilterForContext(req, 'product-stats');
    if (userFilter.createdBy) {
      query.createdBy = userFilter.createdBy;
    }

    console.log(`🔍 Product Stats Query:`, { 
      createdBy: query.createdBy ? 'Filtered by creator' : 'No filter (admin system view)'
    });

    const totalProducts = await Product.countDocuments(query);
    const activeProducts = await Product.countDocuments({ ...query, isActive: true });
    const outOfStockProducts = await Product.countDocuments({ ...query, stock: 0 });
    const featuredProducts = await Product.countDocuments({ ...query, featured: true });
    
    // Enhanced product statistics with inventory values
    const inventoryStats = await Product.aggregate([
      { $match: query },
      { 
        $group: { 
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
          originalValue: { $sum: { $multiply: ['$purchasePrice', '$originalQuantity'] } },
          totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$totalSold'] } },
          totalCost: { $sum: { $multiply: ['$purchasePrice', '$totalSold'] } },
          totalProfit: { 
            $sum: { 
              $multiply: [
                { $subtract: ['$sellingPrice', '$purchasePrice'] }, 
                '$totalSold'
              ] 
            } 
          },
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
          },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$stock', 0] },
                    { $lte: ['$stock', '$lowStockAlert'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get products by category with user filter
    const categoryStats = await Product.aggregate([
      { $match: query },
      { $group: { 
        _id: '$category', 
        count: { $sum: 1 },
        avgRating: { $avg: '$averageRating' },
        totalStock: { $sum: '$stock' },
        totalSold: { $sum: '$totalSold' },
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$totalSold'] } }
      }},
      { $sort: { count: -1 } }
    ]);

    const stats = inventoryStats[0] || {
      totalProducts: 0,
      totalValue: 0,
      originalValue: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      outOfStock: 0,
      lowStock: 0
    };

    console.log(`✅ Product stats fetched: ${totalProducts} total products`);

    res.json({
      success: true,
      stats: {
        ...stats,
        activeProducts,
        featuredProducts,
        categoryStats
      },
      filterInfo: {
        isFiltered: !!query.createdBy,
        userId: query.createdBy || null,
        viewType: query.createdBy ? 'personal' : 'system'
      }
    });
  } catch (error) {
    console.error('❌ Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product statistics',
      error: error.message
    });
  }
};

// @desc    Restock product
// @route   POST /api/products/:id/restock
// @access  Private/Admin
exports.restockProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('📦 Restocking product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    const { quantity, notes = '' } = req.body;

    if (!quantity || quantity <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const product = await Product.findById(req.params.id).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to restock this product
    if (req.user.role !== 'admin' && product.createdBy.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to restock this product'
      });
    }

    // Track restocked quantity
    const restockedQuantity = product.restockedQuantity || 0;
    product.restockedQuantity = restockedQuantity + quantity;

    // Update stock directly instead of using method chaining
    const previousStock = product.stock;
    const newStock = previousStock + quantity;
    
    product.stock = newStock;
    product.lastRestocked = new Date();

    // Add to stock history
    product.stockHistory.push({
      previousStock,
      newStock,
      unitsChanged: quantity,
      type: 'restock',
      reference: null,
      referenceModel: 'Restock',
      user: req.user.id,
      notes: notes || `Restocked ${quantity} units`,
      date: new Date()
    });

    // Save the product within the session
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Product restocked: ${product.name} by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Product restocked successfully',
      product: {
        _id: product._id,
        name: product.name,
        previousStock,
        newStock: product.stock,
        restockedQuantity: product.restockedQuantity,
        stockHistory: product.stockHistory.slice(-1)
      },
      restockedBy: req.user.name
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Restock product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while restocking product',
      error: error.message
    });
  }
};

// @desc    Get product stock history
// @route   GET /api/products/:id/stock-history
// @access  Private/Admin
exports.getStockHistory = async (req, res) => {
  try {
    console.log('📊 Fetching product stock history:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    const product = await Product.findById(req.params.id)
      .select('stockHistory name stock originalQuantity restockedQuantity createdBy')
      .populate('stockHistory.user', 'name email')
      .populate('stockHistory.reference', 'saleNumber')
      .populate('createdBy', 'name email')
      .sort({ 'stockHistory.date': -1 });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to view stock history
    if (req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view stock history for this product'
      });
    }

    res.json({
      success: true,
      productName: product.name,
      currentStock: product.stock,
      originalQuantity: product.originalQuantity || product.stock,
      restockedQuantity: product.restockedQuantity || 0,
      history: product.stockHistory,
      owner: product.createdBy
    });

  } catch (error) {
    console.error('❌ Get stock history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stock history',
      error: error.message
    });
  }
};

// @desc    Update stock alert level
// @route   PUT /api/products/:id/stock-alert
// @access  Private/Admin
exports.updateStockAlert = async (req, res) => {
  try {
    console.log('⚠️ Updating stock alert level for product:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    const { lowStockAlert } = req.body;

    if (!lowStockAlert || lowStockAlert < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid low stock alert level is required'
      });
    }

    const product = await Product.findById(req.params.id).populate('createdBy', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to update stock alert
    if (req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update stock alert for this product'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { lowStockAlert },
      { new: true, runValidators: true }
    );

    console.log(`✅ Stock alert updated for ${product.name} by ${req.user.name}`);

    res.json({
      success: true,
      message: 'Stock alert level updated successfully',
      product: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        lowStockAlert: updatedProduct.lowStockAlert,
        stock: updatedProduct.stock,
        isLowStock: updatedProduct.stock <= updatedProduct.lowStockAlert
      },
      updatedBy: req.user.name
    });

  } catch (error) {
    console.error('❌ Update stock alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating stock alert',
      error: error.message
    });
  }
};

// ==================== ANALYTICS ENDPOINTS ====================

// @desc    Get product performance analytics
// @route   GET /api/products/:id/performance
// @access  Private/Admin
exports.getProductPerformance = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const productId = req.params.id;

    console.log(`📈 Fetching performance for product: ${productId}, period: ${period}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(productId).populate('createdBy', 'name email');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user has permission to view performance
    if (req.user.role !== 'admin' && product.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view performance for this product'
      });
    }

    // Calculate date range based on period
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date().setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date().setDate(new Date().getDate() - 7);
        break;
      case 'month':
        startDate = new Date().setMonth(new Date().getMonth() - 1);
        break;
      case 'year':
        startDate = new Date().setFullYear(new Date().getFullYear() - 1);
        break;
      default:
        startDate = new Date().setHours(0, 0, 0, 0);
    }

    // Get sales data for this product in the period WITH USER FILTER
    let salesFilter = {
      createdAt: { $gte: new Date(startDate), $lte: endDate },
      status: 'completed',
      'items.product': new mongoose.Types.ObjectId(productId)
    };
    
    // Add user filter for sales if present
    const salesUserFilter = getUserFilterForContext(req, 'product-sales');
    if (salesUserFilter.soldBy) {
      salesFilter.soldBy = salesUserFilter.soldBy;
    }

    const salesData = await Sale.aggregate([
      {
        $match: salesFilter
      },
      {
        $unwind: '$items'
      },
      {
        $match: {
          'items.product': new mongoose.Types.ObjectId(productId)
        }
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          totalCost: { $sum: '$items.totalCost' },
          totalProfit: { $sum: '$items.profit' },
          averageSalePrice: { $avg: '$items.unitPrice' }
        }
      }
    ]);

    // Get restock history for the period
    const restockHistory = product.stockHistory.filter(
      record => record.type === 'restock' && record.date >= new Date(startDate)
    );

    const totalRestocked = restockHistory.reduce((sum, record) => sum + record.unitsChanged, 0);

    const performance = salesData[0] || {
      totalSold: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      averageSalePrice: product.sellingPrice
    };

    // Calculate additional metrics
    const profitMargin = performance.totalRevenue > 0 ? 
      (performance.totalProfit / performance.totalRevenue) * 100 : 0;

    const sellThroughRate = product.originalQuantity > 0 ? 
      (product.totalSold / product.originalQuantity) * 100 : 0;

    console.log(`✅ Product performance fetched for: ${product.name}`);

    res.json({
      success: true,
      performance: {
        ...performance,
        profitMargin,
        sellThroughRate,
        restockCount: restockHistory.length,
        totalRestocked,
        lastRestock: restockHistory.length > 0 ? 
          restockHistory[restockHistory.length - 1].date : null,
        currentStock: product.stock,
        originalQuantity: product.originalQuantity || product.stock
      },
      product: {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        stock: product.stock,
        originalQuantity: product.originalQuantity,
        totalSold: product.totalSold,
        lowStockAlert: product.lowStockAlert,
        createdBy: product.createdBy
      },
      filterInfo: {
        salesFiltered: !!salesFilter.soldBy,
        userId: req.user._id,
        viewType: salesFilter.soldBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get product performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product performance',
      error: error.message
    });
  }
};

// @desc    Get top performing products for analytics
// @route   GET /api/products/analytics/top-products
// @access  Private/Admin
exports.getTopProductsAnalytics = async (req, res) => {
  try {
    const { limit = 5, period = 'all' } = req.query;

    console.log(`🏆 Fetching top ${limit} products analytics for period: ${period}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Build product query with proper user filtering
    let productQuery = { isActive: true };
    const userFilter = getUserFilterForContext(req, 'product-performance');
    if (userFilter.createdBy) {
      productQuery.createdBy = userFilter.createdBy;
    }

    let dateFilter = {};
    if (period !== 'all') {
      let startDate;
      const endDate = new Date();
      
      switch (period) {
        case 'today':
          startDate = new Date().setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date().setDate(new Date().getDate() - 7);
          break;
        case 'month':
          startDate = new Date().setMonth(new Date().getMonth() - 1);
          break;
        case 'year':
          startDate = new Date().setFullYear(new Date().getFullYear() - 1);
          break;
        default:
          startDate = new Date().setHours(0, 0, 0, 0);
      }
      dateFilter = { createdAt: { $gte: new Date(startDate), $lte: endDate } };
    }

    console.log(`🔍 Top Products Query:`, { 
      limit,
      period,
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)'
    });

    // Get top products by sales with user filter
    const topProducts = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold totalRevenue originalQuantity restockedQuantity lowStockAlert createdAt createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    // Enhance with performance data
    const productsWithPerformance = await Promise.all(
      topProducts.map(async (product) => {
        // Get recent sales data for profit calculation WITH USER FILTER
        let salesFilter = {
          ...dateFilter,
          status: 'completed',
          'items.product': new mongoose.Types.ObjectId(product._id)
        };
        
        // Add user filter for sales if present
        const salesUserFilter = getUserFilterForContext(req, 'product-sales');
        if (salesUserFilter.soldBy) {
          salesFilter.soldBy = salesUserFilter.soldBy;
        }

        const salesData = await Sale.aggregate([
          {
            $match: salesFilter
          },
          {
            $unwind: '$items'
          },
          {
            $match: {
              'items.product': new mongoose.Types.ObjectId(product._id)
            }
          },
          {
            $group: {
              _id: null,
              periodRevenue: { $sum: '$items.totalPrice' },
              periodCost: { $sum: '$items.totalCost' },
              periodProfit: { $sum: '$items.profit' },
              periodSold: { $sum: '$items.quantity' }
            }
          }
        ]);

        const periodData = salesData[0] || {
          periodRevenue: 0,
          periodCost: 0,
          periodProfit: 0,
          periodSold: 0
        };

        // Calculate metrics
        const totalProfit = (product.sellingPrice - product.purchasePrice) * product.totalSold;
        const profitMargin = product.sellingPrice > 0 ? 
          ((product.sellingPrice - product.purchasePrice) / product.sellingPrice) * 100 : 0;

        return {
          ...product,
          performance: {
            totalProfit,
            profitMargin,
            ...periodData,
            currentValue: product.purchasePrice * product.stock,
            originalValue: product.purchasePrice * (product.originalQuantity || product.stock),
            restockedValue: product.purchasePrice * (product.restockedQuantity || 0),
            isLowStock: product.stock <= product.lowStockAlert,
            stockHealth: product.stock === 0 ? 'out-of-stock' : 
                        product.stock <= product.lowStockAlert ? 'low-stock' : 'healthy'
          }
        };
      })
    );

    console.log(`✅ Top ${productsWithPerformance.length} products analytics fetched`);

    res.json({
      success: true,
      count: productsWithPerformance.length,
      period,
      products: productsWithPerformance,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        viewType: productQuery.createdBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get top products analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching top products analytics',
      error: error.message
    });
  }
};

// @desc    Get product tracking data for analytics dashboard
// @route   GET /api/products/analytics/tracking
// @access  Private/Admin
exports.getProductTracking = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`👀 Fetching product tracking data, limit: ${limit}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Build query with proper user filtering
    let productQuery = { isActive: true };
    const userFilter = getUserFilterForContext(req, 'product-performance');
    if (userFilter.createdBy) {
      productQuery.createdBy = userFilter.createdBy;
    }

    console.log(`🔍 Product Tracking Query:`, { 
      limit,
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)'
    });

    // Get products with detailed tracking info
    const products = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold originalQuantity restockedQuantity lowStockAlert stockHistory createdAt category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    const trackingData = products.map(product => {
      // Calculate restock information
      const restockHistory = product.stockHistory.filter(record => record.type === 'restock');
      const lastRestock = restockHistory.length > 0 ? 
        restockHistory[restockHistory.length - 1] : null;

      // Calculate performance metrics
      const totalRevenue = product.sellingPrice * product.totalSold;
      const totalCost = product.purchasePrice * product.totalSold;
      const totalProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const sellThroughRate = product.originalQuantity > 0 ? 
        (product.totalSold / product.originalQuantity) * 100 : 0;

      return {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        creator: product.createdBy,
        pricing: {
          cost: product.purchasePrice,
          price: product.sellingPrice,
          profitPerUnit: product.sellingPrice - product.purchasePrice
        },
        inventory: {
          currentStock: product.stock,
          originalQuantity: product.originalQuantity || product.stock,
          restockedQuantity: product.restockedQuantity || 0,
          lowStockAlert: product.lowStockAlert,
          status: product.stock === 0 ? 'out-of-stock' : 
                  product.stock <= product.lowStockAlert ? 'low-stock' : 'healthy'
        },
        sales: {
          totalSold: product.totalSold,
          totalRevenue,
          totalCost,
          totalProfit,
          profitMargin,
          sellThroughRate
        },
        restockInfo: {
          count: restockHistory.length,
          lastRestock: lastRestock ? {
            date: lastRestock.date,
            quantity: lastRestock.unitsChanged,
            notes: lastRestock.notes
          } : null
        },
        performance: {
          rating: calculateProductPerformance(totalProfit, profitMargin, sellThroughRate),
          trend: 'stable'
        },
        timeline: {
          created: product.createdAt,
          lastActivity: lastRestock?.date || product.createdAt
        }
      };
    });

    console.log(`✅ Product tracking data fetched for ${trackingData.length} products`);

    res.json({
      success: true,
      count: trackingData.length,
      products: trackingData,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        viewType: productQuery.createdBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get product tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product tracking data',
      error: error.message
    });
  }
};

// @desc    Get admin's own products (personal view)
// @route   GET /api/products/admin/my-products
// @access  Private/Admin
exports.getAdminProducts = async (req, res) => {
  try {
    console.log('📦 Fetching admin personal products...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Always filter by current admin for personal view
    const query = { 
      isActive: true,
      createdBy: req.user._id 
    };

    // Apply filters from query params
    if (req.query.search && req.query.search.trim() !== '') {
      query.$text = { $search: req.query.search.trim() };
    }
    
    if (req.query.category && req.query.category !== 'All' && req.query.category !== '') {
      query.category = { $regex: new RegExp(req.query.category, 'i') };
    }
    
    if (req.query.priceRange && req.query.priceRange !== '') {
      const [min, max] = req.query.priceRange.split('-').map(Number);
      query.sellingPrice = {};
      if (!isNaN(min) && min >= 0) query.sellingPrice.$gte = min;
      if (!isNaN(max) && max > 0) query.sellingPrice.$lte = max;
    }

    if (req.query.featured === 'true') {
      query.featured = true;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    console.log(`🔍 Admin Personal Products Query:`, { 
      page, limit, skip,
      createdBy: req.user._id
    });

    const products = await Product.find(query)
      .select('name brand sellingPrice purchasePrice category stock images description averageRating totalReviews featured createdAt totalSold lowStockAlert')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    console.log(`✅ Admin personal products fetched: ${products.length} out of ${total}`);

    res.json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      },
      products,
      filterInfo: {
        isFiltered: true,
        userId: req.user._id,
        viewType: 'personal'
      }
    });

  } catch (error) {
    console.error('❌ Get admin products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin products',
      error: error.message
    });
  }
};

// ==================== NEW WHOLESALER PRODUCTS ENDPOINT ====================

// @desc    Get products by wholesaler ID (public endpoint)
// @route   GET /api/products/wholesaler/:wholesalerId
// @access  Public
exports.getWholesalerProducts = async (req, res) => {
  try {
    const { wholesalerId } = req.params;
    const { category, search, page = 1, limit = 100, sortBy = 'newest' } = req.query;
    
    console.log(`📦 Fetching products for wholesaler: ${wholesalerId}`);
    console.log('🔍 Query params:', { category, search, page, limit, sortBy });
    
    // Validate wholesaler ID
    if (!mongoose.Types.ObjectId.isValid(wholesalerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wholesaler ID format'
      });
    }
    
    // Build query - Filter by the wholesaler who created the product
    let query = { 
      isActive: true,
      createdBy: wholesalerId // This is the key filter - products created by this wholesaler
    };
    
    // Apply search
    if (search && search.trim() !== '') {
      query.$text = { $search: search.trim() };
    }
    
    // Apply category filter
    if (category && category !== 'All' && category !== '') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    
    // Apply sorting
    let sort = { createdAt: -1 };
    if (sortBy) {
      switch (sortBy) {
        case 'price-low':
          sort = { sellingPrice: 1 };
          break;
        case 'price-high':
          sort = { sellingPrice: -1 };
          break;
        case 'name':
          sort = { name: 1 };
          break;
        case 'featured':
          sort = { featured: -1, createdAt: -1 };
          break;
        case 'totalSold':
          sort = { totalSold: -1 };
          break;
        case 'rating':
          sort = { averageRating: -1 };
          break;
        default:
          sort = { createdAt: -1 };
      }
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log(`🔍 Wholesaler Products Query:`, { 
      wholesalerId,
      query: { ...query },
      page, limit, skip, sort
    });
    
    // Get products
    const products = await Product.find(query)
      .select('name brand sellingPrice purchasePrice category stock images description averageRating totalReviews featured createdAt totalSold lowStockAlert createdBy')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count
    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Get wholesaler info for the response
    const wholesaler = await User.findById(wholesalerId).select('name email phone createdAt');
    
    console.log(`✅ Found ${products.length} products for wholesaler ${wholesalerId} (${wholesaler?.name || 'Unknown'})`);
    
    res.json({
      success: true,
      count: products.length,
      total,
      products,
      wholesaler: wholesaler ? {
        _id: wholesaler._id,
        name: wholesaler.name,
        email: wholesaler.email,
        phone: wholesaler.phone,
        memberSince: wholesaler.createdAt
      } : null,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      },
      filterInfo: {
        isFiltered: true,
        userId: wholesalerId,
        viewType: 'wholesaler'
      }
    });
    
  } catch (error) {
    console.error('❌ Get wholesaler products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching wholesaler products',
      error: error.message
    });
  }
};