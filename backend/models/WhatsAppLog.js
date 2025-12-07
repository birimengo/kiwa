const mongoose = require('mongoose');

const whatsappLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['new_order', 'processing', 'delivered', 'confirmed', 'cancelled', 'test', 'payment', 'low_stock'],
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  orderNumber: {
    type: String
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  message: {
    type: String
  },
  success: {
    type: Boolean,
    default: false
  },
  response: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
whatsappLogSchema.index({ user: 1, createdAt: -1 });
whatsappLogSchema.index({ orderNumber: 1 });
whatsappLogSchema.index({ success: 1 });
whatsappLogSchema.index({ type: 1 });

module.exports = mongoose.model('WhatsAppLog', whatsappLogSchema);