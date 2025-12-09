// orders.js - COMPLETE UPDATED VERSION
const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// ==================== HELPER FUNCTIONS ====================

// Helper function to generate order number
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const todayStart = new Date(date.setHours(0, 0, 0, 0));
  const todayEnd = new Date(date.setHours(23, 59, 59, 999));
  
  const lastOrder = await Order.findOne({
    createdAt: {
      $gte: todayStart,
      $lte: todayEnd
    }
  }).sort({ createdAt: -1 });
  
  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop());
    sequence = lastSequence + 1;
  }
  
  return `ORD-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
};

// Helper function to create notification
async function createOrderNotification(order, type = 'new_order', note = '', targetUserId = null) {
  try {
    const User = require('../models/User');
    let usersToNotify = [];
    
    if (targetUserId) {
      usersToNotify.push({ _id: targetUserId });
    } else {
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      usersToNotify = adminUsers;
    }
    
    if (usersToNotify.length === 0) return;
    
    let message = '';
    switch(type) {
      case 'new_order':
        message = `New order #${order.orderNumber} from ${order.customer.name}`;
        break;
      case 'cancelled':
        message = `Order #${order.orderNumber} has been cancelled`;
        break;
      case 'delivered':
        message = `Order #${order.orderNumber} has been delivered`;
        break;
      case 'confirmed':
        message = `Order #${order.orderNumber} delivery confirmed by customer`;
        break;
      case 'processing':
        message = `Order #${order.orderNumber} is now being processed`;
        break;
      default:
        message = `Order #${order.orderNumber} has been updated`;
    }
    
    if (note) message += `: ${note}`;
    
    const notificationPromises = usersToNotify.map(user => {
      return Notification.create({
        user: user._id,
        order: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        totalAmount: order.totalAmount,
        type: type,
        message: message
      });
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
}

// Helper function to get admin's product IDs
async function getAdminProductIds(adminId) {
  try {
    const adminProducts = await Product.find({ createdBy: adminId }).select('_id');
    return adminProducts.map(p => p._id);
  } catch (error) {
    console.error('❌ Error getting admin product IDs:', error);
    return [];
  }
}

// Helper function to calculate shipping fee
function calculateShippingFee(items, location) {
  const baseFee = 5000;
  const perItemFee = 1000;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  let locationFee = 0;
  const remoteAreas = ['entebbe', 'mukono', 'wakiso'];
  const isRemote = remoteAreas.some(area => 
    location.toLowerCase().includes(area)
  );
  
  if (isRemote) locationFee = 3000;
  
  return baseFee + (perItemFee * totalItems) + locationFee;
}

// Helper function to calculate tax
function calculateTaxAmount(subtotal) {
  const taxRate = 0.18;
  return subtotal * taxRate;
}

// ==================== MAIN CONTROLLER FUNCTIONS ====================

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const { items, paymentMethod, customerInfo, notes, shippingAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Order items are required'
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone || !customerInfo.location) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, and location are required'
      });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of items) {
      let productId;
      if (typeof cartItem.product === 'string') {
        productId = cartItem.product;
      } else if (cartItem.product && cartItem.product._id) {
        productId = cartItem.product._id;
      } else if (cartItem.product && cartItem.product.id) {
        productId = cartItem.product.id;
      } else {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid product data in cart items'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: `Invalid product ID format: ${productId}`
        });
      }

      const product = await Product.findById(productId).session(session);
      
      if (!product) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(404).json({
          success: false,
          message: `Product not found with ID: ${productId}`
        });
      }

      if (!product.isActive) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available`
        });
      }

      if (product.stock < cartItem.quantity) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${cartItem.quantity}`
        });
      }

      const unitPrice = product.sellingPrice || product.price || 0;
      const totalPrice = cartItem.quantity * unitPrice;

      orderItems.push({
        product: product._id,
        productName: product.name,
        productBrand: product.brand,
        quantity: cartItem.quantity,
        unitPrice,
        totalPrice,
        images: product.images || []
      });

      subtotal += totalPrice;

      const previousStock = product.stock;
      const newStock = previousStock - cartItem.quantity;
      
      product.stock = newStock;
      product.totalSold += cartItem.quantity;
      
      product.stockHistory.push({
        previousStock,
        newStock,
        unitsChanged: -cartItem.quantity,
        type: 'sale',
        reference: null,
        referenceModel: 'Order',
        user: req.user.id,
        notes: `Order: ${cartItem.quantity} units sold`
      });

      await product.save({ session });
    }

    const shippingFee = calculateShippingFee(orderItems, customerInfo.location);
    const taxAmount = calculateTaxAmount(subtotal);
    const totalAmount = subtotal + shippingFee + taxAmount;
    const orderNumber = await generateOrderNumber();
    
    const order = new Order({
      orderNumber,
      customer: {
        user: req.user.id,
        name: customerInfo.name,
        email: customerInfo.email || req.user.email,
        phone: customerInfo.phone,
        location: customerInfo.location
      },
      items: orderItems,
      subtotal,
      shippingFee,
      taxAmount,
      totalAmount,
      paymentMethod: paymentMethod || 'onDelivery',
      notes: notes || '',
      shippingAddress: shippingAddress || {
        street: customerInfo.location,
        city: 'Kampala',
        country: 'Uganda'
      },
      createdBy: req.user.id
    });

    await order.save({ session });

    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product && product.stockHistory.length > 0) {
        const stockEntry = product.stockHistory[product.stockHistory.length - 1];
        stockEntry.reference = order._id;
        await product.save({ session });
      }
    }

    await createOrderNotification(order, 'new_order');

    await session.commitTransaction();
    await session.endSession();

    const populatedOrder = await Order.findById(order._id)
      .populate('customer.user', 'name email')
      .populate('items.product', 'name images');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: populatedOrder._id,
        orderNumber: populatedOrder.orderNumber,
        customer: populatedOrder.customer,
        items: populatedOrder.items,
        subtotal: populatedOrder.subtotal,
        shippingFee: populatedOrder.shippingFee,
        taxAmount: populatedOrder.taxAmount,
        totalAmount: populatedOrder.totalAmount,
        paymentMethod: populatedOrder.paymentMethod,
        orderStatus: populatedOrder.orderStatus,
        paymentStatus: populatedOrder.paymentStatus,
        createdAt: populatedOrder.createdAt
      },
      createdBy: req.user.name
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      error: error.message
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { 'customer.user': req.user.id };
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product', 'name images category')
      .lean();
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      orders,
      filterInfo: {
        isFiltered: true,
        userId: req.user.id,
        viewType: 'personal'
      }
    });
    
  } catch (error) {
    console.error('❌ Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders',
      error: error.message
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer.user', 'name email phone')
      .populate({
        path: 'items.product',
        select: 'name images category description createdBy',
        populate: {
          path: 'createdBy',
          select: 'name email'
        }
      })
      .populate('processedBy', 'name email')
      .populate('deliveredBy', 'name email')
      .populate('confirmedBy', 'name email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    let hasAccess = false;
    let filteredOrder = { ...order.toObject() };
    
    const isOwner = order.customer.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin) {
      hasAccess = isOwner;
    } else {
      const ownsProductsInOrder = order.items.some(item => 
        item.product && 
        item.product.createdBy && 
        item.product.createdBy._id.toString() === req.user.id
      );
      
      const isProcessor = order.processedBy && order.processedBy._id.toString() === req.user.id;
      const isDeliverer = order.deliveredBy && order.deliveredBy._id.toString() === req.user.id;
      
      hasAccess = ownsProductsInOrder || isProcessor || isDeliverer || isOwner;
      
      if (ownsProductsInOrder && !isOwner) {
        filteredOrder.items = order.items.filter(item => 
          item.product && 
          item.product.createdBy && 
          item.product.createdBy._id.toString() === req.user.id
        );
        
        filteredOrder.subtotal = filteredOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
        filteredOrder.totalAmount = filteredOrder.subtotal + 
                                   (filteredOrder.shippingFee || 0) + 
                                   (filteredOrder.taxAmount || 0) - 
                                   (filteredOrder.discountAmount || 0);
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    res.json({
      success: true,
      order: filteredOrder,
      permissionInfo: {
        isOwner,
        isAdmin,
        ownsProductsInOrder: isAdmin && filteredOrder.items.length > 0,
        canCancel: isOwner && order.orderStatus === 'pending',
        canConfirm: isOwner && order.orderStatus === 'delivered',
        canProcess: isAdmin && order.orderStatus === 'pending',
        canDeliver: isAdmin && order.orderStatus === 'processing',
        canReject: isAdmin && order.orderStatus === 'pending'
      }
    });
    
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order',
      error: error.message
    });
  }
};

