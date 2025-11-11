const Sale = require('../models/Sale');
const Product = require('../models/Product');
const mongoose = require('mongoose');

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
// @access  Private (Admin, Sales)
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer, items, discountAmount = 0, taxAmount = 0, paymentMethod, amountPaid, notes } = req.body;

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
        notes: `Sale: ${item.quantity} units`
      });

      await product.save({ session });
    }

    const totalAmount = subtotal - discountAmount + taxAmount;
    const totalProfit = totalAmount - totalCost;
    const paymentStatus = amountPaid >= totalAmount ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';

    // Create sale
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
      soldBy: req.user.id
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

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      sale,
      receipt: generateReceiptData(sale)
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating sale',
      error: error.message
    });
  }
};

// @desc    Get all sales with filtering and pagination
// @route   GET /api/sales
// @access  Private (Admin, Sales)
exports.getSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, customer, status, paymentStatus } = req.query;
    
    let query = {};
    
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
    
    const sales = await Sale.find(query)
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Sale.countDocuments(query);
    
    res.json({
      success: true,
      count: sales.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      sales
    });
    
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales',
      error: error.message
    });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private (Admin, Sales)
exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('soldBy', 'name');
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    res.json({
      success: true,
      sale,
      receipt: generateReceiptData(sale)
    });
    
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sale',
      error: error.message
    });
  }
};

// @desc    Update sale payment
// @route   PUT /api/sales/:id/payment
// @access  Private (Admin, Sales)
exports.updatePayment = async (req, res) => {
  try {
    const { amountPaid, paymentMethod } = req.body;
    
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
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
    
    await sale.save();
    
    res.json({
      success: true,
      message: 'Payment updated successfully',
      sale
    });
    
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment',
      error: error.message
    });
  }
};

// @desc    Cancel sale
// @route   PUT /api/sales/:id/cancel
// @access  Private (Admin)
exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(req.params.id).session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
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
          notes: 'Sale cancellation - stock restored'
        });
        
        await product.save({ session });
      }
    }
    
    sale.status = 'cancelled';
    await sale.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.json({
      success: true,
      message: 'Sale cancelled successfully',
      sale
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Cancel sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling sale',
      error: error.message
    });
  }
};

// @desc    Delete sale permanently
// @route   DELETE /api/sales/:id
// @access  Private (Admin)
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    await Sale.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Sale deleted permanently'
    });
    
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting sale',
      error: error.message
    });
  }
};

// @desc    Resume cancelled sale
// @route   PUT /api/sales/:id/resume
// @access  Private (Admin)
exports.resumeSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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
          notes: `Sale resumed - deducted ${item.quantity} units`
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
    
    res.json({
      success: true,
      message: 'Sale resumed successfully',
      sale
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Resume sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resuming sale',
      error: error.message
    });
  }
};

// @desc    Get sales statistics
// @route   GET /api/sales/stats
// @access  Private (Admin, Sales)
exports.getSalesStats = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
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
    
    const stats = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: endDate },
          status: 'completed'
        }
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
    
    res.json({
      success: true,
      period,
      stats: result
    });
    
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales statistics',
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