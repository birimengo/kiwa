const Product = require('../models/Product');
const Sale = require('../models/Sale');
const User = require('../models/User');

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private/Admin
exports.getDashboardOverview = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard overview...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales
    const todaySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'completed'
        }
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

    // Total statistics
    const totalStats = await Sale.aggregate([
      {
        $match: {
          status: 'completed'
        }
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

    // Product statistics
    const productStats = await Product.aggregate([
      { $match: { isActive: true } },
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

    // Recent sales
    const recentSales = await Sale.find({ status: 'completed' })
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('saleNumber totalAmount customer.name createdAt')
      .lean();

    const todayData = todaySales[0] || { revenue: 0, sales: 0, profit: 0 };
    const totalData = totalStats[0] || { totalRevenue: 0, totalSales: 0, totalProfit: 0 };
    const productData = productStats[0] || { totalProducts: 0, lowStock: 0, outOfStock: 0 };

    console.log('✅ Dashboard overview fetched');

    res.json({
      success: true,
      overview: {
        today: todayData,
        totals: totalData,
        products: productData,
        recentSales
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
// @access  Private/Admin
exports.getQuickStats = async (req, res) => {
  try {
    console.log('⚡ Fetching quick stats...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaySales,
      totalProducts,
      lowStockProducts,
      totalRevenue
    ] = await Promise.all([
      Sale.countDocuments({ 
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'completed'
      }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ 
        isActive: true, 
        $expr: { $lte: ['$stock', '$lowStockAlert'] },
        stock: { $gt: 0 }
      }),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    const revenue = totalRevenue[0]?.total || 0;

    console.log('✅ Quick stats fetched');

    res.json({
      success: true,
      stats: {
        todaySales,
        totalProducts,
        lowStockProducts,
        totalRevenue: revenue
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
// @access  Private/Admin
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    console.log(`📝 Fetching recent activity, limit: ${limit}`);

    const recentSales = await Sale.find({ status: 'completed' })
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('saleNumber totalAmount customer.name createdAt paymentMethod')
      .lean();

    // Get recent stock changes
    const recentStockChanges = await Product.aggregate([
      { $unwind: '$stockHistory' },
      { $match: { 'stockHistory.createdAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $sort: { 'stockHistory.createdAt': -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          productName: '$name',
          type: '$stockHistory.type',
          unitsChanged: '$stockHistory.unitsChanged',
          notes: '$stockHistory.notes',
          timestamp: '$stockHistory.createdAt'
        }
      }
    ]);

    const activity = [
      ...recentSales.map(sale => ({
        type: 'sale',
        description: `Sale ${sale.saleNumber} completed`,
        amount: sale.totalAmount,
        customer: sale.customer.name,
        timestamp: sale.createdAt,
        user: sale.soldBy?.name
      })),
      ...recentStockChanges.map(change => ({
        type: 'stock',
        description: `${change.type === 'restock' ? 'Restocked' : 'Sold'} ${Math.abs(change.unitsChanged)} units of ${change.productName}`,
        notes: change.notes,
        timestamp: change.timestamp
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, limit);

    console.log(`✅ Recent activity fetched: ${activity.length} items`);

    res.json({
      success: true,
      count: activity.length,
      activity
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