// @desc    Get all orders with filters - SYSTEM VIEW (Admin sees all orders)
// @route   GET /api/orders
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, view = 'system' } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .populate('customer.user', 'name email')
      .populate({
        path: 'items.product',
        select: 'name images category createdBy',
        populate: {
          path: 'createdBy',
          select: 'name'
        }
      })
      .populate('processedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      orders,
      filterInfo: {
        isFiltered: false,
        userId: null,
        viewType: 'system'
      }
    });
    
  } catch (error) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders',
      error: error.message
    });
  }
};

// @desc    Get admin's personal orders (processed by them)
// @route   GET /api/orders/admin/my-processed
// @access  Private/Admin
exports.getAdminProcessedOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    
    let query = { processedBy: req.user.id };
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .populate('customer.user', 'name email')
      .populate({
        path: 'items.product',
        select: 'name images category createdBy',
        populate: {
          path: 'createdBy',
          select: 'name'
        }
      })
      .populate('processedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      orders,
      filterInfo: {
        isFiltered: true,
        userId: req.user.id,
        viewType: 'processed'
      }
    });
    
  } catch (error) {
    console.error('❌ Get admin processed orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin processed orders',
      error: error.message
    });
  }
};

// @desc    Get admin's product-specific orders (orders containing their products)
// @route   GET /api/orders/admin/my-products
// @access  Private/Admin
exports.getAdminProductOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    
    const adminProductIds = await getAdminProductIds(req.user.id);
    
    if (adminProductIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        },
        orders: [],
        filterInfo: {
          isFiltered: true,
          userId: req.user.id,
          viewType: 'product-ownership',
          productCount: 0
        }
      });
    }
    
    let query = { 'items.product': { $in: adminProductIds } };
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .populate('customer.user', 'name email')
      .populate({
        path: 'items.product',
        select: 'name images category createdBy',
        populate: {
          path: 'createdBy',
          select: 'name'
        }
      })
      .populate('processedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Filter items within each order to only show admin's products
    const filteredOrders = orders.map(order => {
      const ownedItems = order.items.filter(item => {
        if (!item.product || !item.product._id) return false;
        return adminProductIds.some(productId => 
          productId.toString() === item.product._id.toString()
        );
      });
      
      if (ownedItems.length === 0) return null;
      
      const subtotal = ownedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalAmount = subtotal + (order.shippingFee || 0) + (order.taxAmount || 0) - (order.discountAmount || 0);
      
      return {
        ...order,
        items: ownedItems,
        subtotal,
        totalAmount
      };
    }).filter(order => order !== null);
    
    const total = filteredOrders.length;
    
    res.json({
      success: true,
      count: filteredOrders.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      orders: filteredOrders,
      filterInfo: {
        isFiltered: true,
        userId: req.user.id,
        viewType: 'product-ownership',
        productCount: adminProductIds.length
      }
    });
    
  } catch (error) {
    console.error('❌ Get admin product orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin product orders',
      error: error.message
    });
  }
};

