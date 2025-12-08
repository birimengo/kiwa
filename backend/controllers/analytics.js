// controllers/analyticsController.js
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Helper function to add user filter based on route and user role
const addUserFilterToQuery = (req, query, fieldName = 'soldBy') => {
  console.log(`🔍 Analytics: Path=${req.path}, User=${req.user?.name} (${req.user?.role})`);
  
  // Always filter for non-admin users
  if (req.user && req.user._id && req.user.role !== 'admin') {
    query[fieldName] = req.user._id;
    console.log(`🔍 [NON-ADMIN] Filtering by ${fieldName}: ${req.user._id}`);
    return query;
  }
  
  // For admin users, check route to determine view
  if (req.user && req.user._id && req.user.role === 'admin') {
    // Determine if this is a personal view route
    const isPersonalView = req.path.includes('/user/') || 
                          req.path.includes('/admin/') ||
                          req.path.includes('/my/');
    
    if (isPersonalView) {
      // Admin personal view - filter to their data
      query[fieldName] = req.user._id;
      console.log(`🔍 [ADMIN PERSONAL] Filtering by ${fieldName}: ${req.user._id}`);
    } else {
      // Admin system view - no filter (sees all)
      console.log(`🔍 [ADMIN SYSTEM] No filter - seeing all data`);
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

// Get consolidated analytics data (for frontend)
exports.getMyAnalytics = async (req, res) => {
  try {
    const { period = 'week', limit = 8 } = req.query;
    
    console.log(`📊 Consolidated Analytics - Path: ${req.path}, User: ${req.user?.name}, Period: ${period}`);

    // Determine if this is personal view
    const isPersonalView = req.path.includes('/user/') || 
                          req.path.includes('/admin/') ||
                          req.path.includes('/my/');
    
    // Build sales query
    let salesQuery = { status: 'completed' };
    salesQuery = addDateRangeFilter(period, salesQuery);
    
    // Build product query
    let productQuery = { isActive: true };
    
    // Apply user filtering for personal view or non-admin users
    if (req.user && req.user._id) {
      if (req.user.role !== 'admin') {
        // Non-admin: always personal view
        salesQuery.soldBy = req.user._id;
        productQuery.createdBy = req.user._id;
      } else if (isPersonalView) {
        // Admin in personal view: filter to their data
        salesQuery.soldBy = req.user._id;
        productQuery.createdBy = req.user._id;
      }
      // Admin in system view: no filter (sees all)
    }

    console.log(`🔍 Consolidated Query:`, { 
      period,
      isPersonalView,
      userRole: req.user?.role,
      salesFiltered: !!salesQuery.soldBy,
      productsFiltered: !!productQuery.createdBy
    });

    // ============================================
    // 1. SALES OVERVIEW
    // ============================================
    const salesStats = await Sale.aggregate([
      { $match: salesQuery },
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

    const salesOverview = salesStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalItemsSold: 0,
      averageSale: 0
    };

    // ============================================
    // 2. PRODUCT ANALYTICS
    // ============================================
    const productAnalyticsAgg = await Product.aggregate([
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
          outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockAlert'] }] },
                1, 0
              ]
            }
          }
        }
      }
    ]);

    const productAnalytics = productAnalyticsAgg[0] || {
      totalProducts: 0,
      totalValue: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      outOfStock: 0,
      lowStock: 0
    };

    // ============================================
    // 3. TOP PRODUCTS
    // ============================================
    const topProducts = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    // ============================================
    // 4. INVENTORY ANALYTICS
    // ============================================
    const inventoryAnalyticsAgg = await Product.aggregate([
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

    const inventoryAnalytics = inventoryAnalyticsAgg[0] || {
      totalProducts: 0,
      totalStockValue: 0,
      originalStockValue: 0,
      restockedValue: 0,
      averageStock: 0,
      totalItems: 0
    };

    // ============================================
    // 5. PERFORMANCE METRICS
    // ============================================
    const salesPerformance = await Sale.aggregate([
      { $match: salesQuery },
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
          }
        }
      }
    ]);

    const performanceMetrics = {
      sales: salesPerformance[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        averageSaleValue: 0,
        averageProfitPerSale: 0
      },
      products: productPerformance[0] || {
        averageProfitMargin: 0
      }
    };

    // ============================================
    // 6. DAILY PERFORMANCE (Today's performance)
    // ============================================
    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    let dailySalesQuery = {
      createdAt: { $gte: targetDate, $lt: nextDay },
      status: 'completed'
    };
    
    // Apply same user filter for daily sales
    if (salesQuery.soldBy) {
      dailySalesQuery.soldBy = salesQuery.soldBy;
    }

    const dailyPerformanceAgg = await Sale.aggregate([
      { $match: dailySalesQuery },
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

    const dailyPerformance = {
      performance: dailyPerformanceAgg[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        totalItemsSold: 0,
        averageSaleValue: 0
      },
      summary: {
        day: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        isToday: isToday(targetDate),
        performanceRating: rateDailyPerformance(dailyPerformanceAgg[0] || { totalRevenue: 0 })
      }
    };

    // ============================================
    // 7. PRODUCT TRACKING
    // ============================================
    const trackingProducts = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold originalQuantity restockedQuantity lowStockAlert category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    const productTracking = trackingProducts.map(product => {
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
        createdBy: product.createdBy,
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
        performance: {
          rating: calculateProductPerformance(totalProfit, profitMargin, sellThroughRate)
        }
      };
    });

    // ============================================
    // 8. RESPONSE
    // ============================================
    const consolidatedData = {
      salesOverview,
      productAnalytics,
      topProducts,
      inventoryAnalytics,
      performanceMetrics,
      dailyPerformance,
      productTracking
    };

    console.log(`✅ Consolidated analytics: ${productAnalytics.totalProducts} products, ${salesOverview.totalSales} sales`);

    res.json({
      success: true,
      period,
      ...consolidatedData,
      filterInfo: {
        isPersonalView: !!salesQuery.soldBy,
        userRole: req.user?.role,
        userId: salesQuery.soldBy || null,
        viewType: salesQuery.soldBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Consolidated analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching consolidated analytics',
      error: error.message
    });
  }
};

