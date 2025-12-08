const Sale = require('../models/Sale');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Enhanced Helper function to add user filter to query
const addUserFilterToQuery = (req, query, fieldName = 'soldBy') => {
  // If soldBy is in query (added by filterByUser middleware), use it
  if (req.query[fieldName]) {
    query[fieldName] = req.query[fieldName];
    console.log(`🔍 [Sales] Filtering by ${fieldName} from query: ${req.query[fieldName]}`);
  } 
  // For admin-specific personal endpoints OR when view=my is specified
  else if (req.user && req.user._id) {
    // CRITICAL FIX: ALWAYS filter non-admin users
    if (req.user.role !== 'admin') {
      query[fieldName] = req.user._id;
      console.log(`🔍 [Sales][NON-ADMIN] Auto-filtering by ${fieldName}: ${req.user._id}`);
    } 
    // For admins, check if personal view is requested
    else {
      const isAdminPersonalView = (
        req.path.includes('/admin/') || 
        req.path.includes('/my/') ||
        req.query.view === 'my' || 
        req.query.filter === 'my' ||
        req.query.soldBy === 'me'
      );
      
      if (isAdminPersonalView) {
        // Admin in personal view: filter by their ID
        query[fieldName] = req.user._id;
        console.log(`🔍 [Sales][ADMIN PERSONAL] Filtering by ${fieldName}: ${req.user._id}`);
      } else {
        // Admin in system view: no filter (sees all)
        console.log(`🔍 [Sales][ADMIN SYSTEM VIEW] No user filter applied for ${fieldName}`);
      }
    }
  }
  return query;
};

