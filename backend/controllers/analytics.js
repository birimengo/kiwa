// controllers/analyticsController.js
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// Helper function to add user filter based on route and user role
const addUserFilterToQuery = (req, query, fieldName = 'soldBy') => {
  console.log(`🔍 Analytics Filter - Path: ${req.path}, User: ${req.user?.name} (${req.user?.role})`);
  
  // Always filter for non-admin users
  if (req.user && req.user._id && req.user.role !== 'admin') {
    query[fieldName] = req.user._id;
    console.log(`🔍 [NON-ADMIN] Filtering by ${fieldName}: ${req.user._id}`);
    return query;
  }
  
  // For admin users, check route and query parameters to determine view
  if (req.user && req.user._id && req.user.role === 'admin') {
    // Check query parameter first for explicit view preference
    const viewParam = req.query.view;
    const isExplicitPersonalView = viewParam === 'personal' || viewParam === 'my';
    const isExplicitSystemView = viewParam === 'system' || viewParam === 'all';
    
    // Determine if this is a personal view route
    const isPersonalRoute = req.path.includes('/user/') || 
                          req.path.includes('/admin/') ||
                          req.path.includes('/my/');
    
    // Decision logic with priority: query param > route > default system view
    if (isExplicitPersonalView || (isPersonalRoute && !isExplicitSystemView)) {
      // Admin personal view - filter to their data
      query[fieldName] = req.user._id;
      console.log(`🔍 [ADMIN PERSONAL VIEW] Filtering by ${fieldName}: ${req.user._id}`);
    } else if (isExplicitSystemView) {
      // Admin system view - no filter (sees all)
      console.log(`🔍 [ADMIN SYSTEM VIEW] No filter - showing all data`);
    } else {
      // Default behavior based on route
      if (isPersonalRoute) {
        query[fieldName] = req.user._id;
        console.log(`🔍 [ADMIN PERSONAL ROUTE] Filtering by ${fieldName}: ${req.user._id}`);
      } else {
        console.log(`🔍 [ADMIN SYSTEM DEFAULT] No filter - showing all data`);
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
    case 'all':
      // No date filter for 'all' period
      return query;
    default:
      startDate = new Date().setHours(0, 0, 0, 0);
  }
  
  query.createdAt = { $gte: new Date(startDate), $lte: endDate };
  return query;
};

// Get consolidated analytics data (for frontend)
exports.getMyAnalytics = async (req, res) => {
  try {
    const { period = 'week', limit = 8, view = 'auto' } = req.query;
    
    console.log(`📊 CONSOLIDATED ANALYTICS - User: ${req.user?.name} (${req.user?.role}), Period: ${period}, View param: ${view}`);
    console.log(`🔍 Path analysis: ${req.path}`);

    // Build base queries
    let salesQuery = { status: 'completed' };
    let productQuery = { isActive: true };
    
    // Add date range to sales query
    salesQuery = addDateRangeFilter(period, salesQuery);
    
    // Apply user filtering with improved logic
    // 1. Non-admin users: Always filter to their data
    // 2. Admin users: Use query param > route analysis > default behavior
    
    const userId = req.user?._id;
    const userRole = req.user?.role;
    
    // Analyze route for personal/system view indication
    const isPersonalRoute = req.path.includes('/user/') || 
                          req.path.includes('/admin/') ||
                          req.path.includes('/my/');
    
    // Determine view type based on multiple factors
    let viewType = 'system'; // default for admin
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      // Non-admin: Always personal view
      isPersonalView = true;
      viewType = 'personal';
      salesQuery.soldBy = userId;
      productQuery.createdBy = userId;
      console.log(`👤 Non-admin user - filtering to personal data`);
    } else {
      // Admin: Complex decision logic
      if (view === 'personal' || view === 'my') {
        // Explicit personal view requested
        isPersonalView = true;
        viewType = 'personal';
        salesQuery.soldBy = userId;
        productQuery.createdBy = userId;
        console.log(`👑 Admin - explicit personal view requested`);
      } else if (view === 'system' || view === 'all') {
        // Explicit system view requested
        isPersonalView = false;
        viewType = 'system';
        console.log(`👑 Admin - explicit system view requested`);
      } else if (isPersonalRoute) {
        // Personal route detected
        isPersonalView = true;
        viewType = 'personal';
        salesQuery.soldBy = userId;
        productQuery.createdBy = userId;
        console.log(`👑 Admin - personal route detected`);
      } else {
        // Default: System view for analytics dashboard
        isPersonalView = false;
        viewType = 'system';
        console.log(`👑 Admin - default system view for analytics`);
      }
    }
    
    console.log(`🔍 Final filters - View type: ${viewType}, Sales filtered: ${!!salesQuery.soldBy}, Products filtered: ${!!productQuery.createdBy}`);

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
    // 8. COMPILE RESPONSE
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

    console.log(`✅ ANALYTICS COMPLETE - Products: ${productAnalytics.totalProducts}, Sales: ${salesOverview.totalSales}`);
    console.log(`🔍 VIEW SUMMARY - Type: ${viewType}, User: ${req.user?.name}, Period: ${period}`);

    res.json({
      success: true,
      period,
      ...consolidatedData,
      filterInfo: {
        isPersonalView,
        userRole: userRole,
        userId: salesQuery.soldBy || null,
        viewType,
        currentUserId: userId,
        period,
        routePath: req.path,
        queryViewParam: view,
        totalDataPoints: productAnalytics.totalProducts + salesOverview.totalSales
      }
    });

  } catch (error) {
    console.error('❌ ANALYTICS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching consolidated analytics',
      error: error.message,
      path: req.path,
      userId: req.user?._id
    });
  }
};

