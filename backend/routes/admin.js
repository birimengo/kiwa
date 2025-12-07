const express = require('express');
const {
  createAdmin,
  getUsers,
  getDashboardStats,
  updateUserRole,
  toggleUserStatus
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

// Create initial admin (unprotected for setup)
router.post('/create-admin', createAdmin);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

// System-wide admin views
router.get('/users', getUsers);
router.get('/dashboard', getDashboardStats);

// Admin-specific views
router.get('/my-dashboard', filterByUser('soldBy'), getDashboardStats);

// User management
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', toggleUserStatus);

module.exports = router;