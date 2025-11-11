const express = require('express');
const {
  createSale,
  getSales,
  getSale,
  updatePayment,
  cancelSale,
  getSalesStats,
  deleteSale,        // ADD THIS
  resumeSale         // ADD THIS
} = require('../controllers/sales');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .post(protect, createSale)
  .get(protect, getSales);

router.route('/stats')
  .get(protect, getSalesStats);

router.route('/:id')
  .get(protect, getSale)
  .delete(protect, authorize('admin'), deleteSale); // ADD DELETE ROUTE

router.route('/:id/payment')
  .put(protect, updatePayment);

router.route('/:id/cancel')
  .put(protect, authorize('admin'), cancelSale);

router.route('/:id/resume')
  .put(protect, authorize('admin'), resumeSale); // ADD RESUME ROUTE

module.exports = router;