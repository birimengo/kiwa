const mongoose = require('mongoose');

// Comment Schema
const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Please add a comment text'],
    maxlength: [500, 'Comment cannot be more than 500 characters']
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Please add a rating between 1 and 5']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Stock History Schema
const stockHistorySchema = new mongoose.Schema({
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  unitsChanged: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['sale', 'restock', 'adjustment', 'return'],
    required: true
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Sale', 'Restock', 'Adjustment', 'Order'],
    required: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Main Product Schema
const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters'],
    index: true
  },
  brand: {
    type: String,
    required: [true, 'Please add a brand name'],
    trim: true,
    index: true
  },
  
  // Pricing
  purchasePrice: {
    type: Number,
    required: [true, 'Please add a purchase price'],
    min: [0, 'Purchase price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add a selling price'],
    min: [0, 'Selling price cannot be negative'],
    index: true
  },
  
  // Categorization
  category: {
    type: String,
    required: [true, 'Please add a category'],
    trim: true,
    index: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Description & Media
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot be more than 200 characters']
  },
  images: [{
    type: String,
    required: true
  }],
  
  // Inventory Management
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lowStockAlert: {
    type: Number,
    default: 10,
    min: 0
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0
  },
  availableStock: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Reviews & Engagement
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  comments: [commentSchema],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  
  // Product Status
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  
  // Sales & Analytics
  stockHistory: [stockHistorySchema],
  totalSold: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  lastSold: {
    type: Date
  },
  lastRestocked: {
    type: Date
  },
  
  // Identification
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  barcode: {
    type: String,
    sparse: true,
    trim: true
  },
  
  // Organization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Physical Properties
  weight: {
    value: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb', 'oz'],
      default: 'g'
    }
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: {
      type: String,
      enum: ['cm', 'm', 'in', 'ft'],
      default: 'cm'
    }
  },
  
  // Shipping Information
  shippingWeight: {
    value: { type: Number, min: 0 },
    unit: { type: String, enum: ['g', 'kg', 'lb', 'oz'], default: 'g' }
  },
  requiresShipping: {
    type: Boolean,
    default: true
  },
  
  // SEO & Marketing
  metaTitle: {
    type: String,
    maxlength: 60
  },
  metaDescription: {
    type: String,
    maxlength: 160
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true
  },
  
  // Vendor Information
  vendor: {
    type: String,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },
  
  // Warranty & Support
  warranty: {
    duration: { type: Number, min: 0 }, // in months
    description: String
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate average rating and total reviews before save
productSchema.pre('save', function(next) {
  // Calculate average rating
  if (this.comments && this.comments.length > 0) {
    const activeComments = this.comments.filter(comment => comment.isActive !== false);
    if (activeComments.length > 0) {
      this.averageRating = activeComments.reduce((acc, item) => item.rating + acc, 0) / activeComments.length;
      this.totalReviews = activeComments.length;
    } else {
      this.averageRating = 0;
      this.totalReviews = 0;
    }
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }
  
  // Calculate available stock
  this.availableStock = Math.max(0, this.stock - this.reservedStock);
  
  // Generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  next();
});

// Virtual Fields
productSchema.virtual('profitMargin').get(function() {
  if (this.purchasePrice > 0) {
    return ((this.sellingPrice - this.purchasePrice) / this.purchasePrice * 100).toFixed(2);
  }
  return 0;
});

productSchema.virtual('profitAmount').get(function() {
  return this.sellingPrice - this.purchasePrice;
});

productSchema.virtual('isLowStock').get(function() {
  return this.availableStock <= this.lowStockAlert;
});

productSchema.virtual('isOutOfStock').get(function() {
  return this.availableStock <= 0;
});

productSchema.virtual('totalCost').get(function() {
  return this.totalSold * this.purchasePrice;
});

productSchema.virtual('totalProfit').get(function() {
  return (this.sellingPrice - this.purchasePrice) * this.totalSold;
});

// FIXED: popularityScore virtual field with proper null checks
productSchema.virtual('popularityScore').get(function() {
  const viewsWeight = 0.3;
  const likesWeight = 0.3;
  const salesWeight = 0.4;
  
  // Add null checks to prevent "Cannot read properties of undefined" error
  const views = this.views || 0;
  const likesCount = (this.likes && this.likes.length) || 0;
  const totalSold = this.totalSold || 0;
  
  return (views * viewsWeight) + (likesCount * likesWeight) + (totalSold * salesWeight);
});

// Methods
productSchema.methods.updateStock = async function(quantity, type, reference, referenceModel, user, notes = '') {
  const previousStock = this.stock;
  let newStock;
  
  if (type === 'sale') {
    newStock = previousStock - quantity;
    if (newStock < 0) {
      throw new Error(`Insufficient stock. Available: ${previousStock}, Requested: ${quantity}`);
    }
    this.totalSold += quantity;
    this.totalRevenue += quantity * this.sellingPrice;
    this.lastSold = new Date();
  } else if (type === 'restock') {
    newStock = previousStock + quantity;
    this.lastRestocked = new Date();
  } else if (type === 'adjustment') {
    newStock = quantity;
  } else if (type === 'return') {
    newStock = previousStock + quantity;
  }
  
  this.stock = newStock;
  this.availableStock = Math.max(0, this.stock - this.reservedStock);
  
  // Add to stock history
  this.stockHistory.push({
    previousStock,
    newStock,
    unitsChanged: type === 'sale' ? -quantity : quantity,
    type,
    reference,
    referenceModel,
    user,
    notes,
    date: new Date()
  });
  
  await this.save();
  return this;
};

productSchema.methods.reserveStock = async function(quantity) {
  if (this.availableStock < quantity) {
    throw new Error(`Insufficient available stock. Available: ${this.availableStock}, Requested: ${quantity}`);
  }
  
  this.reservedStock += quantity;
  this.availableStock = this.stock - this.reservedStock;
  
  await this.save();
  return this;
};

productSchema.methods.releaseStock = async function(quantity) {
  this.reservedStock = Math.max(0, this.reservedStock - quantity);
  this.availableStock = this.stock - this.reservedStock;
  
  await this.save();
  return this;
};

productSchema.methods.addComment = async function(userId, text, rating) {
  this.comments.push({
    user: userId,
    text,
    rating
  });
  
  await this.save();
  return this;
};

productSchema.methods.toggleLike = async function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
  } else {
    this.likes.push(userId);
  }
  
  await this.save();
  return this;
};