// Helper function to generate sale number
const generateSaleNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const todayStart = new Date(date.setHours(0, 0, 0, 0));
  const todayEnd = new Date(date.setHours(23, 59, 59, 999));
  
  const lastSale = await Sale.findOne({
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
  
  return `SALE-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
};

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ SECURITY FIX: Extract and validate ownership fields
    const { soldBy, createdBy, ...safeData } = req.body;
    
    // CRITICAL SECURITY: Prevent users from creating sales for other users
    if (soldBy && soldBy !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You cannot create sales for other users'
      });
    }
    
    if (createdBy && createdBy !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You cannot set createdBy to another user'
      });
    }

    const { customer, items, discountAmount = 0, taxAmount = 0, paymentMethod, amountPaid, notes } = safeData;

    // Validate required fields
    if (!customer || !customer.name) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Sale items are required'
      });
    }

    console.log(`🛒 Creating sale by user: ${req.user.name} (${req.user.role})`);
    console.log('📍 Path:', req.path);

    // Generate sale number
    const saleNumber = await generateSaleNumber();

    // Validate and process each item
    const saleItems = [];
    let subtotal = 0;
    let totalCost = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }

      if (!product.isActive) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available for sale`
        });
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
        });
      }

      const unitPrice = item.unitPrice || product.sellingPrice;
      const unitCost = product.purchasePrice;
      const totalPrice = item.quantity * unitPrice;
      const itemTotalCost = item.quantity * unitCost;
      const profit = totalPrice - itemTotalCost;

      saleItems.push({
        product: product._id,
        productName: product.name,
        productBrand: product.brand,
        quantity: item.quantity,
        unitPrice,
        unitCost,
        totalPrice,
        totalCost: itemTotalCost,
        profit
      });

      subtotal += totalPrice;
      totalCost += itemTotalCost;

      // Update product stock
      const previousStock = product.stock;
      const newStock = previousStock - item.quantity;
      
      if (newStock < 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${previousStock}, Requested: ${item.quantity}`
        });
      }

      product.stock = newStock;
      product.totalSold += item.quantity;
      
      product.stockHistory.push({
        previousStock,
        newStock,
        unitsChanged: -item.quantity,
        type: 'sale',
        reference: null,
        referenceModel: 'Sale',
        user: req.user.id,
        notes: `Sale: ${item.quantity} units by ${req.user.name}`
      });

      await product.save({ session });
    }

    const totalAmount = subtotal - discountAmount + taxAmount;
    const totalProfit = totalAmount - totalCost;
    const paymentStatus = amountPaid >= totalAmount ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';

    // ✅ SECURITY FIX: Create sale with enforced ownership
    const sale = new Sale({
      saleNumber,
      customer,
      items: saleItems,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      totalCost,
      totalProfit,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus,
      amountPaid: amountPaid || totalAmount,
      balance: totalAmount - (amountPaid || totalAmount),
      notes,
      // CRITICAL: Force current user ownership for non-admins
      soldBy: req.user.role === 'admin' ? (soldBy || req.user.id) : req.user.id,
      createdBy: req.user.role === 'admin' ? (createdBy || req.user.id) : req.user.id
    });

    await sale.save({ session });

    // Update stock history with sale reference
    for (const item of sale.items) {
      const product = await Product.findById(item.product).session(session);
      const stockEntry = product.stockHistory[product.stockHistory.length - 1];
      stockEntry.reference = sale._id;
      await product.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate sale data
    await sale.populate('soldBy', 'name');

    console.log(`✅ Sale created: ${saleNumber} by ${req.user.name}`);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      sale,
      receipt: generateReceiptData(sale),
      createdBy: req.user.name,
      userRole: req.user.role
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating sale',
      error: error.message
    });
  }
};

// @desc    Get all sales with filtering and pagination
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, customer, status, paymentStatus } = req.query;
    
    console.log(`📋 Fetching sales for user: ${req.user.name} (${req.user.role})`);
    console.log('📍 Path:', req.path);
    
    let query = {};
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, query, 'soldBy');
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Customer filter
    if (customer) {
      query['customer.name'] = { $regex: customer, $options: 'i' };
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    const skip = (page - 1) * limit;
    
    console.log(`🔍 Sales Query:`, { 
      page, limit, skip,
      soldBy: query.soldBy ? 'Filtered by user' : 'No filter (admin system view)',
      userRole: req.user.role,
      path: req.path
    });
    
    const sales = await Sale.find(query)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Sale.countDocuments(query);
    
    console.log(`✅ Fetched ${sales.length} sales out of ${total} total`);
    
    res.json({
      success: true,
      count: sales.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      sales,
      filterInfo: {
        isFiltered: !!query.soldBy,
        userId: query.soldBy || null,
        userRole: req.user.role,
        viewType: query.soldBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });
    
  } catch (error) {
    console.error('❌ Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales',
      error: error.message
    });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
exports.getSale = async (req, res) => {
  try {
    console.log(`📄 Fetching sale: ${req.params.id} for user: ${req.user.name} (${req.user.role})`);
    
    const sale = await Sale.findById(req.params.id)
      .populate('soldBy', 'name');
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Check if user has permission to view this sale
    const isOwner = sale.soldBy._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this sale'
      });
    }
    
    console.log(`✅ Sale fetched: ${sale.saleNumber}`);
    
    res.json({
      success: true,
      sale,
      receipt: generateReceiptData(sale),
      permissionInfo: {
        isOwner,
        isAdmin,
        canCancel: isAdmin || (isOwner && sale.status === 'completed'),
        canUpdatePayment: isAdmin
      }
    });
    
  } catch (error) {
    console.error('❌ Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sale',
      error: error.message
    });
  }
};

// @desc    Update sale payment
// @route   PUT /api/sales/:id/payment
// @access  Private
exports.updatePayment = async (req, res) => {
  try {
    // ✅ SECURITY FIX: Extract and validate ownership fields
    const { amountPaid, paymentMethod, soldBy, createdBy } = req.body;
    
    // CRITICAL: Prevent users from changing sale ownership
    if (soldBy && soldBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot change sale ownership'
      });
    }
    
    if (createdBy && createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot change createdBy field'
      });
    }

    console.log(`💰 Updating payment for sale: ${req.params.id} by user: ${req.user.name} (${req.user.role})`);
    
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Check permissions
    const isOwner = sale.soldBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this sale'
      });
    }
    
    if (sale.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only update payment for completed sales'
      });
    }
    
    if (amountPaid !== undefined) {
      sale.amountPaid = amountPaid;
      sale.balance = sale.totalAmount - amountPaid;
      sale.paymentStatus = amountPaid >= sale.totalAmount ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';
    }
    
    if (paymentMethod) {
      sale.paymentMethod = paymentMethod;
    }
    
    // ✅ SECURITY FIX: Only admin can change ownership fields
    if (isAdmin) {
      if (soldBy) sale.soldBy = soldBy;
      if (createdBy) sale.createdBy = createdBy;
    }
    
    sale.updatedBy = req.user.id;
    await sale.save();
    
    console.log(`✅ Payment updated for sale: ${sale.saleNumber}`);
    
    res.json({
      success: true,
      message: 'Payment updated successfully',
      sale,
      updatedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment',
      error: error.message
    });
  }
};

// @desc    Cancel sale
// @route   PUT /api/sales/:id/cancel
// @access  Private
exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`❌ Cancelling sale: ${req.params.id} by user: ${req.user.name} (${req.user.role})`);
    
    const sale = await Sale.findById(req.params.id).session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Check permissions
    const isOwner = sale.soldBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this sale'
      });
    }
    
    if (sale.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Sale is already cancelled'
      });
    }
    
    // Restore product stock
    for (const item of sale.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        const previousStock = product.stock;
        const newStock = previousStock + item.quantity;
        
        product.stock = newStock;
        product.totalSold -= item.quantity;
        
        product.stockHistory.push({
          previousStock,
          newStock,
          unitsChanged: item.quantity,
          type: 'restock',
          reference: sale._id,
          referenceModel: 'Sale',
          user: req.user.id,
          notes: `Sale cancellation by ${req.user.name} - stock restored`
        });
        
        await product.save({ session });
      }
    }
    
    sale.status = 'cancelled';
    sale.cancelledBy = req.user.id;
    sale.cancelledAt = new Date();
    await sale.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    console.log(`✅ Sale cancelled: ${sale.saleNumber}`);
    
    res.json({
      success: true,
      message: 'Sale cancelled successfully',
      sale,
      cancelledBy: req.user.name
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Cancel sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling sale',
      error: error.message
    });
  }
};

// @desc    Delete sale permanently
// @route   DELETE /api/sales/:id
// @access  Private/Admin
exports.deleteSale = async (req, res) => {
  try {
    console.log(`🗑️ Deleting sale: ${req.params.id} by admin: ${req.user.name}`);
    
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Only admin can delete permanently
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can delete sales permanently'
      });
    }
    
    await Sale.findByIdAndDelete(req.params.id);
    
    console.log(`✅ Sale deleted permanently: ${sale.saleNumber}`);
    
    res.json({
      success: true,
      message: 'Sale deleted permanently',
      deletedSaleNumber: sale.saleNumber,
      deletedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting sale',
      error: error.message
    });
  }
};

// @desc    Resume cancelled sale
// @route   PUT /api/sales/:id/resume
// @access  Private/Admin
exports.resumeSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`🔄 Resuming sale: ${req.params.id} by admin: ${req.user.name}`);
    
    const sale = await Sale.findById(req.params.id)
      .populate('items.product')
      .session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    if (sale.status !== 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only cancelled sales can be resumed'
      });
    }
    
    // Only admin can resume sales
    if (req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Only admin users can resume cancelled sales'
      });
    }
    
    // Deduct product stock again for each item
    for (const item of sale.items) {
      const product = await Product.findById(item.product._id).session(session);
      
      if (product) {
        const previousStock = product.stock;
        const newStock = previousStock - item.quantity;
        
        if (newStock < 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}. Available: ${previousStock}, Required: ${item.quantity}`
          });
        }
        
        product.stock = newStock;
        product.totalSold += item.quantity;
        
        product.stockHistory.push({
          previousStock,
          newStock,
          unitsChanged: -item.quantity,
          type: 'sale',
          reference: sale._id,
          referenceModel: 'Sale',
          user: req.user.id,
          notes: `Sale resumed by ${req.user.name} - deducted ${item.quantity} units`
        });
        
        await product.save({ session });
      }
    }
    
    // Update sale status back to completed
    sale.status = 'completed';
    sale.updatedBy = req.user.id;
    await sale.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    console.log(`✅ Sale resumed: ${sale.saleNumber}`);
    
    res.json({
      success: true,
      message: 'Sale resumed successfully',
      sale,
      resumedBy: req.user.name
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Resume sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resuming sale',
      error: error.message
    });
  }
};

