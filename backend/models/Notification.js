const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['new_order', 'status_update', 'payment_update'],
    default: 'new_order'
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Add index for faster queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ order: 1 });

module.exports = mongoose.model('Notification', notificationSchema);