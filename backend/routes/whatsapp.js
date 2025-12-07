const express = require('express');
const {
  getConfig,
  saveConfig,
  testNotification,
  deactivate,
  getNotificationLogs,
  verifyApiKey,
  getStats,
  debugWhatsApp,          // Added
  clearLogs,             // Added
  getAllAdminConfigs     // Added
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

// Notification logs (for debugging)
router.route('/logs')
  .get(getNotificationLogs)
  .delete(clearLogs); // Added DELETE endpoint

// Debug endpoint
router.get('/debug', debugWhatsApp);

// System endpoints (admin only)
router.get('/admin/configs', getAllAdminConfigs);

module.exports = router;