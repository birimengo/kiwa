const Product = require('../models/Product');
const Sale = require('../models/Sale');
const mongoose = require('mongoose');

// @desc    Get sales overview analytics
// @route   GET /api/analytics/sales/overview
// @access  Private/Admin
exports.getSalesOverview = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    console.log(`📊 Fetching sales overview for period: ${period}`);

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

    // Sales statistics
    const salesStats = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: endDate },
          status: 'completed'
        }
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
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: endDate },
          status: 'completed'
        }
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
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: endDate },
          status: 'completed'
        }
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

    console.log(`✅ Sales overview fetched for ${period}`);

    res.json({
      success: true,
      period,
      overview: result,
      trends: {
        dailySales,
        paymentMethods
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
// @access  Private/Admin
exports.getProductAnalytics = async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    console.log(`📈 Fetching product analytics for period: ${period}`);

    // Get enhanced product statistics
    const productStats = await Product.getEnhancedProductStats();

    // Get top selling products
    const topProducts = await Product.find({ isActive: true })
      .select('name brand sellingPrice purchasePrice stock totalSold category')
      .sort({ totalSold: -1 })
      .limit(10)
      .lean();

    // Category performance
    const categoryPerformance = await Product.aggregate([
      { $match: { isActive: true } },
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

    // Stock analysis
    const stockAnalysis = {
      healthy: await Product.countDocuments({ 
        isActive: true, 
        stock: { $gt: 10 } 
      }),
      lowStock: await Product.countDocuments({ 
        isActive: true, 
        stock: { $gt: 0, $lte: 10 } 
      }),
      outOfStock: await Product.countDocuments({ 
        isActive: true, 
        stock: 0 
      })
    };

    console.log(`✅ Product analytics fetched`);

    res.json({
      success: true,
      period,
      stats: productStats,
      topProducts,
      categories: categoryPerformance,
      stockAnalysis
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
// @access  Private/Admin
exports.getInventoryAnalytics = async (req, res) => {
  try {
    console.log('📦 Fetching inventory analytics...');

    const inventoryStats = await Product.aggregate([
      { $match: { isActive: true } },
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

    // Low stock products
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockAlert'] }
    })
    .select('name brand stock lowStockAlert purchasePrice sellingPrice')
    .sort({ stock: 1 })
    .limit(20)
    .lean();

    // Stock movement trends
    const stockMovement = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$stockHistory' },
      {
        $match: {
          'stockHistory.createdAt': {
            $gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$stockHistory.createdAt' }
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

    console.log(`✅ Inventory analytics fetched`);

    res.json({
      success: true,
      stats,
      lowStockProducts,
      stockMovement,
      alerts: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: await Product.countDocuments({ isActive: true, stock: 0 })
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
// @access  Private/Admin
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    console.log(`🚀 Fetching performance metrics for period: ${period}`);

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

    // Sales performance
    const salesPerformance = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: endDate },
          status: 'completed'
        }
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

    // Product performance
    const productPerformance = await Product.aggregate([
      { $match: { isActive: true } },
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

    // Inventory performance
    const inventoryPerformance = await Product.aggregate([
      { $match: { isActive: true } },
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

    console.log(`✅ Performance metrics fetched`);

    res.json({
      success: true,
      period,
      metrics: {
        sales: salesData,
        products: productData,
        inventory: inventoryData,
        overallScore: calculateOverallScore(salesData, productData, inventoryData)
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
// @access  Private/Admin
exports.getDailyPerformance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`📅 Fetching daily performance for: ${targetDate.toDateString()}`);

    // Daily sales
    const dailySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDay },
          status: 'completed'
        }
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

    // Products sold today
    const productsSoldToday = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDay },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.totalPrice' },
          profit: { $sum: '$items.profit' }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);

    // Inventory changes today
    const inventoryChanges = await Product.aggregate([
      { $unwind: '$stockHistory' },
      {
        $match: {
          'stockHistory.createdAt': { $gte: targetDate, $lt: nextDay }
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
              time: '$stockHistory.createdAt'
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

    console.log(`✅ Daily performance fetched for ${targetDate.toDateString()}`);

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
// @access  Private/Admin
exports.getProductTracking = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`👀 Fetching product tracking data, limit: ${limit}`);

    const products = await Product.find({ isActive: true })
      .select('name brand sellingPrice purchasePrice stock totalSold originalQuantity restockedQuantity lowStockAlert stockHistory createdAt category')
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
          trend: 'stable' // This could be calculated based on historical data
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
  const profitScore = products.averageProfitMargin;
  const inventoryScore = (1 - inventory.stockoutRate) * 100;
  
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