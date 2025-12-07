const express = require('express');
const {
  createAdmin,
  getUsers,
  getDashboardStats,
  getMyDashboardStats,
  updateUserRole,
  toggleUserStatus,
  registerAdmin,
  getAdmins,
  getUserById,
  deleteUser,
  searchUsers,
  getUserActivity,
  resetUserPassword
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ============================================
// PUBLIC ROUTES (for initial setup only)
// ============================================

// Create initial admin (unprotected for setup)
router.post('/create-admin', createAdmin);

// ============================================
// PROTECTED ADMIN ROUTES
// ============================================

// Apply authentication and authorization to all routes below
router.use(protect);
router.use(authorize('admin'));

// ============================================
// ADMIN REGISTRATION & MANAGEMENT
// ============================================

// Register new admin (requires existing admin authentication)
router.post('/register', registerAdmin);

// Get all admin users
router.get('/admins', getAdmins);

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users
router.get('/users', getUsers);

// Search users by name, email, or phone
router.get('/users/search', searchUsers);

// Get user by ID
router.get('/users/:id', getUserById);

// Get user activity and statistics
router.get('/users/:id/activity', getUserActivity);

// Update user role
router.put('/users/:id/role', updateUserRole);

// Activate/Deactivate user
router.put('/users/:id/status', toggleUserStatus);

// Reset user password (admin can reset user password)
router.put('/users/:id/reset-password', resetUserPassword);

// Delete user (soft delete)
router.delete('/users/:id', deleteUser);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

// System-wide dashboard statistics (all data)
router.get('/dashboard', getDashboardStats);

// Admin-specific dashboard statistics (own data only)
router.get('/my-dashboard', getMyDashboardStats);

// ============================================
// ADMIN UTILITY ENDPOINTS
// ============================================

// Health check for admin panel
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is operational',
    timestamp: new Date().toISOString(),
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    },
    endpoints: {
      userManagement: [
        'GET    /api/admin/users',
        'GET    /api/admin/users/search?q=query',
        'GET    /api/admin/users/:id',
        'GET    /api/admin/users/:id/activity',
        'PUT    /api/admin/users/:id/role',
        'PUT    /api/admin/users/:id/status',
        'PUT    /api/admin/users/:id/reset-password',
        'DELETE /api/admin/users/:id'
      ],
      adminManagement: [
        'POST   /api/admin/register',
        'GET    /api/admin/admins'
      ],
      dashboard: [
        'GET    /api/admin/dashboard',
        'GET    /api/admin/my-dashboard'
      ]
    }
  });
});

module.exports = router;