// Get sales overview analytics (standalone)
exports.getSalesOverview = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    console.log(`📊 Sales Overview - Path: ${req.path}, User: ${req.user?.name}`);

    // Build base query
    let baseQuery = { status: 'completed' };
    
    // Add date range
    baseQuery = addDateRangeFilter(period, baseQuery);
    
    // Add user filter
    addUserFilterToQuery(req, baseQuery, 'soldBy');

    console.log(`🔍 Query:`, { 
      period,
      soldBy: baseQuery.soldBy ? 'Filtered' : 'All data',
      userRole: req.user?.role
    });

    // Get sales statistics
    const salesStats = await Sale.aggregate([
      { $match: baseQuery },
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

    const result = salesStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalItemsSold: 0,
      averageSale: 0
    };

    console.log(`✅ Sales overview: ${result.totalSales} sales`);

    res.json({
      success: true,
      period,
      overview: result,
      filterInfo: {
        isFiltered: !!baseQuery.soldBy,
        userId: baseQuery.soldBy || null,
        userRole: req.user?.role,
        viewType: baseQuery.soldBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Sales overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales overview',
      error: error.message
    });
  }
};

// Get product analytics (standalone)
exports.getProductAnalytics = async (req, res) => {
  try {
    console.log(`📈 Product Analytics - Path: ${req.path}, User: ${req.user?.name}`);

    // Build query
    let productQuery = { isActive: true };
    
    // Add user filter
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Query:`, { 
      createdBy: productQuery.createdBy ? 'Filtered' : 'All data',
      userRole: req.user?.role
    });

    // Get product statistics
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
          outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockAlert'] }] },
                1, 0
              ]
            }
          }
        }
      }
    ]);

    // Get top selling products
    const topProducts = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(10)
      .lean();

    const stats = productStats[0] || {
      totalProducts: 0,
      totalValue: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      outOfStock: 0,
      lowStock: 0
    };

    console.log(`✅ Product analytics: ${stats.totalProducts} products`);

    res.json({
      success: true,
      stats,
      topProducts,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Product analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product analytics',
      error: error.message
    });
  }
};

// Get inventory analytics (standalone)
exports.getInventoryAnalytics = async (req, res) => {
  try {
    console.log(`📦 Inventory Analytics - Path: ${req.path}, User: ${req.user?.name}`);

    let productQuery = { isActive: true };
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Query:`, { 
      createdBy: productQuery.createdBy ? 'Filtered' : 'All data'
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

    const stats = inventoryStats[0] || {
      totalProducts: 0,
      totalStockValue: 0,
      originalStockValue: 0,
      restockedValue: 0,
      averageStock: 0,
      totalItems: 0
    };

    console.log(`✅ Inventory analytics: ${stats.totalProducts} products`);

    res.json({
      success: true,
      stats,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Inventory analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory analytics',
      error: error.message
    });
  }
};

// Get performance metrics (standalone)
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    console.log(`🚀 Performance Metrics - Path: ${req.path}, User: ${req.user?.name}`);

    // Sales query
    let salesQuery = { status: 'completed' };
    salesQuery = addDateRangeFilter(period, salesQuery);
    addUserFilterToQuery(req, salesQuery, 'soldBy');

    // Product query
    let productQuery = { isActive: true };
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Query:`, { 
      period,
      salesFiltered: !!salesQuery.soldBy,
      productsFiltered: !!productQuery.createdBy
    });

    // Get sales performance
    const salesPerformance = await Sale.aggregate([
      { $match: salesQuery },
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

    // Get product performance
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
      averageProfitMargin: 0
    };

    console.log(`✅ Performance metrics: ${salesData.totalSales} sales`);

    res.json({
      success: true,
      period,
      metrics: {
        sales: salesData,
        products: productData
      },
      filterInfo: {
        salesFiltered: !!salesQuery.soldBy,
        productsFiltered: !!productQuery.createdBy,
        userRole: req.user?.role,
        viewType: (salesQuery.soldBy || productQuery.createdBy) ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance metrics',
      error: error.message
    });
  }
};

// Get daily performance (standalone)
exports.getDailyPerformance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`📅 Daily Performance - Date: ${targetDate.toDateString()}, User: ${req.user?.name}`);

    // Sales query
    let salesQuery = {
      createdAt: { $gte: targetDate, $lt: nextDay },
      status: 'completed'
    };
    addUserFilterToQuery(req, salesQuery, 'soldBy');

    // Get daily sales
    const dailySales = await Sale.aggregate([
      { $match: salesQuery },
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

    const dailyData = dailySales[0] || {
      totalRevenue: 0,
      totalProfit: 0,
      totalSales: 0,
      totalItemsSold: 0,
      averageSaleValue: 0
    };

    console.log(`✅ Daily performance: ${dailyData.totalSales} sales`);

    res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      performance: dailyData,
      summary: {
        day: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        isToday: isToday(targetDate),
        performanceRating: rateDailyPerformance(dailyData)
      },
      filterInfo: {
        salesFiltered: !!salesQuery.soldBy,
        userRole: req.user?.role,
        viewType: salesQuery.soldBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Daily performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching daily performance',
      error: error.message
    });
  }
};

// Get product tracking (standalone)
exports.getProductTracking = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`👀 Product Tracking - User: ${req.user?.name}`);

    let productQuery = { isActive: true };
    addUserFilterToQuery(req, productQuery, 'createdBy');

    console.log(`🔍 Query:`, { 
      createdBy: productQuery.createdBy ? 'Filtered' : 'All data'
    });

    const products = await Product.find(productQuery)
      .select('name brand sellingPrice purchasePrice stock totalSold originalQuantity restockedQuantity lowStockAlert category createdBy')
      .populate('createdBy', 'name email')
      .sort({ totalSold: -1 })
      .limit(parseInt(limit))
      .lean();

    const trackingData = products.map(product => {
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
        createdBy: product.createdBy,
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
        performance: {
          rating: calculateProductPerformance(totalProfit, profitMargin, sellThroughRate)
        }
      };
    });

    console.log(`✅ Product tracking: ${trackingData.length} products`);

    res.json({
      success: true,
      count: trackingData.length,
      products: trackingData,
      filterInfo: {
        isFiltered: !!productQuery.createdBy,
        userId: productQuery.createdBy || null,
        userRole: req.user?.role,
        viewType: productQuery.createdBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Product tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product tracking',
      error: error.message
    });
  }
};

// Helper functions
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