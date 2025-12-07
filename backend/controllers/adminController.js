const User = require('../models/User');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Order = require('../models/Order');

// @desc    Create admin user (for initial setup)
// @route   POST /api/admin/create-admin
// @access  Public (should be protected in production)
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if admin already exists with this email
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if any admin exists (for first-time setup)
    const adminCount = await User.countDocuments({ role: 'admin' });
    const isFirstAdmin = adminCount === 0;

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password,
      phone: phone || '+256754535493',
      role: 'admin',
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: isFirstAdmin ? 
        '✅ First admin account created successfully! System is now ready.' : 
        '✅ Admin user created successfully',
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt
      },
      nextSteps: isFirstAdmin ? [
        '1. Use this account to login at /api/auth/login',
        '2. Get JWT token from login response',
        '3. Use token to create more admins at /api/admin/register',
        '4. Or use the web interface at /admin/register'
      ] : ['Login and start managing the system']
    });
  } catch (error) {
    console.error('❌ Create admin error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists in the system'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating admin user',
      error: error.message
    });
  }
};

// @desc    Register new admin (self-registration by existing admin)
// @route   POST /api/admin/register
// @access  Private/Admin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      phone: phone || undefined,
      role: 'admin',
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: '✅ Admin account created successfully',
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt
      },
      credentials: {
        email: admin.email,
        note: 'Password was set during creation'
      },
      instructions: [
        '1. Share these credentials with the new admin',
        '2. New admin should login at /api/auth/login',
        '3. They can then access all admin features'
      ]
    });
  } catch (error) {
    console.error('❌ Register admin error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists in the system'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating admin account',
      error: error.message
    });
  }
};

// @desc    Get all admin users
// @route   GET /api/admin/admins
// @access  Private/Admin
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: admins.length,
      admins: admins.map(admin => ({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
        status: admin.isActive ? 'active' : 'inactive'
      }))
    });
  } catch (error) {
    console.error('❌ Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admins',
      error: error.message
    });
  }
};

// @desc    Get all users (for admin)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        status: user.isActive ? 'active' : 'inactive'
      }))
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: error.message
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user statistics
    const userStats = {
      totalProducts: await Product.countDocuments({ soldBy: user._id }),
      totalSales: await Sale.countDocuments({ soldBy: user._id }),
      totalOrders: await Order.countDocuments({ 
        $or: [
          { user: user._id },
          { processedBy: user._id }
        ]
      })
    };

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        stats: userStats
      }
    });
  } catch (error) {
    console.error('❌ Get user by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user',
      error: error.message
    });
  }
};

