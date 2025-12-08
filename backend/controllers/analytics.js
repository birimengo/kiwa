const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Enhanced Helper function to add user filter to query
const addUserFilterToQuery = (req, query, fieldName = 'soldBy') => {
  // If createdBy/soldBy is in query (added by filterByUser middleware), use it
  if (req.query[fieldName]) {
    query[fieldName] = req.query[fieldName];
    console.log(`🔍 Filtering by ${fieldName} from query: ${req.query[fieldName]}`);
  } 
  // For admin-specific personal endpoints OR when view=my is specified
  else if (req.user && req.user._id) {
    // CRITICAL FIX: ALWAYS filter non-admin users
    if (req.user.role !== 'admin') {
      query[fieldName] = req.user._id;
      console.log(`🔍 [NON-ADMIN] Auto-filtering by ${fieldName}: ${req.user._id}`);
    } 
    // For admins, check if personal view is requested
    else {
      const isAdminPersonalView = (
        req.path.includes('/admin/') || 
        req.path.includes('/my/') ||
        req.path.includes('/user/') ||
        req.query.view === 'my' || 
        req.query.filter === 'my' ||
        req.query.soldBy === 'me' || 
        req.query.createdBy === 'me'
      );
      
      if (isAdminPersonalView) {
        // Admin in personal view: filter by their ID
        query[fieldName] = req.user._id;
        console.log(`🔍 [ADMIN PERSONAL] Filtering by ${fieldName}: ${req.user._id}`);
      } else {
        // Admin in system view: no filter (sees all)
        console.log(`🔍 [ADMIN SYSTEM VIEW] No user filter applied for ${fieldName}`);
      }
    }
  }
  return query;
};

// Helper function to add date range filter
const addDateRangeFilter = (period, query) => {
  let startDate, endDate = new Date();
  
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
  
  query.createdAt = { $gte: new Date(startDate), $lte: endDate };
  return query;
};

// Helper function to get user filter based on context
const getUserFilterForContext = (req, context = 'sales') => {
  const fieldMap = {
    'sales': 'soldBy',
    'products': 'createdBy',
    'inventory': 'createdBy',
    'performance-sales': 'soldBy',
    'performance-products': 'createdBy'
  };
  
  const fieldName = fieldMap[context];
  const filter = {};
  
  if (req.query[fieldName]) {
    filter[fieldName] = req.query[fieldName];
  } else if (req.user && req.user._id) {
    // CRITICAL FIX: ALWAYS filter non-admin users
    if (req.user.role !== 'admin') {
      filter[fieldName] = req.user._id;
      console.log(`🔍 [NON-ADMIN CONTEXT] Auto-filtering ${context} by ${fieldName}: ${req.user._id}`);
    }
    // For admins, check if personal view is requested
    else if (req.path.includes('/admin/') || req.path.includes('/my/') || 
             req.path.includes('/user/') || req.query.view === 'my') {
      filter[fieldName] = req.user._id;
      console.log(`🔍 [ADMIN PERSONAL CONTEXT] Filtering ${context} by ${fieldName}: ${req.user._id}`);
    }
    // Otherwise, admin sees all data (no filter)
  }
  
  return filter;
};

