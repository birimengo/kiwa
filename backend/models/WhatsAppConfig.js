const mongoose = require('mongoose');

const whatsappConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  apiKey: {
    type: String,
    trim: true,
    select: false // Never return this field in queries
  },
  isActive: {
    type: Boolean,
    default: false
  },
  notifications: {
    newOrders: {
      type: Boolean,
      default: true
    },
    orderUpdates: {
      type: Boolean,
      default: true
    },
    payments: {
      type: Boolean,
      default: true
    },
    lowStock: {
      type: Boolean,
      default: true
    }
  },
  lastTestAt: {
    type: Date
  },
  lastTestStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  deactivatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
whatsappConfigSchema.index({ user: 1 });
whatsappConfigSchema.index({ isActive: 1 });
whatsappConfigSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model('WhatsAppConfig', whatsappConfigSchema);