// @desc    Get order statistics - FIXED VERSION
// @route   GET /api/orders/stats
// @access  Private/Admin
exports.getOrderStats = async (req, res) => {
  try {
    const { period = 'month', view = 'system' } = req.query;
    
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      console.log('❌ User not authenticated in getOrderStats');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user ID consistently
    const userId = req.user.id || req.user._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    console.log(`📊 Generating stats for user: ${userId}, view: ${view}, period: ${period}`);

    // Calculate start date based on period
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

    // Initialize stats with zero values
    let stats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      processingOrders: 0,
      deliveredOrders: 0,
      confirmedOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0
    };

    // Handle different view modes
    try {
      if (view === 'my-processed') {
        console.log('🔍 Fetching stats for my-processed view');
        
        // Build query for orders processed by this admin
        const query = {
          createdAt: { $gte: startDate },
          processedBy: userId
        };
        
        console.log('📋 Query:', JSON.stringify(query));
        
        // Get stats using aggregation
        const aggregation = await Order.aggregate([
          {
            $match: query
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] }
              },
              processingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] }
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
              },
              confirmedOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] }
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] }
              }
            }
          }
        ]);

        if (aggregation.length > 0) {
          stats = aggregation[0];
          // Calculate average order value
          stats.averageOrderValue = stats.totalOrders > 0 ? 
            stats.totalRevenue / stats.totalOrders : 0;
        }
        
        console.log(`✅ my-processed stats: ${JSON.stringify(stats)}`);
      } 
      else if (view === 'my-products') {
        console.log('🔍 Fetching stats for my-products view');
        
        // Get admin's product IDs
        const adminProducts = await Product.find({ createdBy: userId }).select('_id');
        const adminProductIds = adminProducts.map(p => p._id);
        
        console.log(`📦 Admin has ${adminProductIds.length} products`);
        
        if (adminProductIds.length === 0) {
          // Return zero stats if admin has no products
          return res.json({
            success: true,
            period,
            view,
            stats,
            filterInfo: {
              isFiltered: true,
              userId: userId,
              viewType: 'product-ownership',
              productCount: 0
            }
          });
        }

        // Get all orders in the period
        const orders = await Order.find({
          createdAt: { $gte: startDate }
        }).lean();
        
        console.log(`📊 Found ${orders.length} total orders in period`);
        
        // Filter orders that contain admin's products
        const filteredOrders = orders.filter(order => {
          return order.items.some(item => {
            return adminProductIds.some(productId => 
              productId.toString() === item.product.toString()
            );
          });
        });

        console.log(`📊 Found ${filteredOrders.length} orders with admin's products`);

        // Calculate stats manually
        stats.totalOrders = filteredOrders.length;
        stats.totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        stats.pendingOrders = filteredOrders.filter(o => o.orderStatus === 'pending').length;
        stats.processingOrders = filteredOrders.filter(o => o.orderStatus === 'processing').length;
        stats.deliveredOrders = filteredOrders.filter(o => o.orderStatus === 'delivered').length;
        stats.confirmedOrders = filteredOrders.filter(o => o.orderStatus === 'confirmed').length;
        stats.cancelledOrders = filteredOrders.filter(o => o.orderStatus === 'cancelled').length;
        stats.averageOrderValue = filteredOrders.length > 0 ? 
          stats.totalRevenue / filteredOrders.length : 0;
          
        console.log(`✅ my-products stats: ${JSON.stringify(stats)}`);
      }
      else if (view === 'my') {
        console.log('🔍 Fetching stats for my (personal) view');
        
        // Build query for user's own orders
        const query = {
          createdAt: { $gte: startDate },
          'customer.user': userId
        };
        
        // Get orders using aggregation
        const aggregation = await Order.aggregate([
          {
            $match: query
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] }
              },
              processingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] }
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
              },
              confirmedOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] }
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] }
              }
            }
          }
        ]);

        if (aggregation.length > 0) {
          stats = aggregation[0];
          stats.averageOrderValue = stats.totalOrders > 0 ? 
            stats.totalRevenue / stats.totalOrders : 0;
        }
      }
      else {
        console.log('🔍 Fetching stats for system view');
        
        // System view - all orders
        const query = {
          createdAt: { $gte: startDate }
        };
        
        // Get orders using aggregation
        const aggregation = await Order.aggregate([
          {
            $match: query
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] }
              },
              processingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] }
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
              },
              confirmedOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] }
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] }
              }
            }
          }
        ]);

        if (aggregation.length > 0) {
          stats = aggregation[0];
          stats.averageOrderValue = stats.totalOrders > 0 ? 
            stats.totalRevenue / stats.totalOrders : 0;
        }
      }
    } catch (statsError) {
      console.error('❌ Error in stats calculation:', statsError);
      // Continue with zero stats - don't crash the entire request
    }

    // Ensure all values are numbers
    stats.totalOrders = Number(stats.totalOrders) || 0;
    stats.totalRevenue = Number(stats.totalRevenue) || 0;
    stats.pendingOrders = Number(stats.pendingOrders) || 0;
    stats.processingOrders = Number(stats.processingOrders) || 0;
    stats.deliveredOrders = Number(stats.deliveredOrders) || 0;
    stats.confirmedOrders = Number(stats.confirmedOrders) || 0;
    stats.cancelledOrders = Number(stats.cancelledOrders) || 0;
    stats.averageOrderValue = Number(stats.averageOrderValue) || 0;

    console.log(`✅ Final stats:`, stats);

    res.json({
      success: true,
      period,
      view,
      stats,
      filterInfo: {
        isFiltered: view !== 'system',
        userId: userId,
        viewType: view
      }
    });

  } catch (error) {
    console.error('❌ Get order stats error:', error);
    
    // Return safe zero stats on any error
    const zeroStats = {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      processingOrders: 0,
      deliveredOrders: 0,
      confirmedOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0
    };

    res.status(500).json({
      success: false,
      message: 'Server error while fetching order statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stats: zeroStats
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/orders/dashboard/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    // Build queries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayQuery = {
      createdAt: { $gte: todayStart, $lte: todayEnd }
    };

    const todayStats = await Order.aggregate([
      {
        $match: todayQuery
      },
      {
        $group: {
          _id: null,
          todayOrders: { $sum: 1 },
          todayRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const weekQuery = {
      createdAt: { $gte: weekStart }
    };

    const weekStats = await Order.aggregate([
      {
        $match: weekQuery
      },
      {
        $group: {
          _id: null,
          weekOrders: { $sum: 1 },
          weekRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const overallStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] }
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'shipped'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = {
      today: todayStats[0] || { todayOrders: 0, todayRevenue: 0 },
      week: weekStats[0] || { weekOrders: 0, weekRevenue: 0 },
      overall: overallStats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
      }
    };

    res.json({
      success: true,
      stats: result,
      filterInfo: {
        isFiltered: false,
        viewType: 'system'
      }
    });

  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { orderStatus, note } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(orderStatus)) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (req.user.role === 'admin') {
      const adminProductIds = await getAdminProductIds(req.user.id);
      const orderProductIds = order.items.map(item => item.product.toString());
      const ownsProducts = orderProductIds.some(productId => 
        adminProductIds.some(adminProductId => adminProductId.toString() === productId)
      );
      
      if (!ownsProducts && order.processedBy?.toString() !== req.user.id) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this order'
        });
      }
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    
    order.statusHistory.push({
      status: orderStatus,
      note: note || `Status changed from ${previousStatus} to ${orderStatus}`,
      changedBy: req.user.id
    });
    
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
      order.deliveredBy = req.user.id;
      await createOrderNotification(order, 'delivered', note);
    } else if (orderStatus === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Order cancelled by admin';
      await createOrderNotification(order, 'cancelled', order.cancellationReason);
    } else if (orderStatus === 'processing') {
      order.processedBy = req.user.id;
      await createOrderNotification(order, 'processing', note);
    }
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order,
      updatedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Update order status error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status',
      error: error.message
    });
  }
};

