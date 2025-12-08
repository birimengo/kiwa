const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// Helper function to add user filter to query
const addUserFilterToQuery = (req, query, fieldName = 'customer.user') => {
  // If processedBy or other user field is in query (added by filterByUser middleware), use it
  if (req.query[fieldName]) {
    query[fieldName] = req.query[fieldName];
    console.log(`🔍 [Orders] Filtering by ${fieldName} from query: ${req.query[fieldName]}`);
  } 
  // For admin-specific personal endpoints OR when view=my is specified
  else if (req.user && req.user._id) {
    // Check if this is an admin personal view for processed orders
    const isAdminPersonalView = (
      req.path.includes('/admin/') || 
      req.query.view === 'my' || 
      req.query.processedBy === 'me'
    );
    
    if (isAdminPersonalView && fieldName === 'processedBy') {
      // Admin personal view for processed orders
      query[fieldName] = req.user._id;
      console.log(`🔍 [Orders] Filtering by ${fieldName} from user: ${req.user._id} (admin personal view)`);
    } else if (req.user.role !== 'admin' && fieldName === 'customer.user') {
      // Regular users always filter by their customer user ID
      query[fieldName] = req.user._id;
      console.log(`🔍 [Orders] Filtering by ${fieldName} from user: ${req.user._id} (regular user)`);
    } else {
      console.log(`🔍 [Orders] [ADMIN SYSTEM VIEW] No user filter applied for ${fieldName}`);
    }
  }
  return query;
};

// Helper function to get user filter based on context
const getUserFilterForContext = (req, context = 'customer-orders') => {
  const fieldMap = {
    'customer-orders': 'customer.user',
    'processed-orders': 'processedBy',
    'delivered-orders': 'deliveredBy',
    'confirmed-orders': 'confirmedBy',
    'order-stats': 'processedBy'
  };
  
  const fieldName = fieldMap[context];
  const filter = {};
  
  if (req.query[fieldName]) {
    filter[fieldName] = req.query[fieldName];
  } else if (req.user && req.user._id) {
    // For regular users, always filter by their customer ID
    if (req.user.role !== 'admin' && context === 'customer-orders') {
      filter[fieldName] = req.user._id;
    }
    // For admin personal view or specific contexts
    else if (req.path.includes('/admin/') || req.query.view === 'my') {
      filter[fieldName] = req.user._id;
    }
  }
  
  return filter;
};

// Generate order number
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

