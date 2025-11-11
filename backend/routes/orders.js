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

const router = express.Router();

router.route('/')
  .post(protect, createOrder)
  .get(protect, authorize('admin'), getAllOrders);

router.route('/my-orders')
  .get(protect, getMyOrders);

router.route('/stats')
  .get(protect, authorize('admin'), getOrderStats);

router.route('/dashboard/stats')
  .get(protect, authorize('admin'), getDashboardStats);

router.route('/:id')
  .get(protect, getOrder);

router.route('/:id/status')
  .put(protect, authorize('admin'), updateOrderStatus);

router.route('/:id/cancel')
  .put(protect, cancelOrder);

// New routes for order workflow
router.route('/:id/process')
  .put(protect, authorize('admin'), processOrder);

router.route('/:id/deliver')
  .put(protect, authorize('admin'), deliverOrder);

router.route('/:id/reject')
  .put(protect, authorize('admin'), rejectOrder);

router.route('/:id/confirm-delivery')
  .put(protect, confirmDelivery);

module.exports = router;