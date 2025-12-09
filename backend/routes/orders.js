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
} = require('../controllers/orders');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ============================================
// USER ORDER ROUTES
// ============================================

// Create a new order (Authenticated users)
router.post('/', protect, createOrder);

// Get user's own orders
router.get('/my-orders', protect, getMyOrders);

// Get single order (with ownership check)
router.get('/:id', protect, getOrder);

// Cancel user's own order
router.put('/:id/cancel', protect, cancelOrder);

// Confirm delivery receipt
router.put('/:id/confirm-delivery', protect, confirmDelivery);

// ============================================
// ADMIN ORDER ROUTES - SYSTEM VIEW
// ============================================

// Get all orders (Admin system view - sees everything)
router.get('/', protect, authorize('admin'), getAllOrders);

// ============================================
// ADMIN ORDER ROUTES - PERSONAL VIEWS
// ============================================

// Get admin's processed orders (orders they processed)
router.get('/admin/my-processed', protect, authorize('admin'), getAdminProcessedOrders);

// Get admin's product-specific orders (orders containing their products)
router.get('/admin/my-products', protect, authorize('admin'), getAdminProductOrders);

// ============================================
// ORDER STATISTICS ROUTES
// ============================================

// Get order statistics with view parameter
// ?view=system (default) - All system statistics
// ?view=my-products - Statistics for admin's products only
// ?view=my-processed - Statistics for orders processed by admin
router.get('/stats', protect, authorize('admin'), getOrderStats);

// Get dashboard statistics (system-wide)
router.get('/dashboard/stats', protect, authorize('admin'), getDashboardStats);

// ============================================
// ORDER MANAGEMENT ROUTES (Admin actions)
// ============================================

// Update order status (general status update)
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// Process order (move from pending to processing)
router.put('/:id/process', protect, authorize('admin'), processOrder);

// Deliver order (move from processing to delivered)
router.put('/:id/deliver', protect, authorize('admin'), deliverOrder);

// Reject order (cancel order as admin)
router.put('/:id/reject', protect, authorize('admin'), rejectOrder);

module.exports = router;