// Helper function to create notification for admins
async function createOrderNotification(order, type = 'new_order', note = '', targetUserId = null) {
  try {
    const User = require('../models/User');
    let usersToNotify = [];
    
    if (targetUserId) {
      // Notify specific user
      usersToNotify.push({ _id: targetUserId });
    } else {
      // Default: notify all admins for new orders
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      usersToNotify = adminUsers;
    }
    
    if (usersToNotify.length === 0) {
      console.log('⚠️ No users to notify');
      return;
    }
    
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
    
    if (note) {
      message += `: ${note}`;
    }
    
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
    console.log(`📢 Notifications created for order ${order.orderNumber} to ${usersToNotify.length} user(s)`);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  console.log('🛒 Starting order creation process...');
  console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
  
  const session = await mongoose.startSession();
  
  try {
    console.log('🔄 Starting database transaction...');
    await session.startTransaction();
    
    const { items, paymentMethod, customerInfo, notes, shippingAddress } = req.body;

    console.log('🛒 Creating new order with data:', { 
      itemsCount: items?.length,
      customerName: customerInfo?.name,
      paymentMethod,
      userId: req.user.id
    });

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('❌ No items in order');
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Order items are required'
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone || !customerInfo.location) {
      console.error('❌ Missing customer information');
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, and location are required'
      });
    }

    // Process order items and validate stock
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of items) {
      console.log('📦 Processing cart item:', cartItem);
      
      // Extract product ID - handle both object and string formats
      let productId;
      if (typeof cartItem.product === 'string') {
        productId = cartItem.product;
      } else if (cartItem.product && cartItem.product._id) {
        productId = cartItem.product._id;
      } else if (cartItem.product && cartItem.product.id) {
        productId = cartItem.product.id;
      } else {
        console.error('❌ Invalid product ID structure:', cartItem);
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid product data in cart items'
        });
      }

      // Validate product ID format
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        console.error('❌ Invalid product ID format:', productId);
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: `Invalid product ID format: ${productId}`
        });
      }

      console.log('🔍 Looking for product with ID:', productId);

      // Find product with session
      const product = await Product.findById(productId).session(session);
      
      if (!product) {
        console.error('❌ Product not found with ID:', productId);
        await session.abortTransaction();
        await session.endSession();
        return res.status(404).json({
          success: false,
          message: `Product not found with ID: ${productId}`
        });
      }

      console.log('✅ Found product:', product.name);

      if (!product.isActive) {
        console.error('❌ Product not active:', product.name);
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available`
        });
      }

      if (product.stock < cartItem.quantity) {
        console.error(`❌ Insufficient stock for ${product.name}: ${product.stock} < ${cartItem.quantity}`);
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

      // Update product stock
      const previousStock = product.stock;
      const newStock = previousStock - cartItem.quantity;
      
      console.log(`📊 Updating stock for ${product.name}: ${previousStock} -> ${newStock}`);
      
      product.stock = newStock;
      product.totalSold += cartItem.quantity;
      
      // Add to stock history
      product.stockHistory.push({
        previousStock,
        newStock,
        unitsChanged: -cartItem.quantity,
        type: 'sale',
        reference: null,
        referenceModel: 'Order',
        user: req.user.id,
        notes: `Order: ${cartItem.quantity} units sold by user ${req.user.name}`
      });

      await product.save({ session });
    }

    // Calculate shipping fee and tax
    const shippingFee = calculateShippingFee(orderItems, customerInfo.location);
    const taxAmount = calculateTaxAmount(subtotal);
    const totalAmount = subtotal + shippingFee + taxAmount;

    console.log('💰 Order totals:', { subtotal, shippingFee, taxAmount, totalAmount });

    // Generate order number
    const orderNumber = await generateOrderNumber();
    
    console.log('📝 Creating order document...');
    
    // Create order
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

    // Update stock history with order reference
    console.log('🔄 Updating stock history with order references...');
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product && product.stockHistory.length > 0) {
        const stockEntry = product.stockHistory[product.stockHistory.length - 1];
        stockEntry.reference = order._id;
        await product.save({ session });
      }
    }

    // Create notification for admin users
    await createOrderNotification(order, 'new_order');

    console.log('✅ Committing transaction...');
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`✅ Order created successfully: ${orderNumber} by user ${req.user.name}`);

    // Populate order data for response
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
    
    // Handle transaction cleanup
    if (session) {
      try {
        if (session.inTransaction()) {
          console.log('🔄 Aborting transaction due to error...');
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
    
    console.log('📋 Fetching user orders...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Regular users can only see their own orders
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
    
    console.log(`📋 Fetched ${orders.length} orders for user ${req.user.name}`);
    
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
        userId: req.user._id,
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
    console.log('📦 Fetching single order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    const order = await Order.findById(req.params.id)
      .populate('customer.user', 'name email phone')
      .populate('items.product', 'name images category description')
      .populate('processedBy', 'name email')
      .populate('deliveredBy', 'name email')
      .populate('confirmedBy', 'name email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user owns the order or is admin
    const isOwner = order.customer.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isProcessor = order.processedBy && order.processedBy._id.toString() === req.user.id;
    const isDeliverer = order.deliveredBy && order.deliveredBy._id.toString() === req.user.id;
    
    if (!isOwner && !isAdmin && !isProcessor && !isDeliverer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    console.log(`📦 Fetched order ${order.orderNumber}`);
    
    res.json({
      success: true,
      order,
      permissionInfo: {
        isOwner,
        isAdmin,
        isProcessor,
        isDeliverer,
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

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    console.log('🔄 Updating order status:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    const previousStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    
    // Add to status history
    order.statusHistory.push({
      status: orderStatus,
      note: note || `Status changed from ${previousStatus} to ${orderStatus} by ${req.user.name}`,
      changedBy: req.user.id
    });
    
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
      order.deliveredBy = req.user.id;
      // Create notification for delivered order
      await createOrderNotification(order, 'delivered', note);
    } else if (orderStatus === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Order cancelled by admin';
      // Create notification for cancelled order
      await createOrderNotification(order, 'cancelled', order.cancellationReason);
      // Restore product stock if order is cancelled
      await restoreOrderStock(order, req.user.id, session);
    } else if (orderStatus === 'processing') {
      order.processedBy = req.user.id;
      // Create notification for processing order
      await createOrderNotification(order, 'processing', note);
    }
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🔄 Order ${order.orderNumber} status updated: ${previousStatus} -> ${orderStatus} by ${req.user.name}`);
    
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
    console.log('❌ Cancelling order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    // Check if user owns the order
    if (order.customer.user.toString() !== req.user.id) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    // Only allow cancellation for pending orders
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';
    
    // Add to status history
    order.statusHistory.push({
      status: 'cancelled',
      note: `Order cancelled by user ${req.user.name}. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    // Create notification for cancelled order
    await createOrderNotification(order, 'cancelled', order.cancellationReason);
    
    // Restore product stock
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`❌ Order ${order.orderNumber} cancelled by user ${req.user.name}`);
    
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
    console.log('🔄 Processing order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be processed'
      });
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = 'processing';
    order.processedBy = req.user.id;
    
    // Add to status history
    order.statusHistory.push({
      status: 'processing',
      note: `Order processed by admin ${req.user.name} and moved to processing`,
      changedBy: req.user.id
    });
    
    // Create notification for processing order
    await createOrderNotification(order, 'processing', null, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🔄 Order ${order.orderNumber} processed by admin ${req.user.name}`);
    
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
    console.log('🚚 Delivering order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    if (order.orderStatus !== 'processing') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only processing orders can be delivered'
      });
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = 'delivered';
    order.deliveredAt = new Date();
    order.deliveredBy = req.user.id;
    
    // Add to status history
    order.statusHistory.push({
      status: 'delivered',
      note: `Order delivered by admin ${req.user.name}`,
      changedBy: req.user.id
    });
    
    // Create notification for delivered order
    await createOrderNotification(order, 'delivered', null, req.user.id);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🚚 Order ${order.orderNumber} delivered by admin ${req.user.name}`);
    
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
    console.log('❌ Rejecting order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    if (order.orderStatus !== 'pending') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be rejected'
      });
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Rejected by admin';
    
    // Add to status history
    order.statusHistory.push({
      status: 'cancelled',
      note: `Order rejected by admin ${req.user.name}. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    // Create notification for rejected order
    await createOrderNotification(order, 'cancelled', order.cancellationReason, req.user.id);
    
    // Restore product stock
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`❌ Order ${order.orderNumber} rejected by admin ${req.user.name}`);
    
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
    console.log('✅ Confirming delivery for order:', req.params.id);
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    // Check if user owns the order
    if (order.customer.user.toString() !== req.user.id) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this order'
      });
    }
    
    // Only allow confirmation for delivered orders
    if (order.orderStatus !== 'delivered') {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be confirmed'
      });
    }
    
    const previousStatus = order.orderStatus;
    order.orderStatus = 'confirmed';
    order.confirmedAt = new Date();
    order.confirmedBy = req.user.id;
    
    // Add to status history
    order.statusHistory.push({
      status: 'confirmed',
      note: `Delivery confirmed by customer ${req.user.name}. Note: ${confirmationNote || 'No note provided'}`,
      changedBy: req.user.id
    });
    
    // Create notification for confirmed order
    await createOrderNotification(order, 'confirmed', confirmationNote, req.user.id);
    
    // Create sale record when order is confirmed
    const sale = await createSaleFromOrder(order, req.user.id, session);
    order.saleReference = sale._id;
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`✅ Order ${order.orderNumber} delivery confirmed by user ${req.user.name}`);
    
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

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private/Admin
exports.getOrderStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    console.log('📊 Fetching order statistics...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
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
    
    // Build query with proper user filtering for admin personal view
    let query = {
      createdAt: { $gte: startDate }
    };
    
    // Add user filter for processed orders if in admin personal view
    const userFilter = getUserFilterForContext(req, 'order-stats');
    if (userFilter.processedBy) {
      query.processedBy = userFilter.processedBy;
    }
    
    console.log(`🔍 Order Stats Query:`, { 
      period,
      processedBy: query.processedBy ? 'Filtered by processor' : 'No filter (admin system view)'
    });
    
    const stats = await Order.aggregate([
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
          },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      processingOrders: 0,
      deliveredOrders: 0,
      confirmedOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0
    };
    
    res.json({
      success: true,
      period,
      stats: result,
      filterInfo: {
        isFiltered: !!query.processedBy,
        userId: query.processedBy || null,
        viewType: query.processedBy ? 'personal' : 'system'
      }
    });
    
  } catch (error) {
    console.error('❌ Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order statistics',
      error: error.message
    });
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    
    console.log('📋 Fetching all orders...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    let query = {};
    
    // Status filter
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // For admin personal view, filter by processed orders
    const isAdminPersonalView = req.path.includes('/admin/') || req.query.view === 'my';
    if (isAdminPersonalView && req.user.role === 'admin') {
      query.processedBy = req.user._id;
      console.log(`🔍 Filtering orders processed by admin: ${req.user.name}`);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .populate('customer.user', 'name email')
      .populate('items.product', 'name images')
      .populate('processedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Order.countDocuments(query);
    
    console.log(`📋 Admin fetched ${orders.length} orders`);
    
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
        isFiltered: !!query.processedBy,
        userId: query.processedBy || null,
        viewType: query.processedBy ? 'personal' : 'system'
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

// @desc    Get dashboard statistics
// @route   GET /api/orders/dashboard/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard statistics...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Build query with proper user filtering
    let todayQuery = {};
    let weekQuery = {};
    let overallQuery = {};
    
    // For admin personal view, filter by processed orders
    const isAdminPersonalView = req.path.includes('/admin/') || req.query.view === 'my';
    if (isAdminPersonalView && req.user.role === 'admin') {
      todayQuery.processedBy = req.user._id;
      weekQuery.processedBy = req.user._id;
      overallQuery.processedBy = req.user._id;
      console.log(`🔍 Filtering dashboard stats by processor: ${req.user.name}`);
    }
    
    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    todayQuery.createdAt = { $gte: todayStart, $lte: todayEnd };

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

    // This week's stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    weekQuery.createdAt = { $gte: weekStart };

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

    // Overall stats
    const overallStats = await Order.aggregate([
      {
        $match: overallQuery
      },
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
        isFiltered: !!todayQuery.processedBy,
        userId: todayQuery.processedBy || null,
        viewType: todayQuery.processedBy ? 'personal' : 'system'
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

// @desc    Get admin's processed orders (personal view)
// @route   GET /api/orders/admin/my-orders
// @access  Private/Admin
exports.getAdminOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    
    console.log('📋 Fetching admin personal orders...');
    console.log('👤 User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');
    
    // Always filter by current admin for personal view
    let query = { processedBy: req.user._id };
    
    // Status filter
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Order.find(query)
      .populate('customer.user', 'name email')
      .populate('items.product', 'name images')
      .populate('processedBy', 'name')
      .populate('deliveredBy', 'name')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Order.countDocuments(query);
    
    console.log(`📋 Admin fetched ${orders.length} orders processed by them`);
    
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
        userId: req.user._id,
        viewType: 'personal'
      }
    });
    
  } catch (error) {
    console.error('❌ Get admin orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin orders',
      error: error.message
    });
  }
};

