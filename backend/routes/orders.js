const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderStats,
  getAllOrders,
  getDashboardStats,
  processOrder,
  deliverOrder,
  rejectOrder,
  confirmDelivery
} = require('../controllers/orders');
const { protect, authorize } = require('../middleware/auth');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

// User routes
router.post('/', protect, createOrder);
router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/confirm-delivery', protect, confirmDelivery);

// Admin routes - all orders (unfiltered)
router.get('/', protect, authorize('admin'), getAllOrders);

// Admin routes - their own processed orders
router.get('/admin/my-orders', protect, authorize('admin'), filterByUser('processedBy'), getAllOrders);

// Stats - filtered by processor
router.get('/stats', protect, authorize('admin'), filterByUser('processedBy'), getOrderStats);
router.get('/dashboard/stats', protect, authorize('admin'), filterByUser('processedBy'), getDashboardStats);

// Order management
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);
router.put('/:id/process', protect, authorize('admin'), processOrder);
router.put('/:id/deliver', protect, authorize('admin'), deliverOrder);
router.put('/:id/reject', protect, authorize('admin'), rejectOrder);

module.exports = router;