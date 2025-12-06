const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  clearAllNotifications
} = require('../controllers/notifications');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getNotifications)
  .delete(clearAllNotifications);

router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);

router.route('/:id')
  .delete(deleteNotification);

router.put('/:id/read', markAsRead);

module.exports = router;