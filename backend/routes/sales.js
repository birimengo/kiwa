const express = require('express');
const {
  createSale,
  getSales,
  getSale,
  updatePayment,
  cancelSale,
  getSalesStats,
  deleteSale,
  resumeSale
} = require('../controllers/sales');
const { protect, authorize } = require('../middleware/auth');
const filterByUser = require('../middleware/filterByUser');

const router = express.Router();

router.route('/')
  .post(protect, createSale)
  .get(protect, filterByUser('soldBy'), getSales);

router.route('/stats')
  .get(protect, filterByUser('soldBy'), getSalesStats);

router.route('/:id')
  .get(protect, getSale)
  .delete(protect, authorize('admin'), deleteSale);

router.route('/:id/payment')
  .put(protect, updatePayment);

router.route('/:id/cancel')
  .put(protect, authorize('admin'), cancelSale);

router.route('/:id/resume')
  .put(protect, authorize('admin'), resumeSale);

module.exports = router;