productSchema.methods.isLikedBy = function(userId) {
  return this.likes.includes(userId);
};

productSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
  return this;
};

productSchema.methods.toggleFeatured = async function() {
  this.featured = !this.featured;
  await this.save();
  return this;
};

productSchema.methods.toggleActive = async function() {
  this.isActive = !this.isActive;
  await this.save();
  return this;
};

// Static Methods
productSchema.statics.findLowStock = function() {
  return this.find({
    $expr: {
      $lte: ['$availableStock', '$lowStockAlert']
    },
    isActive: true
  });
};

productSchema.statics.findOutOfStock = function() {
  return this.find({
    availableStock: 0,
    isActive: true
  });
};

productSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category: new RegExp(category, 'i'),
    isActive: true 
  });
};

productSchema.statics.findFeatured = function() {
  return this.find({ 
    featured: true,
    isActive: true 
  });
};

productSchema.statics.findPopular = function(limit = 10) {
  return this.find({ 
    isActive: true 
  })
  .sort({ popularityScore: -1, totalSold: -1 })
  .limit(limit);
};

productSchema.statics.searchProducts = function(searchTerm, filters = {}) {
  const query = {
    $and: [
      {
        $or: [
          { name: new RegExp(searchTerm, 'i') },
          { brand: new RegExp(searchTerm, 'i') },
          { description: new RegExp(searchTerm, 'i') },
          { tags: new RegExp(searchTerm, 'i') },
          { sku: new RegExp(searchTerm, 'i') }
        ]
      },
      { isActive: true }
    ]
  };

  // Apply additional filters
  if (filters.category) {
    query.$and.push({ category: new RegExp(filters.category, 'i') });
  }
  if (filters.minPrice || filters.maxPrice) {
    query.$and.push({ sellingPrice: {} });
    if (filters.minPrice) query.$and[query.$and.length - 1].sellingPrice.$gte = parseFloat(filters.minPrice);
    if (filters.maxPrice) query.$and[query.$and.length - 1].sellingPrice.$lte = parseFloat(filters.maxPrice);
  }
  if (filters.inStock === 'true') {
    query.$and.push({ availableStock: { $gt: 0 } });
  }
  if (filters.featured === 'true') {
    query.$and.push({ featured: true });
  }

  return this.find(query);
};

productSchema.statics.getProductStats = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$stock', '$purchasePrice'] } },
        totalRevenue: { $sum: '$totalRevenue' },
        totalSold: { $sum: '$totalSold' },
        averageRating: { $avg: '$averageRating' },
        outOfStock: {
          $sum: {
            $cond: [{ $lte: ['$availableStock', 0] }, 1, 0]
          }
        },
        lowStock: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$availableStock', 0] },
                  { $lte: ['$availableStock', '$lowStockAlert'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : {
    totalProducts: 0,
    totalValue: 0,
    totalRevenue: 0,
    totalSold: 0,
    averageRating: 0,
    outOfStock: 0,
    lowStock: 0
  };
};

// Indexes for better query performance
productSchema.index({
  name: 'text',
  brand: 'text',
  description: 'text',
  tags: 'text',
  sku: 'text'
});

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ averageRating: -1, isActive: 1 });
productSchema.index({ featured: -1, isActive: 1 });
productSchema.index({ 'availableStock': 1, isActive: 1 });
productSchema.index({ createdAt: -1, isActive: 1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });
productSchema.index({ 'sellingPrice': 1, isActive: 1 });
productSchema.index({ totalSold: -1, isActive: 1 });
productSchema.index({ popularityScore: -1, isActive: 1 });
productSchema.index({ createdBy: 1, isActive: 1 });

// Ensure virtual fields are serialized with proper transformation
productSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Remove internal fields if needed
    delete ret.reservedStock;
    return ret;
  }
});

productSchema.set('toObject', { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);