// Get sales overview analytics (standalone)
exports.getSalesOverview = async (req, res) => {
  try {
    const { period = 'week', view = 'auto' } = req.query;
    
    console.log(`📊 SALES OVERVIEW - User: ${req.user?.name}, Period: ${period}, View: ${view}`);

    // Build base query
    let baseQuery = { status: 'completed' };
    
    // Add date range
    baseQuery = addDateRangeFilter(period, baseQuery);
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      baseQuery.soldBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        baseQuery.soldBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        baseQuery.soldBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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

    console.log(`✅ Sales overview: ${result.totalSales} sales, Revenue: ${result.totalRevenue}`);

    res.json({
      success: true,
      period,
      overview: result,
      filterInfo: {
        isPersonalView,
        userRole,
        userId: baseQuery.soldBy || null,
        viewType: isPersonalView ? 'personal' : 'system',
        period
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
    const { view = 'auto' } = req.query;
    console.log(`📈 PRODUCT ANALYTICS - User: ${req.user?.name}, View: ${view}`);

    // Build query
    let productQuery = { isActive: true };
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      productQuery.createdBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        productQuery.createdBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        productQuery.createdBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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

    console.log(`✅ Product analytics: ${stats.totalProducts} products, Profit: ${stats.totalProfit}`);

    res.json({
      success: true,
      stats,
      topProducts,
      filterInfo: {
        isPersonalView,
        userRole,
        userId: productQuery.createdBy || null,
        viewType: isPersonalView ? 'personal' : 'system',
        productCount: stats.totalProducts
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
    const { view = 'auto' } = req.query;
    console.log(`📦 INVENTORY ANALYTICS - User: ${req.user?.name}, View: ${view}`);

    let productQuery = { isActive: true };
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      productQuery.createdBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        productQuery.createdBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        productQuery.createdBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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

    console.log(`✅ Inventory analytics: ${stats.totalProducts} products, Stock value: ${stats.totalStockValue}`);

    res.json({
      success: true,
      stats,
      filterInfo: {
        isPersonalView,
        userRole,
        userId: productQuery.createdBy || null,
        viewType: isPersonalView ? 'personal' : 'system',
        totalItems: stats.totalItems
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
    const { period = 'week', view = 'auto' } = req.query;

    console.log(`🚀 PERFORMANCE METRICS - User: ${req.user?.name}, Period: ${period}, View: ${view}`);

    // Sales query
    let salesQuery = { status: 'completed' };
    salesQuery = addDateRangeFilter(period, salesQuery);
    
    // Product query
    let productQuery = { isActive: true };
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      salesQuery.soldBy = userId;
      productQuery.createdBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        salesQuery.soldBy = userId;
        productQuery.createdBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        salesQuery.soldBy = userId;
        productQuery.createdBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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

    console.log(`✅ Performance metrics: ${salesData.totalSales} sales, Margin: ${productData.averageProfitMargin?.toFixed(1)}%`);

    res.json({
      success: true,
      period,
      metrics: {
        sales: salesData,
        products: productData
      },
      filterInfo: {
        isPersonalView,
        userRole,
        viewType: isPersonalView ? 'personal' : 'system',
        period
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
    const { date, view = 'auto' } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`📅 DAILY PERFORMANCE - Date: ${targetDate.toDateString()}, User: ${req.user?.name}, View: ${view}`);

    // Sales query
    let salesQuery = {
      createdAt: { $gte: targetDate, $lt: nextDay },
      status: 'completed'
    };
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      salesQuery.soldBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        salesQuery.soldBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        salesQuery.soldBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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

    console.log(`✅ Daily performance: ${dailyData.totalSales} sales, Revenue: ${dailyData.totalRevenue}`);

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
        isPersonalView,
        userRole,
        viewType: isPersonalView ? 'personal' : 'system',
        date: targetDate.toISOString().split('T')[0]
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
    const { limit = 10, view = 'auto' } = req.query;

    console.log(`👀 PRODUCT TRACKING - User: ${req.user?.name}, View: ${view}`);

    let productQuery = { isActive: true };
    
    // Apply user filtering
    const userId = req.user?._id;
    const userRole = req.user?.role;
    let isPersonalView = false;
    
    if (userRole !== 'admin') {
      productQuery.createdBy = userId;
      isPersonalView = true;
    } else {
      if (view === 'personal' || view === 'my') {
        productQuery.createdBy = userId;
        isPersonalView = true;
      } else if (view === 'system' || view === 'all') {
        isPersonalView = false;
      } else if (req.path.includes('/user/') || req.path.includes('/my/')) {
        productQuery.createdBy = userId;
        isPersonalView = true;
      }
      // Default: no filter (system view)
    }

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
        isPersonalView,
        userRole,
        userId: productQuery.createdBy || null,
        viewType: isPersonalView ? 'personal' : 'system',
        productCount: trackingData.length
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