const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  likeProduct,
  addComment,
  getFeaturedProducts,
  getProductsByCategory,
  getProductStats,
  restockProduct,
  getStockHistory,
  updateStockAlert,
  getProductPerformance,
  getTopProductsAnalytics,
  getProductTracking
} = require('../controllers/products');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

// Protected routes
router.use(protect);

router.post('/:id/like', likeProduct);
router.post('/:id/comments', addComment);

// Admin only routes
router.post('/', authorize('admin'), createProduct);
router.put('/:id', authorize('admin'), updateProduct);
router.delete('/:id', authorize('admin'), deleteProduct);
router.get('/admin/stats', authorize('admin'), getProductStats);
router.post('/:id/restock', authorize('admin'), restockProduct);
router.get('/:id/stock-history', authorize('admin'), getStockHistory);
router.put('/:id/stock-alert', authorize('admin'), updateStockAlert);

// NEW: Analytics routes
router.get('/:id/performance', authorize('admin'), getProductPerformance);
router.get('/analytics/top-products', authorize('admin'), getTopProductsAnalytics);
router.get('/analytics/tracking', authorize('admin'), getProductTracking);

module.exports = router;