// Helper function to create sale from confirmed order
async function createSaleFromOrder(order, userId, session = null) {
  console.log(`💰 Creating sale from confirmed order: ${order.orderNumber}`);
  
  try {
    // Get product costs for profit calculation
    const saleItems = await Promise.all(
      order.items.map(async (item) => {
        const product = await Product.findById(item.product);
        const unitCost = product.purchasePrice || 0;
        const totalCost = unitCost * item.quantity;
        const profit = item.totalPrice - totalCost;

        return {
          product: item.product,
          productName: item.productName,
          productBrand: item.productBrand,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost,
          totalPrice: item.totalPrice,
          totalCost,
          profit
        };
      })
    );

    const totalCost = saleItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalProfit = order.totalAmount - totalCost;

    const saleData = {
      saleNumber: await generateSaleNumber(),
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        location: order.customer.location
      },
      items: saleItems,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      taxAmount: order.taxAmount || 0,
      totalAmount: order.totalAmount,
      totalCost,
      totalProfit,
      paymentMethod: order.paymentMethod,
      paymentStatus: 'paid',
      amountPaid: order.totalAmount,
      balance: 0,
      notes: `Sale created from order: ${order.orderNumber}`,
      soldBy: userId,
      status: 'completed',
      orderReference: order._id
    };

    const sale = new Sale(saleData);
    
    if (session) {
      await sale.save({ session });
    } else {
      await sale.save();
    }
    
    console.log(`✅ Sale created: ${sale.saleNumber} from order: ${order.orderNumber}`);
    return sale;
    
  } catch (error) {
    console.error('❌ Error creating sale from order:', error);
    throw error;
  }
}

