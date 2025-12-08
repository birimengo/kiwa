// routes/analytics.js
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

// ============================================
// PERSONAL VIEW ROUTES (only user's own data)
// ============================================

// Regular users and admin personal view
router.get('/user/sales-overview', getSalesOverview);
router.get('/user/product-analytics', getProductAnalytics);
router.get('/user/inventory', getInventoryAnalytics);
router.get('/user/performance', getPerformanceMetrics);
router.get('/user/daily-performance', getDailyPerformance);
router.get('/user/product-tracking', getProductTracking);

// Admin personal view (same as user routes)
router.get('/admin/sales-overview', authorize('admin'), getSalesOverview);
router.get('/admin/product-analytics', authorize('admin'), getProductAnalytics);
router.get('/admin/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/admin/performance', authorize('admin'), getPerformanceMetrics);
router.get('/admin/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/admin/product-tracking', authorize('admin'), getProductTracking);

// ============================================
// ADMIN SYSTEM VIEW ROUTES (all data)
// ============================================

router.get('/sales/overview', authorize('admin'), getSalesOverview);
router.get('/products', authorize('admin'), getProductAnalytics);
router.get('/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/performance', authorize('admin'), getPerformanceMetrics);
router.get('/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/product-tracking', authorize('admin'), getProductTracking);

module.exports = router;