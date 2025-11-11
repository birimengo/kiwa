const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getDashboardOverview,
  getQuickStats,
  getRecentActivity
} = require('../controllers/dashboard');

const router = express.Router();

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/quick-stats', getQuickStats);
router.get('/recent-activity', getRecentActivity);

module.exports = router;