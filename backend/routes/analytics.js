const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSalesOverview,
  getProductAnalytics,
  getInventoryAnalytics,
  getPerformanceMetrics,
  getDailyPerformance,
  getProductTracking
} = require('../controllers/analytics');

const router = express.Router();

router.use(protect);

router.get('/sales/overview', authorize('admin'), getSalesOverview);
router.get('/products', authorize('admin'), getProductAnalytics);
router.get('/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/performance', authorize('admin'), getPerformanceMetrics);
router.get('/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/product-tracking', authorize('admin'), getProductTracking);

module.exports = router;