// @desc    Get sales statistics
// @route   GET /api/sales/stats
// @access  Private
exports.getSalesStats = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    console.log(`📊 Fetching sales stats for period: ${period}`);
    console.log(`👤 User: ${req.user.name} (${req.user.role})`);
    console.log('📍 Path:', req.path);
    
    let startDate, endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date().setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date().setDate(new Date().getDate() - 7);
        break;
      case 'month':
        startDate = new Date().setMonth(new Date().getMonth() - 1);
        break;
      case 'year':
        startDate = new Date().setFullYear(new Date().getFullYear() - 1);
        break;
      default:
        startDate = new Date().setHours(0, 0, 0, 0);
    }
    
    // Build query with user filter
    let query = {
      createdAt: { $gte: new Date(startDate), $lte: endDate },
      status: 'completed'
    };
    
    // Add user filter - automatic based on user role and route
    addUserFilterToQuery(req, query, 'soldBy');
    
    console.log(`🔍 Sales Stats Query:`, { 
      period,
      soldBy: query.soldBy ? 'Filtered by user' : 'No filter (admin system view)',
      userRole: req.user.role,
      path: req.path
    });
    
    const stats = await Sale.aggregate([
      {
        $match: query
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          totalItemsSold: { $sum: { $sum: '$items.quantity' } },
          averageSale: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalItemsSold: 0,
      averageSale: 0
    };
    
    console.log(`✅ Sales stats fetched: ${result.totalSales} sales`);
    
    res.json({
      success: true,
      period,
      stats: result,
      filterInfo: {
        isFiltered: !!query.soldBy,
        userId: query.soldBy || null,
        userRole: req.user.role,
        viewType: query.soldBy ? 'personal' : 'system',
        accessedVia: req.path
      }
    });
    
  } catch (error) {
    console.error('❌ Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales statistics',
      error: error.message
    });
  }
};

