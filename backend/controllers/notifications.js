const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({ user: req.user.id })
      .populate('order', 'orderNumber orderStatus totalAmount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });
    
    const total = await Notification.countDocuments({ user: req.user.id });
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    ).populate('order', 'orderNumber orderStatus totalAmount');
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Get updated unread count
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });
    
    res.json({
      success: true,
      notification,
      unreadCount
    });
    
  } catch (error) {
    console.error('❌ Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const result = await Notification.updateMany(
      { 
        user: req.user.id, 
        isRead: false 
      },
      { 
        isRead: true,
        readAt: new Date()
      },
      { session }
    );
    
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('❌ Mark all notifications as read error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications',
      error: error.message
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });
    
    res.json({
      success: true,
      unreadCount: count
    });
    
  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification count',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Get updated unread count
    const unreadCount = await Notification.countDocuments({ 
      user: req.user.id, 
      isRead: false 
    });
    
    res.json({
      success: true,
      message: 'Notification deleted successfully',
      unreadCount
    });
    
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification',
      error: error.message
    });
  }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
exports.clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ user: req.user.id });
    
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} notifications`,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error('❌ Clear all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing notifications',
      error: error.message
    });
  }
};