// @desc    Cancel order (User)
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.customer.user.toString() !== req.user.id) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }
    
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';
    
    order.statusHistory.push({
      status: 'cancelled',
      note: `Order cancelled by user. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'cancelled', order.cancellationReason);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order,
      cancelledBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Cancel order error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order',
      error: error.message
    });
  }
};

// @desc    Process order (Admin)
// @route   PUT /api/orders/:id/process
// @access  Private/Admin
exports.processOrder = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const adminProductIds = await getAdminProductIds(req.user.id);
    const orderProductIds = order.items.map(item => item.product.toString());
    const ownsProducts = orderProductIds.some(productId => 
      adminProductIds.some(adminProductId => adminProductId.toString() === productId)
    );
    
    if (!ownsProducts) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to process this order'
      });
    }
    
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be processed'
      });
    }
    
    order.orderStatus = 'processing';
    order.processedBy = req.user.id;
    
    order.statusHistory.push({
      status: 'processing',
      note: `Order processed and moved to processing`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'processing', null, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Order processed successfully',
      order,
      processedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Process order error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while processing order',
      error: error.message
    });
  }
};

// @desc    Deliver order (Admin)
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
exports.deliverOrder = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const adminProductIds = await getAdminProductIds(req.user.id);
    const orderProductIds = order.items.map(item => item.product.toString());
    const ownsProducts = orderProductIds.some(productId => 
      adminProductIds.some(adminProductId => adminProductId.toString() === productId)
    );
    
    if (!ownsProducts && order.processedBy?.toString() !== req.user.id) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to deliver this order'
      });
    }
    
    if (order.orderStatus !== 'processing') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only processing orders can be delivered'
      });
    }
    
    order.orderStatus = 'delivered';
    order.deliveredAt = new Date();
    order.deliveredBy = req.user.id;
    
    order.statusHistory.push({
      status: 'delivered',
      note: `Order delivered`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'delivered', null, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Order delivered successfully',
      order,
      deliveredBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Deliver order error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while delivering order',
      error: error.message
    });
  }
};

// @desc    Reject order (Admin)
// @route   PUT /api/orders/:id/reject
// @access  Private/Admin
exports.rejectOrder = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const adminProductIds = await getAdminProductIds(req.user.id);
    const orderProductIds = order.items.map(item => item.product.toString());
    const ownsProducts = orderProductIds.some(productId => 
      adminProductIds.some(adminProductId => adminProductId.toString() === productId)
    );
    
    if (!ownsProducts) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject this order'
      });
    }
    
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be rejected'
      });
    }
    
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Rejected by admin';
    
    order.statusHistory.push({
      status: 'cancelled',
      note: `Order rejected. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'cancelled', order.cancellationReason, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Order rejected successfully',
      order,
      rejectedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Reject order error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting order',
      error: error.message
    });
  }
};

// @desc    Confirm delivery receipt (User)
// @route   PUT /api/orders/:id/confirm-delivery
// @access  Private
exports.confirmDelivery = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { confirmationNote } = req.body;
    
    const order = await Order.findById(req.params.id).session(session);
    
    if (!order) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.customer.user.toString() !== req.user.id) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this order'
      });
    }
    
    if (order.orderStatus !== 'delivered') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be confirmed'
      });
    }
    
    order.orderStatus = 'confirmed';
    order.confirmedAt = new Date();
    order.confirmedBy = req.user.id;
    
    order.statusHistory.push({
      status: 'confirmed',
      note: `Delivery confirmed. Note: ${confirmationNote || 'No note provided'}`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'confirmed', confirmationNote, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
      order,
      confirmedBy: req.user.name
    });
    
  } catch (error) {
    console.error('❌ Confirm delivery error:', error);
    
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
      } catch (cleanupError) {
        console.error('❌ Error during session cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while confirming delivery',
      error: error.message
    });
  }
};

// @desc    Debug endpoint for testing
// @route   GET /api/orders/debug/user
// @access  Private/Admin
exports.debugUser = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
      userId: req.user ? req.user.id : null,
      userRole: req.user ? req.user.role : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
};