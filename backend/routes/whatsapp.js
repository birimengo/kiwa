const express = require('express');
const {
  getConfig,
  saveConfig,
  testNotification,
  deactivate,
  getNotificationLogs,
  verifyApiKey,
  getStats
} = require('../controllers/whatsappController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Config routes
router.route('/config')
  .get(getConfig)
  .post(saveConfig)
  .delete(deactivate);

// Test notification
router.post('/test', testNotification);

// Verification
router.post('/verify', verifyApiKey);

// Statistics
router.get('/stats', getStats);

// Notification logs (optional - for debugging)
router.get('/logs', getNotificationLogs);

module.exports = router;