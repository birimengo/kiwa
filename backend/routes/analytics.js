// routes/analytics.js
const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSalesOverview,
  getProductAnalytics,
  getInventoryAnalytics,
  getPerformanceMetrics,
  getDailyPerformance,
  getProductTracking,
  getAdminSalesOverview,
  getAdminProductAnalytics,
  getAdminPerformance
} = require('../controllers/analytics');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

router.use(protect);

// System-wide analytics (admin sees everything when in system view)
router.get('/sales/overview', authorize('admin'), getSalesOverview);
router.get('/products', authorize('admin'), getProductAnalytics);
router.get('/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/performance', authorize('admin'), getPerformanceMetrics);
router.get('/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/product-tracking', authorize('admin'), getProductTracking);

// Admin-specific analytics (only their own data when in personal view)
router.get('/admin/sales-overview', authorize('admin'), getAdminSalesOverview);
router.get('/admin/product-analytics', authorize('admin'), getAdminProductAnalytics);
router.get('/admin/performance', authorize('admin'), getAdminPerformance);

module.exports = router;