// @desc    Get sales overview analytics
// @route   GET /api/analytics/sales/overview
// @route   GET /api/analytics/user/sales-overview
// @route   GET /api/analytics/admin/sales-overview
// @access  Private
exports.getSalesOverview = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    console.log(`📊 Fetching sales overview for period: ${period}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build base query
    let baseQuery = {
      status: 'completed'
    };
    
    // Add date range filter
    baseQuery = addDateRangeFilter(period, baseQuery);
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, baseQuery, 'soldBy');

    console.log(`🔍 Sales Overview Query:`, { 
      period,
      soldBy: baseQuery.soldBy ? 'Filtered by user' : 'No filter (admin system view)',
      dateRange: baseQuery.createdAt,
      userRole: req.user?.role,
      path: req.path
    });

    // Sales statistics
    const salesStats = await Sale.aggregate([
      {
        $match: baseQuery
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          totalItemsSold: { $sum: { $sum: '$items.quantity' } },
          averageSale: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Daily sales trend for the period
    const dailySales = await Sale.aggregate([
      {
        $match: baseQuery
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          dailyRevenue: { $sum: '$totalAmount' },
          dailySales: { $sum: 1 },
          dailyProfit: { $sum: '$totalProfit' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Payment method breakdown
    const paymentMethods = await Sale.aggregate([
      {
        $match: baseQuery
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const result = salesStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalItemsSold: 0,
      averageSale: 0
    };

    console.log(`✅ Sales overview fetched for ${period} - ${result.totalSales} sales`);

    res.json({
      success: true,
      period,
      overview: result,
      trends: {
        dailySales,
        paymentMethods
      },
      filterInfo: {
        isFiltered: !!baseQuery.soldBy,
        userId: baseQuery.soldBy || null,
        userRole: req.user?.role,
        viewType: baseQuery.soldBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });

  } catch (error) {
    console.error('❌ Get sales overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales overview',
      error: error.message
    });
  }
};

// @desc    Get product analytics
// @route   GET /api/analytics/products
// @route   GET /api/analytics/user/product-analytics
// @route   GET /api/analytics/admin/product-analytics
// @access  Private
exports.getProductAnalytics = async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    console.log(`📈 Fetching product analytics for period: ${period}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build base query for products
    let productQuery = { isActive: true };
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Product Analytics Query:`, { 
      period,
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)',
      userRole: req.user?.role,
      path: req.path
    });

    // Get product statistics with user filter
    const productStats = await Product.aggregate([
      { $match: productQuery },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
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

    // Get top selling products with user filter
    const topProducts = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(10)
      .lean();

    // Category performance with user filter
    const categoryPerformance = await Product.aggregate([
      { $match: productQuery },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalSold: { $sum: '$totalSold' },
          totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$totalSold'] } },
          averageRating: { $avg: '$averageRating' },
          totalStock: { $sum: '$stock' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Stock analysis with user filter
    const stockAnalysis = {
      healthy: await Product.countDocuments({ 
        ...productQuery,
        stock: { $gt: 10 } 
      }),
      lowStock: await Product.countDocuments({ 
        ...productQuery,
        stock: { $gt: 0, $lte: 10 } 
      }),
      outOfStock: await Product.countDocuments({ 
        ...productQuery,
        stock: 0 
      })
    };

    const stats = productStats[0] || {
      totalProducts: 0,
      totalValue: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      outOfStock: 0,
      lowStock: 0
    };

    console.log(`✅ Product analytics fetched - ${stats.totalProducts} products`);

    res.json({
      success: true,
      period,
      stats,
      topProducts,
      categories: categoryPerformance,
      stockAnalysis,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });

  } catch (error) {
    console.error('❌ Get product analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product analytics',
      error: error.message
    });
  }
};

// @desc    Get inventory analytics
// @route   GET /api/analytics/inventory
// @route   GET /api/analytics/user/inventory
// @route   GET /api/analytics/admin/inventory
// @access  Private
exports.getInventoryAnalytics = async (req, res) => {
  try {
    console.log('📦 Fetching inventory analytics...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build base query
    let productQuery = { isActive: true };
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Inventory Query:`, { 
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)',
      userRole: req.user?.role,
      path: req.path
    });

    const inventoryStats = await Product.aggregate([
      { $match: productQuery },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$stock', '$purchasePrice'] } },
          originalStockValue: { $sum: { $multiply: ['$originalQuantity', '$purchasePrice'] } },
          restockedValue: { $sum: { $multiply: ['$restockedQuantity', '$purchasePrice'] } },
          averageStock: { $avg: '$stock' },
          totalItems: { $sum: '$stock' }
        }
      }
    ]);

    // Low stock products with user filter
    const lowStockProducts = await Product.find({
      ...productQuery,
      $expr: { $lte: ['$stock', '$lowStockAlert'] }
    })
    .select('name brand stock lowStockAlert purchasePrice sellingPrice createdBy')
    .populate('createdBy', 'name email')
    .sort({ stock: 1 })
    .limit(20)
    .lean();

    // Stock movement trends with user filter - FIXED QUERY
    const stockMovement = await Product.aggregate([
      { $match: productQuery },
      { $unwind: '$stockHistory' },
      {
        $match: {
          'stockHistory.date': {
            $gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$stockHistory.date' }
          },
          restocks: {
            $sum: {
              $cond: [{ $eq: ['$stockHistory.type', 'restock'] }, 1, 0]
            }
          },
          sales: {
            $sum: {
              $cond: [{ $eq: ['$stockHistory.type', 'sale'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const stats = inventoryStats[0] || {
      totalProducts: 0,
      totalStockValue: 0,
      originalStockValue: 0,
      restockedValue: 0,
      averageStock: 0,
      totalItems: 0
    };

    console.log(`✅ Inventory analytics fetched - ${stats.totalProducts} products`);

    res.json({
      success: true,
      stats,
      lowStockProducts,
      stockMovement,
      alerts: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: await Product.countDocuments({ ...productQuery, stock: 0 })
      },
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });

  } catch (error) {
    console.error('❌ Get inventory analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory analytics',
      error: error.message
    });
  }
};

// @desc    Get performance metrics
// @route   GET /api/analytics/performance
// @route   GET /api/analytics/user/performance
// @route   GET /api/analytics/admin/performance
// @access  Private
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    console.log(`🚀 Fetching performance metrics for period: ${period}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build sales query
    let salesQuery = {
      status: 'completed'
    };
    
    // Add date range filter
    salesQuery = addDateRangeFilter(period, salesQuery);
    
    // Add user filter for sales - automatic based on user role and route
    addUserFilterToQuery(req, salesQuery, 'soldBy');

    console.log(`🔍 Performance Query - Sales:`, { 
      period,
      soldBy: salesQuery.soldBy ? 'Filtered by seller' : 'No filter (admin system view)',
      dateRange: salesQuery.createdAt,
      userRole: req.user?.role,
      path: req.path
    });

    // Sales performance with user filter
    const salesPerformance = await Sale.aggregate([
      {
        $match: salesQuery
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: 1 },
          averageSaleValue: { $avg: '$totalAmount' },
          averageProfitPerSale: { $avg: '$totalProfit' }
        }
      }
    ]);

    // Build product query
    let productQuery = { isActive: true };
    
    // Add user filter for products - automatic based on user role and route
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Performance Query - Products:`, { 
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)',
      userRole: req.user?.role,
      path: req.path
    });

    // Product performance with user filter
    const productPerformance = await Product.aggregate([
      { $match: productQuery },
      {
        $group: {
          _id: null,
          averageProfitMargin: {
            $avg: {
              $cond: [
                { $gt: ['$sellingPrice', 0] },
                { $multiply: [{ $divide: [{ $subtract: ['$sellingPrice', '$purchasePrice'] }, '$sellingPrice'] }, 100] },
                0
              ]
            }
          },
          totalSellThroughRate: {
            $avg: {
              $cond: [
                { $gt: ['$originalQuantity', 0] },
                { $multiply: [{ $divide: ['$totalSold', '$originalQuantity'] }, 100] },
                0
              ]
            }
          },
          bestSellingProduct: { $max: '$totalSold' }
        }
      }
    ]);

    // Inventory performance with user filter
    const inventoryPerformance = await Product.aggregate([
      { $match: productQuery },
      {
        $group: {
          _id: null,
          inventoryTurnover: {
            $avg: {
              $cond: [
                { $gt: ['$stock', 0] },
                { $divide: ['$totalSold', '$stock'] },
                0
              ]
            }
          },
          stockoutRate: {
            $avg: {
              $cond: [
                { $eq: ['$stock', 0] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const salesData = salesPerformance[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      averageSaleValue: 0,
      averageProfitPerSale: 0
    };

    const productData = productPerformance[0] || {
      averageProfitMargin: 0,
      totalSellThroughRate: 0,
      bestSellingProduct: 0
    };

    const inventoryData = inventoryPerformance[0] || {
      inventoryTurnover: 0,
      stockoutRate: 0
    };

    console.log(`✅ Performance metrics fetched - ${salesData.totalSales} sales`);

    res.json({
      success: true,
      period,
      metrics: {
        sales: salesData,
        products: productData,
        inventory: inventoryData,
        overallScore: calculateOverallScore(salesData, productData, inventoryData)
      },
      filterInfo: {
        salesFiltered: !!salesQuery.soldBy,
        productsFiltered: !!productQuery.createdBy,
        userRole: req.user?.role,
        viewType: (salesQuery.soldBy || productQuery.createdBy) ? 'personal' : 'system',
        accessedVia: req.path
      }
    });

  } catch (error) {
    console.error('❌ Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance metrics',
      error: error.message
    });
  }
};

// @desc    Get daily performance
// @route   GET /api/analytics/daily-performance
// @route   GET /api/analytics/user/daily-performance
// @route   GET /api/analytics/admin/daily-performance
// @access  Private
exports.getDailyPerformance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`📅 Fetching daily performance for: ${targetDate.toDateString()}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build sales query
    let salesQuery = {
      createdAt: { $gte: targetDate, $lt: nextDay },
      status: 'completed'
    };
    
    // Add user filter for sales - automatic based on user role and route
    addUserFilterToQuery(req, salesQuery, 'soldBy');

    // Build product query
    let productQuery = { isActive: true };
    
    // Add user filter for products - automatic based on user role and route
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Daily Performance Query:`, { 
      date: targetDate.toISOString().split('T')[0],
      soldBy: salesQuery.soldBy ? 'Filtered' : 'No filter',
      createdBy: productQuery.createdBy ? 'Filtered' : 'No filter',
      userRole: req.user?.role,
      path: req.path
    });

    // Daily sales with user filter
    const dailySales = await Sale.aggregate([
      {
        $match: salesQuery
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          totalSales: { $sum: 1 },
          totalItemsSold: { $sum: { $sum: '$items.quantity' } },
          averageSaleValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Products sold today with user filter
    const productsSoldToday = await Sale.aggregate([
      {
        $match: salesQuery
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $match: productQuery
      },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          brand: { $first: '$productDetails.brand' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.totalPrice' },
          profit: { $sum: '$items.profit' }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);

    // Inventory changes today with user filter
    const inventoryChanges = await Product.aggregate([
      { $match: productQuery },
      { $unwind: '$stockHistory' },
      {
        $match: {
          'stockHistory.date': { $gte: targetDate, $lt: nextDay }
        }
      },
      {
        $group: {
          _id: '$name',
          brand: { $first: '$brand' },
          stockChanges: {
            $push: {
              type: '$stockHistory.type',
              unitsChanged: '$stockHistory.unitsChanged',
              notes: '$stockHistory.notes',
              time: '$stockHistory.date'
            }
          }
        }
      }
    ]);

    const dailyData = dailySales[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      totalItemsSold: 0,
      averageSaleValue: 0
    };

    console.log(`✅ Daily performance fetched for ${targetDate.toDateString()} - ${dailyData.totalSales} sales`);

    res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      performance: dailyData,
      topProducts: productsSoldToday,
      inventoryChanges,
      summary: {
        day: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        isToday: isToday(targetDate),
        performanceRating: rateDailyPerformance(dailyData)
      },
      filterInfo: {
        salesFiltered: !!salesQuery.soldBy,
        productsFiltered: !!productQuery.createdBy,
        userRole: req.user?.role,
        viewType: salesQuery.soldBy || productQuery.createdBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });

  } catch (error) {
    console.error('❌ Get daily performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching daily performance',
      error: error.message
    });
  }
};

// @desc    Get product tracking data
// @route   GET /api/analytics/product-tracking
// @route   GET /api/analytics/user/product-tracking
// @route   GET /api/analytics/admin/product-tracking
// @access  Private
exports.getProductTracking = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`👀 Fetching product tracking data, limit: ${limit}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    console.log('📍 Path:', req.path);

    // Build base query
    let productQuery = { isActive: true };
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Product Tracking Query:`, { 
      limit,
      createdBy: productQuery.createdBy ? 'Filtered by creator' : 'No filter (admin system view)',
      userRole: req.user?.role,
      path: req.path
    });

    const products = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold originalQuantity restockedQuantity lowStockAlert stockHistory createdAt category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    const trackingData = products.map(product => {
      const restockHistory = product.stockHistory.filter(record => record.type === 'restock');
      const lastRestock = restockHistory.length > 0 ? 
        restockHistory[restockHistory.length - 1] : null;

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
      summary: {
        totalTracked: trackingData.length,
        healthyStock: trackingData.filter(p => p.inventory.status === 'healthy').length,
        lowStock: trackingData.filter(p => p.inventory.status === 'low-stock').length,
        outOfStock: trackingData.filter(p => p.inventory.status === 'out-of-stock').length
      },
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system',
        accessedVia: req.path
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

// Helper functions
function calculateOverallScore(sales, products, inventory) {
  const salesScore = sales.totalRevenue > 1000 ? 100 : (sales.totalRevenue / 1000) * 100;
  const profitScore = products.averageProfitMargin || 0;
  const inventoryScore = (1 - (inventory.stockoutRate || 0)) * 100;
  
  return Math.round((salesScore + profitScore + inventoryScore) / 3);
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

function rateDailyPerformance(dailyData) {
  if (dailyData.totalRevenue >= 1000) return 'excellent';
  if (dailyData.totalRevenue >= 500) return 'good';
  if (dailyData.totalRevenue >= 100) return 'average';
  return 'poor';
}

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