// Helper function to generate sale number
async function generateSaleNumber() {
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
}

// Helper function to restore stock when order is cancelled
async function restoreOrderStock(order, userId, session = null) {
  console.log(`🔄 Restoring stock for cancelled order ${order.orderNumber}`);
  
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      const previousStock = product.stock;
      const newStock = previousStock + item.quantity;
      
      product.stock = newStock;
      product.totalSold = Math.max(0, product.totalSold - item.quantity);
      
      product.stockHistory.push({
        previousStock,
        newStock,
        unitsChanged: item.quantity,
        type: 'restock',
        reference: order._id,
        referenceModel: 'Order',
        user: userId,
        notes: 'Order cancellation - stock restored'
      });
      
      if (session) {
        await product.save({ session });
      } else {
        await product.save();
      }
      
      console.log(`📦 Restored ${item.quantity} units of ${product.name}`);
    }
  }
}

// Helper function to calculate shipping fee
function calculateShippingFee(items, location) {
  // Basic shipping calculation
  const baseFee = 5000; // 5000 UGX base fee
  const perItemFee = 1000; // 1000 UGX per item
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Additional fee for remote locations
  let locationFee = 0;
  const remoteAreas = ['entebbe', 'mukono', 'wakiso'];
  const isRemote = remoteAreas.some(area => 
    location.toLowerCase().includes(area)
  );
  
  if (isRemote) {
    locationFee = 3000;
  }
  
  return baseFee + (perItemFee * totalItems) + locationFee;
}

// Helper function to calculate tax
function calculateTaxAmount(subtotal) {
  const taxRate = 0.18; // 18% VAT in Uganda
  return subtotal * taxRate;
}