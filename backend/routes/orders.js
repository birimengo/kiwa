const express = require('express');
const {
  // User order functions
  createOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  confirmDelivery,
  
  // Admin order functions - system view
  getAllOrders,
  
  // Admin order functions - personal views
  getAdminProcessedOrders,
  getAdminProductOrders,
  
  // Order statistics
  getOrderStats,
  getDashboardStats,
  
  // Order management actions
  updateOrderStatus,
  processOrder,
  deliverOrder,
  rejectOrder
} = require('../controllers/orders'); // ✅ CORRECT: Changed from 'orderController' to 'orders'
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ============================================
// STATIC ROUTES (SPECIFIC PATHS) - MUST COME FIRST
// ============================================

// Order statistics - THIS MUST COME BEFORE :id ROUTES
router.get('/stats', protect, authorize('admin'), getOrderStats);

// Dashboard statistics
router.get('/dashboard/stats', protect, authorize('admin'), getDashboardStats);

// User's own orders
router.get('/my-orders', protect, getMyOrders);

// Admin personal view routes
router.get('/admin/my-processed', protect, authorize('admin'), getAdminProcessedOrders);
router.get('/admin/my-products', protect, authorize('admin'), getAdminProductOrders);

// Create a new order (Authenticated users)
router.post('/', protect, createOrder);

// ============================================
// ADMIN SYSTEM VIEW ROUTES
// ============================================

// Get all orders (Admin system view - sees everything)
router.get('/', protect, authorize('admin'), getAllOrders);

// ============================================
// PARAMETERIZED ROUTES - MUST COME LAST
// ============================================

// Get single order (with ownership check) - THIS COMES AFTER ALL SPECIFIC ROUTES
router.get('/:id', protect, getOrder);

// Cancel user's own order
router.put('/:id/cancel', protect, cancelOrder);

// Confirm delivery receipt
router.put('/:id/confirm-delivery', protect, confirmDelivery);

// Update order status (general status update)
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// Process order (move from pending to processing)
router.put('/:id/process', protect, authorize('admin'), processOrder);

// Deliver order (move from processing to delivered)
router.put('/:id/deliver', protect, authorize('admin'), deliverOrder);

// Reject order (cancel order as admin)
router.put('/:id/reject', protect, authorize('admin'), rejectOrder);

module.exports = router;