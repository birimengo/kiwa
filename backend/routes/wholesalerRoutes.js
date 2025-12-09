// server/routes/wholesalerRoutes.js
const express = require('express');
const { getWholesalers } = require('../controllers/wholesalerController');

const router = express.Router();

// Public route - no authentication required
router.get('/', getWholesalers);

module.exports = router;