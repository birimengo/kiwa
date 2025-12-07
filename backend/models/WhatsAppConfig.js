const mongoose = require('mongoose');

const whatsappConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    set: function(value) {
      if (!value) return value;
      
      // Remove all non-digit characters
      let cleaned = value.replace(/\D/g, '');
      
      console.log(`📱 Setting phone number: ${value} -> ${cleaned}`);
      
      // If starts with 0, convert to +256 (Uganda)
      if (cleaned.startsWith('0')) {
        cleaned = '256' + cleaned.substring(1);
        console.log(`📱 Converted 0 to 256: ${cleaned}`);
      }
      
      // Add + prefix
      return '+' + cleaned;
    },
    get: function(value) {
      return value; // Return as stored
    }
  },
  apiKey: {
    type: String,
    trim: true,
    select: false, // Never return this field in queries by default
    required: function() {
      return this.isActive; // Only required when active
    }
  },
  isActive: {
    type: Boolean,
    default: false,
    index: true
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
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.apiKey; // Never include API key in JSON responses
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.apiKey; // Never include API key in object responses
      return ret;
    }
  }
});

// Add indexes for faster queries
whatsappConfigSchema.index({ phoneNumber: 1 });
whatsappConfigSchema.index({ isActive: 1, lastTestStatus: 1 });

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

// Virtual for display phone number
whatsappConfigSchema.virtual('displayPhone').get(function() {
  if (!this.phoneNumber) return '';
  const cleaned = this.phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('256')) {
    // Format: +256 XXX XXX XXX
    return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  return this.phoneNumber;
});

// Static methods
whatsappConfigSchema.statics.getActiveConfigs = async function() {
  return await this.find({
    isActive: true,
    phoneNumber: { $exists: true, $ne: null, $ne: '' },
    apiKey: { $exists: true, $ne: null, $ne: '' }
  })
  .select('+apiKey') // Include API key for internal use
  .populate('user', 'name email role')
  .lean();
};

whatsappConfigSchema.statics.getConfigByUser = async function(userId) {
  return await this.findOne({ user: userId })
    .select('+apiKey') // Include API key for internal use
    .populate('user', 'name email role');
};

whatsappConfigSchema.statics.getActiveAdminsForNotification = async function(notificationType) {
  const notificationPrefKey = {
    'new_order': 'newOrders',
    'processing': 'orderUpdates',
    'delivered': 'orderUpdates',
    'confirmed': 'orderUpdates',
    'cancelled': 'orderUpdates',
    'payment': 'payments',
    'low_stock': 'lowStock'
  }[notificationType] || 'newOrders';
  
  return await this.find({
    isActive: true,
    phoneNumber: { $exists: true, $ne: null, $ne: '' },
    apiKey: { $exists: true, $ne: null, $ne: '' },
    [`notifications.${notificationPrefKey}`]: true
  })
  .select('+apiKey')
  .populate('user', '_id name email role')
  .lean();
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

whatsappConfigSchema.methods.testConfiguration = async function() {
  try {
    const whatsappService = require('../services/whatsappService');
    
    // Generate test order
    const testOrder = whatsappService.generateTestOrder();
    
    // Send test notification
    const result = await whatsappService.sendOrderNotification(
      {
        phoneNumber: this.phoneNumber,
        apiKey: this.apiKey
      },
      testOrder,
      'new_order',
      'Configuration test'
    );
    
    // Update test status
    this.lastTestAt = new Date();
    this.lastTestStatus = result.success ? 'success' : 'failed';
    await this.save();
    
    return result;
  } catch (error) {
    console.error('Configuration test error:', error);
    this.lastTestAt = new Date();
    this.lastTestStatus = 'failed';
    await this.save();
    return { success: false, error: error.message };
  }
};

// Pre-save middleware
whatsappConfigSchema.pre('save', function(next) {
  console.log(`📱 Saving WhatsApp config for user ${this.user}`);
  
  if (this.isModified('phoneNumber') && this.phoneNumber) {
    // Ensure phone number is properly formatted
    const cleaned = this.phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      this.phoneNumber = '+256' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      this.phoneNumber = '+' + cleaned;
    }
  }
  
  if (this.isModified('isActive') && this.isActive === false) {
    this.deactivatedAt = new Date();
    this.lastTestStatus = 'pending';
  }
  
  if (this.isModified('isActive') && this.isActive === true) {
    this.deactivatedAt = null;
  }
  
  next();
});

// Post-save middleware
whatsappConfigSchema.post('save', function(doc) {
  console.log(`✅ WhatsApp config saved for user ${doc.user}:`, {
    isActive: doc.isActive,
    hasPhone: !!doc.phoneNumber,
    hasApiKey: !!doc.apiKey
  });
});

module.exports = mongoose.model('WhatsAppConfig', whatsappConfigSchema);