const express = require('express');
const { protect, authorize } = require('../middleware/auth'); // ADD THIS LINE
const {
  getDashboardOverview,
  getQuickStats,
  getRecentActivity
} = require('../controllers/dashboard');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

// Remove router.use(protect) since we're protecting individual routes

// User dashboard (only their own data)
router.get('/overview', protect, filterByUser.strict('user'), getDashboardOverview);
router.get('/quick-stats', protect, filterByUser.strict('user'), getQuickStats);
router.get('/recent-activity', protect, filterByUser.strict('user'), getRecentActivity);

// Admin-specific dashboard
router.get('/admin/overview', protect, authorize('admin'), filterByUser('soldBy'), getDashboardOverview);
router.get('/admin/quick-stats', protect, authorize('admin'), filterByUser('soldBy'), getQuickStats);
router.get('/admin/recent-activity', protect, authorize('admin'), filterByUser('soldBy'), getRecentActivity);

module.exports = router;