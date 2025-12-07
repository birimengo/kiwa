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
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

// Protected routes
router.post('/:id/like', protect, likeProduct);
router.post('/:id/comments', protect, addComment);

// Admin only routes
router.post('/', protect, authorize('admin'), createProduct);
router.put('/:id', protect, authorize('admin'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

// Product stats - filtered by creator
router.get('/admin/stats', protect, authorize('admin'), filterByUser('createdBy'), getProductStats);

// Admin's own products
router.get('/admin/my-products', protect, authorize('admin'), filterByUser('createdBy'), getProducts);

// Other admin routes
router.post('/:id/restock', protect, authorize('admin'), restockProduct);
router.get('/:id/stock-history', protect, authorize('admin'), getStockHistory);
router.put('/:id/stock-alert', protect, authorize('admin'), updateStockAlert);

// Analytics routes
router.get('/:id/performance', protect, authorize('admin'), getProductPerformance);
router.get('/analytics/top-products', protect, authorize('admin'), getTopProductsAnalytics);
router.get('/analytics/tracking', protect, authorize('admin'), getProductTracking);

module.exports = router;