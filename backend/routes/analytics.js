const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getMyAnalytics,
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
// CONSOLIDATED ANALYTICS ENDPOINTS
// ============================================

// Personal consolidated analytics (for all users)
router.get('/user/my-analytics', getMyAnalytics);

// Admin personal consolidated analytics
router.get('/admin/my-analytics', authorize('admin'), getMyAnalytics);

// Main consolidated analytics endpoint (personal data for current user)
// IMPORTANT: This endpoint ALWAYS returns personal data for the logged-in user
router.get('/my-analytics', getMyAnalytics);

// ============================================
// PERSONAL VIEW ROUTES (only user's own data)
// ============================================

// User personal analytics
router.get('/user/sales-overview', getSalesOverview);
router.get('/user/product-analytics', getProductAnalytics);
router.get('/user/inventory', getInventoryAnalytics);
router.get('/user/performance', getPerformanceMetrics);
router.get('/user/daily-performance', getDailyPerformance);
router.get('/user/product-tracking', getProductTracking);

// Admin personal analytics (same as user routes)
router.get('/admin/sales-overview', authorize('admin'), getSalesOverview);
router.get('/admin/product-analytics', authorize('admin'), getProductAnalytics);
router.get('/admin/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/admin/performance', authorize('admin'), getPerformanceMetrics);
router.get('/admin/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/admin/product-tracking', authorize('admin'), getProductTracking);

// ============================================
// ADMIN SYSTEM VIEW ROUTES (all data)
// ============================================

// Admin system analytics (all users' data)
router.get('/sales/overview', authorize('admin'), getSalesOverview);
router.get('/products', authorize('admin'), getProductAnalytics);
router.get('/inventory', authorize('admin'), getInventoryAnalytics);
router.get('/performance', authorize('admin'), getPerformanceMetrics);
router.get('/daily-performance', authorize('admin'), getDailyPerformance);
router.get('/product-tracking', authorize('admin'), getProductTracking);

// ============================================
// TEST ROUTE FOR DEBUGGING
// ============================================
router.get('/test-filter', async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const path = req.path;
    
    res.json({
      success: true,
      test: {
        userId,
        userRole,
        path,
        isPersonalRoute: path.includes('/user/') || 
                        path.includes('/admin/') ||
                        path.includes('/my/') ||
                        path.includes('/my-analytics'),
        description: 'This endpoint shows how the path is being interpreted'
      },
      message: `User: ${req.user?.name} (${req.user?.role}), Path: ${path}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;