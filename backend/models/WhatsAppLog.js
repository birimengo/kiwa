const mongoose = require('mongoose');

const whatsappLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  },
  retryCount: {
    type: Number,
    default: 0
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
whatsappLogSchema.index({ user: 1, createdAt: -1 });
whatsappLogSchema.index({ orderNumber: 1 });
whatsappLogSchema.index({ success: 1 });
whatsappLogSchema.index({ type: 1 });
whatsappLogSchema.index({ phoneNumber: 1 });

// Virtual for formatted phone number
whatsappLogSchema.virtual('formattedPhone').get(function() {
  if (!this.phoneNumber) return '';
  const cleaned = this.phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('256')) {
    return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  return this.phoneNumber;
});

// Static methods
whatsappLogSchema.statics.logNotification = async function(logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error('Error logging WhatsApp notification:', error);
    return null;
  }
};

whatsappLogSchema.statics.getUserLogs = async function(userId, limit = 50) {
  return await this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

whatsappLogSchema.statics.getSuccessRate = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId.createFromHexString(userId),
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return { total: 0, successful: 0, rate: 0 };
  }
  
  const { total, successful } = stats[0];
  return {
    total,
    successful,
    rate: total > 0 ? Math.round((successful / total) * 100) : 0
  };
};

module.exports = mongoose.model('WhatsAppLog', whatsappLogSchema);