const Product = require('../models/Product');
const Sale = require('../models/Sale');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper function to add user filter to query
const addUserFilterToQuery = (req, query, fieldName = 'soldBy') => {
  // If createdBy/soldBy is in query (added by filterByUser middleware), use it
  if (req.query[fieldName]) {
    query[fieldName] = req.query[fieldName];
    console.log(`🔍 [Dashboard] Filtering by ${fieldName} from query: ${req.query[fieldName]}`);
  } 
  // For admin-specific personal endpoints OR when view=my is specified
  else if (req.user && req.user._id) {
    // Check if this is an admin personal view
    const isAdminPersonalView = (
      req.path.includes('/admin/') || 
      req.query.view === 'my' || 
      req.query.soldBy === 'me' || 
      req.query.createdBy === 'me'
    );
    
    if (isAdminPersonalView || req.user.role !== 'admin') {
      // Non-admin users or admin in personal view: always filter by their ID
      query[fieldName] = req.user._id;
      console.log(`🔍 [Dashboard] Filtering by ${fieldName} from user: ${req.user._id} (${req.user.role} ${isAdminPersonalView ? 'personal view' : 'regular user'})`);
    } else {
      console.log(`🔍 [Dashboard] [ADMIN SYSTEM VIEW] No user filter applied for ${fieldName}`);
    }
  }
  return query;
};

