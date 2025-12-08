const express = require('express');
const {
  createSale,
  getSales,
  getSale,
  updatePayment,
  cancelSale,
  getSalesStats,
  deleteSale,
  resumeSale,
  getMySales,
  getAdminSales
} = require('../controllers/sales');
const { protect, authorize } = require('../middleware/auth');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

// ============================================
// USER-SPECIFIC ROUTES (only their own data)
// ============================================

// Get user's personal sales
router.get('/my-sales', protect, getMySales);

// Create sale (creates under current user)
router.post('/', protect, createSale);

// ============================================
// ADMIN SYSTEM ROUTES (all data - default)
// ============================================

// Get all sales (admin sees all, users see only their own via filterByUser)
router.get('/', protect, filterByUser('soldBy'), getSales);

// Get sales statistics (filtered by user)
router.get('/stats', protect, filterByUser('soldBy'), getSalesStats);

// ============================================
// ADMIN PERSONAL ROUTES (their own data only)
// ============================================

// Get admin's personal sales
router.get('/admin/my-sales', protect, authorize('admin'), getAdminSales);

// ============================================
// COMMON ROUTES (with permission checks)
// ============================================

// Get single sale (with permission check)
router.get('/:id', protect, getSale);

// Update payment (owner or admin)
router.put('/:id/payment', protect, updatePayment);

// Cancel sale (owner or admin)
router.put('/:id/cancel', protect, cancelSale);

// ============================================
// ADMIN-ONLY ROUTES
// ============================================

// Delete sale permanently (admin only)
router.delete('/:id', protect, authorize('admin'), deleteSale);

// Resume cancelled sale (admin only)
router.put('/:id/resume', protect, authorize('admin'), resumeSale);

module.exports = router;