// @desc    Get user's personal sales
// @route   GET /api/sales/my-sales
// @access  Private
exports.getMySales = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, status, paymentStatus } = req.query;
    
    console.log(`📋 Fetching personal sales for user: ${req.user.name} (${req.user.role})`);
    
    let query = {
      soldBy: req.user._id // Always filter by current user
    };
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    const skip = (page - 1) * limit;
    
    console.log(`🔍 Personal Sales Query:`, { 
      page, limit, skip,
      soldBy: req.user._id,
      userRole: req.user.role
    });
    
    const sales = await Sale.find(query)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Sale.countDocuments(query);
    
    console.log(`✅ Fetched ${sales.length} personal sales`);
    
    res.json({
      success: true,
      count: sales.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      sales,
      filterInfo: {
        isFiltered: true,
        userId: req.user._id,
        userRole: req.user.role,
        viewType: 'personal'
      }
    });
    
  } catch (error) {
    console.error('❌ Get my sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching personal sales',
      error: error.message
    });
  }
};

// @desc    Get admin's personal sales
// @route   GET /api/sales/admin/my-sales
// @access  Private/Admin
exports.getAdminSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, status, paymentStatus } = req.query;
    
    console.log(`📋 [ADMIN PERSONAL] Fetching sales for admin: ${req.user.name}`);
    
    let query = {
      soldBy: req.user._id // Always filter by current admin
    };
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    const skip = (page - 1) * limit;
    
    console.log(`🔍 [ADMIN PERSONAL] Sales Query:`, { 
      page, limit, skip,
      soldBy: req.user._id
    });
    
    const sales = await Sale.find(query)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Sale.countDocuments(query);
    
    console.log(`✅ [ADMIN PERSONAL] Fetched ${sales.length} sales`);
    
    res.json({
      success: true,
      count: sales.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      sales,
      filterInfo: {
        isFiltered: true,
        userId: req.user._id,
        userRole: 'admin',
        viewType: 'personal'
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN PERSONAL] Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin personal sales',
      error: error.message
    });
  }
};

// Helper function to generate receipt data
function generateReceiptData(sale) {
  return {
    saleNumber: sale.saleNumber,
    date: sale.createdAt.toLocaleDateString(),
    time: sale.createdAt.toLocaleTimeString(),
    customer: sale.customer,
    items: sale.items.map(item => ({
      name: item.productName,
      brand: item.productBrand,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    taxAmount: sale.taxAmount,
    totalAmount: sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    amountPaid: sale.amountPaid,
    balance: sale.balance,
    soldBy: sale.soldBy?.name || 'System',
    notes: sale.notes
  };
}