// Helper function to get user filter based on context
const getUserFilterForContext = (req, context = 'sales') => {
  const fieldMap = {
    'sales': 'soldBy',
    'products': 'createdBy',
    'activity-sales': 'soldBy',
    'activity-products': 'createdBy'
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

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
exports.getDashboardOverview = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard overview...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build sales filter with proper user filtering
    let todaySalesFilter = {
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'completed'
    };
    
    let totalStatsFilter = {
      status: 'completed'
    };
    
    // Add user filter for sales
    const salesUserFilter = getUserFilterForContext(req, 'sales');
    if (salesUserFilter.soldBy) {
      todaySalesFilter.soldBy = salesUserFilter.soldBy;
      totalStatsFilter.soldBy = salesUserFilter.soldBy;
    }

    // Build product filter with proper user filtering
    let productFilter = { isActive: true };
    const productUserFilter = getUserFilterForContext(req, 'products');
    if (productUserFilter.createdBy) {
      productFilter.createdBy = productUserFilter.createdBy;
    }

    console.log(`🔍 Dashboard Overview Query:`, { 
      salesFiltered: !!todaySalesFilter.soldBy,
      productsFiltered: !!productFilter.createdBy,
      viewType: (todaySalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
    });

    // Today's sales with user filter
    const todaySales = await Sale.aggregate([
      {
        $match: todaySalesFilter
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          sales: { $sum: 1 },
          profit: { $sum: '$totalProfit' }
        }
      }
    ]);

    // Total statistics with user filter
    const totalStats = await Sale.aggregate([
      {
        $match: totalStatsFilter
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          totalProfit: { $sum: '$totalProfit' }
        }
      }
    ]);

    // Product statistics with user filter
    const productStats = await Product.aggregate([
      { $match: productFilter },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
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
          },
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent sales with user filter
    const recentSales = await Sale.find(totalStatsFilter)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('saleNumber totalAmount customer.name createdAt')
      .lean();

    const todayData = todaySales[0] || { revenue: 0, sales: 0, profit: 0 };
    const totalData = totalStats[0] || { totalRevenue: 0, totalSales: 0, totalProfit: 0 };
    const productData = productStats[0] || { totalProducts: 0, lowStock: 0, outOfStock: 0 };

    console.log(`✅ Dashboard overview fetched - Today: ${todayData.sales} sales, Total: ${totalData.totalSales} sales`);

    res.json({
      success: true,
      overview: {
        today: todayData,
        totals: totalData,
        products: productData,
        recentSales
      },
      filterInfo: {
        salesFiltered: !!todaySalesFilter.soldBy,
        productsFiltered: !!productFilter.createdBy,
        userId: req.user ? req.user._id : null,
        viewType: (todaySalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard overview',
      error: error.message
    });
  }
};

// @desc    Get quick stats
// @route   GET /api/dashboard/quick-stats
// @access  Private
exports.getQuickStats = async (req, res) => {
  try {
    console.log('⚡ Fetching quick stats...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build filters with proper user filtering
    let todaySalesFilter = {
      createdAt: { $gte: today, $lt: tomorrow },
      status: 'completed'
    };
    
    let productFilter = { isActive: true };
    let revenueFilter = { status: 'completed' };
    
    // Add user filters
    const salesUserFilter = getUserFilterForContext(req, 'sales');
    const productUserFilter = getUserFilterForContext(req, 'products');
    
    if (salesUserFilter.soldBy) {
      todaySalesFilter.soldBy = salesUserFilter.soldBy;
      revenueFilter.soldBy = salesUserFilter.soldBy;
    }
    
    if (productUserFilter.createdBy) {
      productFilter.createdBy = productUserFilter.createdBy;
    }

    console.log(`🔍 Quick Stats Query:`, { 
      salesFiltered: !!todaySalesFilter.soldBy,
      productsFiltered: !!productFilter.createdBy,
      viewType: (todaySalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
    });

    const [
      todaySales,
      totalProducts,
      lowStockProducts,
      totalRevenue
    ] = await Promise.all([
      Sale.countDocuments(todaySalesFilter),
      Product.countDocuments(productFilter),
      Product.countDocuments({ 
        ...productFilter,
        $expr: { $lte: ['$stock', '$lowStockAlert'] },
        stock: { $gt: 0 }
      }),
      Sale.aggregate([
        { $match: revenueFilter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    const revenue = totalRevenue[0]?.total || 0;

    console.log(`✅ Quick stats fetched - Today Sales: ${todaySales}, Products: ${totalProducts}`);

    res.json({
      success: true,
      stats: {
        todaySales,
        totalProducts,
        lowStockProducts,
        totalRevenue: revenue
      },
      filterInfo: {
        salesFiltered: !!todaySalesFilter.soldBy,
        productsFiltered: !!productFilter.createdBy,
        userId: req.user ? req.user._id : null,
        viewType: (todaySalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get quick stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching quick stats',
      error: error.message
    });
  }
};

// @desc    Get recent activity
// @route   GET /api/dashboard/recent-activity
// @access  Private
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`📝 Fetching recent activity, limit: ${limit}`);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Build filters with proper user filtering
    let recentSalesFilter = {
      status: 'completed'
    };
    
    let productFilter = { isActive: true };
    
    // Add user filters
    const salesUserFilter = getUserFilterForContext(req, 'activity-sales');
    const productUserFilter = getUserFilterForContext(req, 'activity-products');
    
    if (salesUserFilter.soldBy) {
      recentSalesFilter.soldBy = salesUserFilter.soldBy;
    }
    
    if (productUserFilter.createdBy) {
      productFilter.createdBy = productUserFilter.createdBy;
    }

    console.log(`🔍 Recent Activity Query:`, { 
      limit,
      salesFiltered: !!recentSalesFilter.soldBy,
      productsFiltered: !!productFilter.createdBy,
      viewType: (recentSalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
    });

    // Recent sales with user filter
    const recentSales = await Sale.find(recentSalesFilter)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) * 2) // Get more to account for mixing with stock changes
      .select('saleNumber totalAmount customer.name createdAt paymentMethod')
      .lean();

    // Get recent stock changes with user filter - FIXED QUERY
    const recentStockChanges = await Product.aggregate([
      { $match: productFilter },
      { $unwind: '$stockHistory' },
      {
        $match: {
          'stockHistory.date': { 
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
          }
        }
      },
      { $sort: { 'stockHistory.date': -1 } },
      { $limit: parseInt(limit) * 2 },
      {
        $project: {
          productName: '$name',
          type: '$stockHistory.type',
          unitsChanged: '$stockHistory.unitsChanged',
          notes: '$stockHistory.notes',
          timestamp: '$stockHistory.date'
        }
      }
    ]);

    // Combine activities with proper user context
    const activity = [
      ...recentSales.map(sale => ({
        type: 'sale',
        description: `Sale ${sale.saleNumber} completed`,
        amount: sale.totalAmount,
        customer: sale.customer.name,
        timestamp: sale.createdAt,
        user: sale.soldBy?.name || 'Unknown',
        userId: sale.soldBy ? sale.soldBy._id : null,
        isUserActivity: salesUserFilter.soldBy ? (sale.soldBy?._id?.toString() === salesUserFilter.soldBy.toString()) : true
      })),
      ...recentStockChanges.map(change => ({
        type: 'stock',
        description: `${change.type === 'restock' ? 'Restocked' : 'Sold'} ${Math.abs(change.unitsChanged)} units of ${change.productName}`,
        notes: change.notes,
        timestamp: change.timestamp,
        isUserActivity: true // Stock changes are always user's own
      }))
    ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));

    console.log(`✅ Recent activity fetched: ${activity.length} items`);

    // Calculate activity summary
    const activitySummary = {
      totalActivities: activity.length,
      userActivities: activity.filter(a => a.isUserActivity).length,
      salesActivities: activity.filter(a => a.type === 'sale').length,
      stockActivities: activity.filter(a => a.type === 'stock').length
    };

    res.json({
      success: true,
      count: activity.length,
      activity,
      summary: activitySummary,
      filterInfo: {
        salesFiltered: !!recentSalesFilter.soldBy,
        productsFiltered: !!productFilter.createdBy,
        userId: req.user ? req.user._id : null,
        viewType: (recentSalesFilter.soldBy || productFilter.createdBy) ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent activity',
      error: error.message
    });
  }
};

// @desc    Get user-specific dashboard stats
// @route   GET /api/dashboard/user-stats
// @access  Private
exports.getUserStats = async (req, res) => {
  try {
    console.log('📊 Fetching user-specific dashboard stats...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    const userId = req.user._id;
    const userRole = req.user.role;

    // Get user-specific data based on role
    let userStats = {
      userId,
      role: userRole,
      joinedDate: req.user.createdAt,
      lastLogin: req.user.lastLogin || req.user.createdAt
    };

    // Add role-specific stats
    if (userRole === 'admin') {
      // Admin stats - can see both personal and system stats
      const personalSalesFilter = { 
        status: 'completed',
        soldBy: userId 
      };
      
      const systemSalesFilter = { 
        status: 'completed'
      };

      const [personalSales, systemSales, personalProducts, systemProducts] = await Promise.all([
        Sale.countDocuments(personalSalesFilter),
        Sale.countDocuments(systemSalesFilter),
        Product.countDocuments({ createdBy: userId, isActive: true }),
        Product.countDocuments({ isActive: true })
      ]);

      userStats.adminStats = {
        personalSales,
        systemSales,
        personalProducts,
        systemProducts,
        systemShare: systemSales > 0 ? Math.round((personalSales / systemSales) * 100) : 0,
        productShare: systemProducts > 0 ? Math.round((personalProducts / systemProducts) * 100) : 0
      };

    } else {
      // Regular user stats - only personal data
      const salesFilter = { 
        status: 'completed',
        soldBy: userId 
      };
      
      const [totalSales, totalRevenue, avgSaleValue] = await Promise.all([
        Sale.countDocuments(salesFilter),
        Sale.aggregate([
          { $match: salesFilter },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Sale.aggregate([
          { $match: salesFilter },
          { $group: { _id: null, avg: { $avg: '$totalAmount' } } }
        ])
      ]);

      userStats.userStats = {
        totalSales: totalSales,
        totalRevenue: totalRevenue[0]?.total || 0,
        avgSaleValue: avgSaleValue[0]?.avg || 0,
        salesPerDay: calculateSalesPerDay(totalSales, req.user.createdAt)
      };
    }

    console.log(`✅ User stats fetched for ${userRole} user ${userId}`);

    res.json({
      success: true,
      userStats,
      filterInfo: {
        userId,
        role: userRole,
        viewType: 'personal' // User stats are always personal
      }
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user stats',
      error: error.message
    });
  }
};

// @desc    Get admin comparison dashboard
// @route   GET /api/dashboard/admin-comparison
// @access  Private/Admin
exports.getAdminComparison = async (req, res) => {
  try {
    console.log('📊 Fetching admin comparison dashboard...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can access comparison dashboard'
      });
    }

    // Get all admins
    const admins = await User.find({ role: 'admin', isActive: true })
      .select('_id name email createdAt lastLogin')
      .lean();

    // Get stats for each admin
    const adminStats = await Promise.all(
      admins.map(async (admin) => {
        const salesFilter = { 
          status: 'completed',
          soldBy: admin._id 
        };
        
        const productsFilter = { 
          isActive: true,
          createdBy: admin._id 
        };

        const [salesStats, productStats, recentActivity] = await Promise.all([
          Sale.aggregate([
            { $match: salesFilter },
            {
              $group: {
                _id: null,
                totalSales: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' },
                totalProfit: { $sum: '$totalProfit' },
                avgSaleValue: { $avg: '$totalAmount' }
              }
            }
          ]),
          Product.aggregate([
            { $match: productsFilter },
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                totalValue: { $sum: { $multiply: ['$purchasePrice', '$stock'] } },
                outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
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
          ]),
          Sale.countDocuments({ 
            ...salesFilter,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          })
        ]);

        const salesData = salesStats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgSaleValue: 0
        };

        const productData = productStats[0] || {
          totalProducts: 0,
          totalValue: 0,
          outOfStock: 0,
          lowStock: 0
        };

        return {
          admin: {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            joinedDate: admin.createdAt,
            lastLogin: admin.lastLogin,
            daysActive: Math.floor((Date.now() - new Date(admin.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          },
          stats: {
            sales: salesData,
            products: productData,
            recentActivity,
            performanceScore: calculatePerformanceScore(salesData, productData)
          }
        };
      })
    );

    // Sort by performance score
    adminStats.sort((a, b) => b.stats.performanceScore - a.stats.performanceScore);

    console.log(`✅ Admin comparison fetched - ${adminStats.length} admins`);

    res.json({
      success: true,
      count: adminStats.length,
      adminStats,
      currentAdminId: req.user._id,
      summary: {
        topPerformer: adminStats[0]?.admin.name || 'No data',
        totalAdmins: adminStats.length,
        averagePerformance: Math.round(adminStats.reduce((sum, admin) => sum + admin.stats.performanceScore, 0) / adminStats.length)
      }
    });

  } catch (error) {
    console.error('❌ Get admin comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin comparison',
      error: error.message
    });
  }
};

// Helper functions
function calculateSalesPerDay(totalSales, joinDate) {
  const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24)));
  return (totalSales / daysSinceJoin).toFixed(2);
}

function calculatePerformanceScore(salesData, productData) {
  const salesScore = salesData.totalRevenue > 10000 ? 100 : (salesData.totalRevenue / 10000) * 100;
  const profitScore = salesData.totalProfit > 0 ? Math.min(100, (salesData.totalProfit / salesData.totalRevenue) * 100 * 2) : 0;
  const productScore = productData.totalProducts > 0 ? Math.min(100, (productData.totalProducts * 10)) : 0;
  const stockScore = productData.totalProducts > 0 ? 
    (100 - ((productData.outOfStock + productData.lowStock) / productData.totalProducts) * 100) : 0;
  
  return Math.round((salesScore * 0.4) + (profitScore * 0.3) + (productScore * 0.2) + (stockScore * 0.1));
}

// @desc    Get monthly performance trends
// @route   GET /api/dashboard/monthly-trends
// @access  Private
exports.getMonthlyTrends = async (req, res) => {
  try {
    console.log('📈 Fetching monthly performance trends...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    const months = 6; // Last 6 months
    const trends = [];

    // Build base filter with user filtering
    let salesFilter = {
      status: 'completed',
      createdAt: { $gte: new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000) }
    };
    
    // Add user filter
    const salesUserFilter = getUserFilterForContext(req, 'sales');
    if (salesUserFilter.soldBy) {
      salesFilter.soldBy = salesUserFilter.soldBy;
    }

    // Get monthly sales data
    const monthlySales = await Sale.aggregate([
      { $match: salesFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          profit: { $sum: '$totalProfit' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format monthly data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = monthNames[date.getMonth()];
      
      const monthData = monthlySales.find(m => m._id.year === year && m._id.month === month);
      
      trends.unshift({
        month: `${monthName} ${year}`,
        sales: monthData?.sales || 0,
        revenue: monthData?.revenue || 0,
        profit: monthData?.profit || 0
      });
    }

    console.log(`✅ Monthly trends fetched - ${trends.length} months`);

    res.json({
      success: true,
      trends,
      filterInfo: {
        salesFiltered: !!salesFilter.soldBy,
        userId: req.user ? req.user._id : null,
        viewType: salesFilter.soldBy ? 'personal' : 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get monthly trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly trends',
      error: error.message
    });
  }
};