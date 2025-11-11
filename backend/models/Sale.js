const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productBrand: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    required: true
  },
  images: [{
    type: String
  }]
});

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    location: {
      type: String,
      trim: true
    }
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfit: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_money', 'bank_transfer', 'onDelivery', 'mtn', 'airtel'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partially_paid', 'failed', 'refunded'],
    default: 'paid'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded', 'pending', 'processing'],
    default: 'completed'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiptPrinted: {
    type: Boolean,
    default: false
  },
  // New fields for order integration
  orderReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'Uganda'
    },
    postalCode: String
  },
  shippingFee: {
    type: Number,
    default: 0,
    min: 0
  },
  // Status history for tracking
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Additional financial tracking
  taxRate: {
    type: Number,
    default: 0.18 // 18% VAT default
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Customer feedback
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  customerFeedback: {
    type: String,
    maxlength: 1000
  },
  // Analytics fields
  saleType: {
    type: String,
    enum: ['walkin', 'online', 'phone', 'wholesale', 'retail'],
    default: 'walkin'
  },
  season: {
    type: String,
    enum: ['low', 'medium', 'high', 'peak'],
    default: 'medium'
  },
  // Timestamps for different stages
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  // Reference fields
  referenceNumber: {
    type: String
  },
  invoiceNumber: {
    type: String
  },
  // Payment details
  transactionId: {
    type: String
  },
  paymentGateway: {
    type: String
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  // Delivery information
  deliveredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deliveredAt: {
    type: Date
  },
  deliveryNotes: {
    type: String,
    maxlength: 500
  },
  // Return and exchange information
  returnReason: {
    type: String
  },
  exchangeDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  // Commission tracking
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commissionAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  salesPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Cost tracking
  operationalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  netProfit: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate sale number before save
saleSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Find the latest sale for today
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const lastSale = await this.constructor.findOne({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }).sort({ createdAt: -1 });
    
    let sequence = 1;
    if (lastSale && lastSale.saleNumber) {
      const lastSequence = parseInt(lastSale.saleNumber.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    this.saleNumber = `SALE-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
  }
  next();
});

// Calculate totals before save
saleSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    item.totalCost = item.quantity * item.unitCost;
    item.profit = item.totalPrice - item.totalCost;
  });
  
  // Calculate sale totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalCost = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  
  // Calculate discount if percentage is provided
  if (this.discountPercentage > 0 && this.discountAmount === 0) {
    this.discountAmount = (this.subtotal * this.discountPercentage) / 100;
  }
  
  // Calculate tax if not explicitly set
  if (this.taxAmount === 0 && this.taxRate > 0) {
    this.taxAmount = (this.subtotal - this.discountAmount) * this.taxRate;
  }
  
  this.totalAmount = this.subtotal - this.discountAmount + this.taxAmount + this.shippingFee;
  this.totalProfit = this.totalAmount - this.totalCost;
  this.balance = this.totalAmount - this.amountPaid;
  
  // Calculate net profit (after operational costs and commission)
  this.netProfit = this.totalProfit - this.operationalCost - this.commissionAmount;
  
  // Auto-set completedAt for completed sales
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Auto-set cancelledAt for cancelled sales
  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  // Auto-set refundedAt for refunded sales
  if (this.status === 'refunded' && !this.refundedAt) {
    this.refundedAt = new Date();
  }
  
  next();
});

// Add status to history when status changes
saleSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status) {
    this.statusHistory.push({
      status: this.status,
      note: `Status changed to ${this.status}`,
      changedBy: this.soldBy
    });
  }
  
  if (this.isModified('paymentStatus') && this.paymentStatus) {
    this.statusHistory.push({
      status: `payment_${this.paymentStatus}`,
      note: `Payment status changed to ${this.paymentStatus}`
    });
  }
  
  next();
});

// Virtual for profit margin
saleSchema.virtual('profitMargin').get(function() {
  if (this.totalAmount === 0) return 0;
  return ((this.totalProfit / this.totalAmount) * 100).toFixed(2);
});

// Virtual for net profit margin
saleSchema.virtual('netProfitMargin').get(function() {
  if (this.totalAmount === 0) return 0;
  return ((this.netProfit / this.totalAmount) * 100).toFixed(2);
});

// Virtual for discount percentage (calculated from amount)
saleSchema.virtual('calculatedDiscountPercentage').get(function() {
  if (this.subtotal === 0) return 0;
  return ((this.discountAmount / this.subtotal) * 100).toFixed(2);
});

// Virtual for total items count
saleSchema.virtual('totalItems').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for sale duration (in days)
saleSchema.virtual('saleDuration').get(function() {
  if (!this.completedAt || !this.createdAt) return 0;
  const duration = this.completedAt - this.createdAt;
  return Math.ceil(duration / (1000 * 60 * 60 * 24)); // Convert to days
});

// Index for better performance
saleSchema.index({ saleNumber: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ 'customer.name': 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ paymentStatus: 1 });
saleSchema.index({ soldBy: 1 });
saleSchema.index({ orderReference: 1 });
saleSchema.index({ totalAmount: -1 });

// Static method to get sales statistics
saleSchema.statics.getSalesStats = async function(period = 'month') {
  let startDate = new Date();
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalProfit: { $sum: '$totalProfit' },
        totalNetProfit: { $sum: '$netProfit' },
        totalItemsSold: { $sum: { $sum: '$items.quantity' } },
        averageSale: { $avg: '$totalAmount' },
        averageProfit: { $avg: '$totalProfit' }
      }
    }
  ]);
};

// Instance method to generate receipt data
saleSchema.methods.generateReceipt = function() {
  return {
    saleNumber: this.saleNumber,
    date: this.createdAt.toLocaleDateString(),
    time: this.createdAt.toLocaleTimeString(),
    customer: this.customer,
    items: this.items.map(item => ({
      name: item.productName,
      brand: item.productBrand,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })),
    subtotal: this.subtotal,
    discountAmount: this.discountAmount,
    taxAmount: this.taxAmount,
    shippingFee: this.shippingFee,
    totalAmount: this.totalAmount,
    paymentMethod: this.paymentMethod,
    amountPaid: this.amountPaid,
    balance: this.balance,
    soldBy: this.soldBy?.name || 'System',
    notes: this.notes
  };
};

// Instance method to calculate commission
saleSchema.methods.calculateCommission = function() {
  if (this.commissionRate > 0 && this.commissionAmount === 0) {
    this.commissionAmount = (this.totalAmount * this.commissionRate) / 100;
  }
  return this.commissionAmount;
};

saleSchema.set('toJSON', { virtuals: true });
saleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sale', saleSchema);