// @desc    Get dashboard statistics (system-wide)
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    // Product statistics
    const totalProducts = await Product.countDocuments();
    const lowStockProducts = await Product.countDocuments({ stock: { $lt: 10 } });
    const outOfStockProducts = await Product.countDocuments({ stock: 0 });
    
    // Recent products (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentProducts = await Product.countDocuments({ 
      createdAt: { $gte: sevenDaysAgo } 
    });

    // Sales statistics
    const totalSales = await Sale.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = await Sale.countDocuments({ createdAt: { $gte: today } });
    
    // Order statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });

    // Revenue calculations
    const salesAggregation = await Sale.aggregate([
      { $match: {} },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);
    
    const ordersAggregation = await Order.aggregate([
      { $match: {} },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);

    const totalSalesRevenue = salesAggregation[0]?.totalRevenue || 0;
    const totalOrdersRevenue = ordersAggregation[0]?.totalRevenue || 0;

    res.json({
      success: true,
      stats: {
        // User stats
        users: {
          total: totalUsers,
          admins: totalAdmins,
          active: activeUsers,
          inactive: inactiveUsers
        },
        
        // Product stats
        products: {
          total: totalProducts,
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
          recent: recentProducts
        },
        
        // Sales stats
        sales: {
          total: totalSales,
          today: todaySales,
          revenue: totalSalesRevenue
        },
        
        // Order stats
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          completed: completedOrders,
          revenue: totalOrdersRevenue
        },
        
        // Overall revenue
        revenue: {
          total: totalSalesRevenue + totalOrdersRevenue,
          sales: totalSalesRevenue,
          orders: totalOrdersRevenue
        },
        
        // Timestamps
        lastUpdated: new Date().toISOString(),
        period: 'all-time'
      }
    });
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Get admin dashboard statistics (filtered by current admin)
// @route   GET /api/admin/my-dashboard
// @access  Private/Admin
exports.getMyDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count products created by this admin
    const myProducts = await Product.countDocuments({ soldBy: userId });
    const myLowStockProducts = await Product.countDocuments({ 
      soldBy: userId,
      stock: { $lt: 10 } 
    });
    
    // Recent products (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const myRecentProducts = await Product.countDocuments({ 
      soldBy: userId,
      createdAt: { $gte: sevenDaysAgo } 
    });

    // Sales statistics for this admin
    const myTotalSales = await Sale.countDocuments({ soldBy: userId });
    const myTodaySales = await Sale.countDocuments({ 
      soldBy: userId,
      createdAt: { $gte: today } 
    });
    
    // Sales revenue for this admin
    const mySalesRevenue = await Sale.aggregate([
      { $match: { soldBy: userId } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);

    // Orders processed by this admin
    const myProcessedOrders = await Order.countDocuments({ processedBy: userId });
    const myPendingOrders = await Order.countDocuments({ 
      processedBy: userId,
      status: 'pending' 
    });
    const myCompletedOrders = await Order.countDocuments({ 
      processedBy: userId,
      status: 'delivered' 
    });

    // Order revenue processed by this admin
    const myOrdersRevenue = await Order.aggregate([
      { $match: { processedBy: userId } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        adminId: userId,
        adminName: req.user.name,
        
        // Product stats
        products: {
          total: myProducts,
          lowStock: myLowStockProducts,
          recent: myRecentProducts
        },
        
        // Sales stats
        sales: {
          total: myTotalSales,
          today: myTodaySales,
          revenue: mySalesRevenue[0]?.totalRevenue || 0
        },
        
        // Order stats
        orders: {
          processed: myProcessedOrders,
          pending: myPendingOrders,
          completed: myCompletedOrders,
          revenue: myOrdersRevenue[0]?.totalRevenue || 0
        },
        
        // Overall performance
        performance: {
          totalRevenue: (mySalesRevenue[0]?.totalRevenue || 0) + (myOrdersRevenue[0]?.totalRevenue || 0),
          totalTransactions: myTotalSales + myProcessedOrders
        },
        
        // Timestamps
        lastUpdated: new Date().toISOString(),
        period: 'personal'
      }
    });
  } catch (error) {
    console.error('❌ Get my dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "admin"'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-role change
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    // If changing from admin to user, check if this would leave no admins
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last active admin. Promote another user to admin first.'
        });
      }
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `✅ User role changed from ${oldRole} to ${role}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      changes: {
        field: 'role',
        oldValue: oldRole,
        newValue: role,
        changedBy: req.user._id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Update user role error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating user role',
      error: error.message
    });
  }
};

// @desc    Deactivate/Activate user
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value (true or false)'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deactivation
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own account status'
      });
    }

    // Prevent deactivating the last active admin
    if (user.role === 'admin' && user.isActive === true && isActive === false) {
      const activeAdminCount = await User.countDocuments({ 
        role: 'admin', 
        isActive: true,
        _id: { $ne: user._id }
      });
      
      if (activeAdminCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last active admin. Activate another admin first.'
        });
      }
    }

    const oldStatus = user.isActive;
    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `✅ User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      changes: {
        field: 'status',
        oldValue: oldStatus ? 'active' : 'inactive',
        newValue: isActive ? 'active' : 'inactive',
        changedBy: req.user._id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Toggle user status error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status',
      error: error.message
    });
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deleting the last active admin
    if (user.role === 'admin' && user.isActive === true) {
      const activeAdminCount = await User.countDocuments({ 
        role: 'admin', 
        isActive: true,
        _id: { $ne: user._id }
      });
      
      if (activeAdminCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last active admin. Promote another user to admin first.'
        });
      }
    }

    // Soft delete by marking as inactive
    const wasActive = user.isActive;
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: '✅ User deactivated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      note: 'User was deactivated (soft delete). Account data is preserved but user cannot login.',
      changes: {
        action: 'deactivate',
        previousStatus: wasActive ? 'active' : 'inactive',
        newStatus: 'inactive',
        performedBy: req.user._id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user',
      error: error.message
    });
  }
};

// @desc    Search users by name or email
// @route   GET /api/admin/users/search?q=searchTerm
// @access  Private/Admin
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = new RegExp(q, 'i');
    
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ]
    })
    .select('-password')
    .limit(20)
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      query: q,
      users
    });
  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching users',
      error: error.message
    });
  }
};

// @desc    Get user activity statistics
// @route   GET /api/admin/users/:id/activity
// @access  Private/Admin
exports.getUserActivity = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent activities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentProducts = await Product.find({ soldBy: userId })
      .select('name createdAt')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const recentSales = await Sale.find({ soldBy: userId })
      .select('totalAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const processedOrders = await Order.find({ processedBy: userId })
      .select('totalAmount status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate monthly activity
    const monthlyProducts = await Product.countDocuments({
      soldBy: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const monthlySales = await Sale.countDocuments({
      soldBy: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      activity: {
        recentProducts,
        recentSales,
        processedOrders,
        monthlyStats: {
          productsAdded: monthlyProducts,
          salesMade: monthlySales,
          period: 'last-30-days'
        },
        lastLogin: user.lastLogin,
        accountCreated: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Get user activity error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user activity',
      error: error.message
    });
  }
};

// @desc    Reset user password (admin can reset user password)
// @route   PUT /api/admin/users/:id/reset-password
// @access  Private/Admin
exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: '✅ User password reset successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      note: 'User will need to use the new password for next login',
      changedBy: req.user._id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Reset user password error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while resetting user password',
      error: error.message
    });
  }
};