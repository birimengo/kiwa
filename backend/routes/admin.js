const express = require('express');
const {
  createAdmin,
  getUsers,
  getDashboardStats,
  updateUserRole,
  toggleUserStatus
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Create initial admin (unprotected for setup)
router.post('/create-admin', createAdmin);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getUsers);
router.get('/dashboard', getDashboardStats);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', toggleUserStatus);

module.exports = router;