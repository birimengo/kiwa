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
    trim: true,
    set: function(value) {
      // Format phone number on save
      if (!value) return value;
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        return '+256' + cleaned.substring(1);
      }
      if (!cleaned.startsWith('+')) {
        return '+' + cleaned;
      }
      return value;
    }
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
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for faster queries
whatsappConfigSchema.index({ user: 1 });
whatsappConfigSchema.index({ isActive: true });
whatsappConfigSchema.index({ phoneNumber: 1 });

// Virtual for formatted phone number (masked for security)
whatsappConfigSchema.virtual('maskedPhone').get(function() {
  if (!this.phoneNumber) return '';
  const cleaned = this.phoneNumber.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    const visibleDigits = 4;
    const masked = '*'.repeat(cleaned.length - visibleDigits);
    const lastDigits = cleaned.slice(-visibleDigits);
    return `+${cleaned.substring(0, cleaned.length - visibleDigits).replace(/\d/g, '*')}${lastDigits}`;
  }
  return this.phoneNumber;
});

// Virtual for checking if config is complete
whatsappConfigSchema.virtual('isComplete').get(function() {
  return !!(this.phoneNumber && this.apiKey && this.isActive);
});

// Static methods
whatsappConfigSchema.statics.getActiveConfigs = async function() {
  return await this.find({
    isActive: true,
    phoneNumber: { $exists: true, $ne: null },
    apiKey: { $exists: true, $ne: null }
  }).populate('user', 'name email role');
};

whatsappConfigSchema.statics.getConfigByUser = async function(userId) {
  return await this.findOne({ user: userId })
    .select('+apiKey') // Include API key for internal use
    .populate('user', 'name email role');
};

// Instance methods
whatsappConfigSchema.methods.canReceiveNotification = function(type) {
  if (!this.isActive || !this.phoneNumber || !this.apiKey) {
    return false;
  }
  
  switch(type) {
    case 'new_order':
      return this.notifications.newOrders;
    case 'processing':
    case 'delivered':
    case 'confirmed':
    case 'cancelled':
      return this.notifications.orderUpdates;
    case 'payment':
      return this.notifications.payments;
    case 'low_stock':
      return this.notifications.lowStock;
    default:
      return false;
  }
};

// Pre-save middleware
whatsappConfigSchema.pre('save', function(next) {
  if (this.isModified('phoneNumber') && this.phoneNumber) {
    // Ensure phone number is properly formatted
    const cleaned = this.phoneNumber.replace(/\D/g, '');
    if (!cleaned.startsWith('+')) {
      this.phoneNumber = '+' + cleaned;
    }
  }
  
  if (this.isModified('isActive') && this.isActive === false) {
    this.deactivatedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('WhatsAppConfig', whatsappConfigSchema);