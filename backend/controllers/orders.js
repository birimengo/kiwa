const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Notification = require('../models/Notification');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppLog = require('../models/WhatsAppLog'); // Added for logging
const whatsappService = require('../services/whatsappService');
const mongoose = require('mongoose');

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
async function createOrderNotification(order, type = 'new_order', note = '') {
  try {
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
    
    if (adminUsers.length === 0) {
      console.log('⚠️ No admin users found for notification');
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
    
    const notificationPromises = adminUsers.map(admin => {
      return Notification.create({
        user: admin._id,
        order: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        totalAmount: order.totalAmount,
        type: type,
        message: message
      });
    });
    
    await Promise.all(notificationPromises);
    console.log(`📢 Notifications created for order ${order.orderNumber}`);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
}

// Helper function to send WhatsApp notifications - UPDATED WITH FIXES
async function sendWhatsAppOrderNotification(order, notificationType, note = '') {
  try {
    let notificationPrefKey = '';
    switch(notificationType) {
      case 'new_order':
        notificationPrefKey = 'newOrders';
        break;
      case 'processing':
      case 'delivered':
      case 'confirmed':
      case 'cancelled':
        notificationPrefKey = 'orderUpdates';
        break;
      default:
        return;
    }
    
    console.log(`📱 Preparing to send WhatsApp ${notificationType} notification for order ${order.orderNumber}`);
    
    // Get all active admin WhatsApp configurations
    const adminConfigs = await WhatsAppConfig.find({
      isActive: true,
      [`notifications.${notificationPrefKey}`]: true
    }).select('phoneNumber apiKey notifications user').lean();

    console.log(`📱 Found ${adminConfigs.length} active WhatsApp configs for ${notificationType}`);

    if (adminConfigs.length === 0) {
      console.log('📱 No active WhatsApp configurations found for admins');
      return;
    }

    // Get full order details for WhatsApp message
    const fullOrder = await Order.findById(order._id || order)
      .populate('customer.user', 'name email')
      .lean();
    
    if (!fullOrder) {
      console.error('❌ Order not found for WhatsApp notification');
      return;
    }

    // Send notification to each admin
    const promises = adminConfigs.map(async (config) => {
      if (config.phoneNumber && config.apiKey) {
        try {
          console.log(`📱 Sending WhatsApp to ${config.phoneNumber} for order ${fullOrder.orderNumber}`);
          
          const result = await whatsappService.sendOrderNotification(
            {
              phoneNumber: config.phoneNumber,
              apiKey: config.apiKey
            },
            fullOrder,
            notificationType,
            note
          );
          
          console.log(`✅ WhatsApp sent to ${config.phoneNumber}:`, result.success ? 'Success' : 'Failed');
          
          // Log the notification
          try {
            await WhatsAppLog.create({
              user: config.user || null,
              type: notificationType,
              phoneNumber: config.phoneNumber,
              orderNumber: fullOrder.orderNumber,
              orderId: fullOrder._id,
              success: result.success,
              message: result.message,
              response: result.data,
              metadata: {
                notificationType,
                orderNumber: fullOrder.orderNumber,
                customerName: fullOrder.customer?.name
              }
            });
          } catch (logError) {
            console.error('❌ Error logging WhatsApp notification:', logError.message);
          }
          
          return result;
        } catch (error) {
          console.error(`❌ Error sending WhatsApp to ${config.phoneNumber}:`, error.message);
          
          // Log the error
          try {
            await WhatsAppLog.create({
              user: config.user || null,
              type: notificationType,
              phoneNumber: config.phoneNumber,
              orderNumber: fullOrder.orderNumber,
              orderId: fullOrder._id,
              success: false,
              error: error.message,
              metadata: {
                notificationType,
                orderNumber: fullOrder.orderNumber,
                error: error.message
              }
            });
          } catch (logError) {
            console.error('❌ Error logging WhatsApp error:', logError.message);
          }
          
          return { success: false, error: error.message };
        }
      } else {
        console.log(`⚠️ Skipping WhatsApp for ${config.phoneNumber || 'unknown'}: missing phone or API key`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r && r.success).length;
    
    console.log(`📱 WhatsApp notifications completed for order ${fullOrder.orderNumber}: ${successful}/${adminConfigs.length} successful`);
    
  } catch (error) {
    console.error('❌ Error in WhatsApp notification system:', error);
  }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  console.log('🛒 Starting order creation process...');
  
  const session = await mongoose.startSession();
  
  try {
    console.log('🔄 Starting database transaction...');
    await session.startTransaction();
    
    const { items, paymentMethod, customerInfo, notes, shippingAddress } = req.body;

    console.log('🛒 Creating new order with data:', { 
      itemsCount: items?.length,
      customerName: customerInfo?.name,
      paymentMethod 
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
        notes: `Order: ${cartItem.quantity} units sold`
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
      }
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
    
    // Send WhatsApp notification for new order - OUTSIDE TRANSACTION
    console.log('📱 Sending WhatsApp notifications for new order...');
    
    // Commit transaction first
    console.log('✅ Committing transaction...');
    await session.commitTransaction();
    await session.endSession();
    
    console.log('✅ Order created successfully:', orderNumber);
    
    // Send WhatsApp notification after transaction is committed
    // This prevents WhatsApp from blocking the order creation if it fails
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'new_order');
      } catch (whatsappError) {
        console.error('❌ WhatsApp notification failed (non-blocking):', whatsappError.message);
        // Don't throw error, just log it
      }
    }, 1000);

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
      }
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
    
    console.log(`📋 Fetched ${orders.length} orders for user ${req.user.id}`);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      orders
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
      .populate('items.product', 'name images category description');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user owns the order or is admin
    if (order.customer.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    console.log(`📦 Fetched order ${order.orderNumber} for user ${req.user.id}`);
    
    res.json({
      success: true,
      order
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
      note: note || `Status changed from ${previousStatus} to ${orderStatus}`,
      changedBy: req.user.id
    });
    
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
      order.deliveredBy = req.user.id;
      // Create notification for delivered order
      await createOrderNotification(order, 'delivered', note);
      // Send WhatsApp notification - outside transaction
      setTimeout(async () => {
        try {
          await sendWhatsAppOrderNotification(order, 'delivered', note);
        } catch (error) {
          console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
        }
      }, 1000);
    } else if (orderStatus === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Order cancelled by admin';
      // Create notification for cancelled order
      await createOrderNotification(order, 'cancelled', order.cancellationReason);
      // Send WhatsApp notification - outside transaction
      setTimeout(async () => {
        try {
          await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
        } catch (error) {
          console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
        }
      }, 1000);
      // Restore product stock if order is cancelled
      await restoreOrderStock(order, req.user.id, session);
    } else if (orderStatus === 'processing') {
      // Create notification for processing order
      await createOrderNotification(order, 'processing', note);
      // Send WhatsApp notification - outside transaction
      setTimeout(async () => {
        try {
          await sendWhatsAppOrderNotification(order, 'processing', note);
        } catch (error) {
          console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
        }
      }, 1000);
    } else if (orderStatus === 'confirmed') {
      // Send WhatsApp notification for confirmed order - outside transaction
      setTimeout(async () => {
        try {
          await sendWhatsAppOrderNotification(order, 'confirmed', note);
        } catch (error) {
          console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
        }
      }, 1000);
    }
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🔄 Order ${order.orderNumber} status updated: ${previousStatus} -> ${orderStatus}`);
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
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
      note: `Order cancelled by user. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    // Create notification for cancelled order
    await createOrderNotification(order, 'cancelled', order.cancellationReason);
    
    // Restore product stock
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`❌ Order ${order.orderNumber} cancelled by user ${req.user.id}`);
    
    // Send WhatsApp notification - outside transaction
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
      } catch (error) {
        console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
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
      note: `Order processed by admin and moved to processing`,
      changedBy: req.user.id
    });
    
    // Create notification for processing order
    await createOrderNotification(order, 'processing');
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🔄 Order ${order.orderNumber} processed by admin ${req.user.id}`);
    
    // Send WhatsApp notification - outside transaction
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'processing');
      } catch (error) {
        console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Order processed successfully',
      order
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
      note: `Order delivered by admin`,
      changedBy: req.user.id
    });
    
    // Create notification for delivered order
    await createOrderNotification(order, 'delivered');
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`🚚 Order ${order.orderNumber} delivered by admin ${req.user.id}`);
    
    // Send WhatsApp notification - outside transaction
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'delivered');
      } catch (error) {
        console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Order delivered successfully',
      order
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
      note: `Order rejected by admin. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    // Create notification for rejected order
    await createOrderNotification(order, 'cancelled', order.cancellationReason);
    
    // Restore product stock
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`❌ Order ${order.orderNumber} rejected by admin ${req.user.id}`);
    
    // Send WhatsApp notification - outside transaction
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
      } catch (error) {
        console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Order rejected successfully',
      order
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
      note: `Delivery confirmed by customer. Note: ${confirmationNote || 'No note provided'}`,
      changedBy: req.user.id
    });
    
    // Create notification for confirmed order
    await createOrderNotification(order, 'confirmed', confirmationNote);
    
    // Create sale record when order is confirmed
    const sale = await createSaleFromOrder(order, req.user.id, session);
    order.saleReference = sale._id;
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
    console.log(`✅ Order ${order.orderNumber} delivery confirmed by user ${req.user.id}`);
    
    // Send WhatsApp notification - outside transaction
    setTimeout(async () => {
      try {
        await sendWhatsAppOrderNotification(order, 'confirmed', confirmationNote);
      } catch (error) {
        console.error('❌ WhatsApp notification failed (non-blocking):', error.message);
      }
    }, 1000);
    
    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
      order
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
    
    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
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
      stats: result
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
      orders
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
    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }
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
    
    const weekStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart }
        }
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
      stats: result
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

// @desc    Debug WhatsApp notifications
// @route   GET /api/orders/whatsapp/debug
// @access  Private/Admin
exports.debugWhatsApp = async (req, res) => {
  try {
    // Get all active WhatsApp configs
    const activeConfigs = await WhatsAppConfig.find({ isActive: true })
      .select('phoneNumber isActive notifications user lastTestAt lastTestStatus')
      .populate('user', 'name email role')
      .lean();
    
    // Get recent orders
    const recentOrder = await Order.findOne().sort({ createdAt: -1 });
    
    // Get WhatsApp logs
    const logs = await WhatsAppLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    res.json({
      success: true,
      debug: {
        timestamp: new Date(),
        activeWhatsAppConfigs: activeConfigs.length,
        configs: activeConfigs.map(c => ({
          phoneNumber: c.phoneNumber ? `${c.phoneNumber.substring(0, 4)}...${c.phoneNumber.substring(-4)}` : 'Not set',
          isActive: c.isActive,
          lastTestStatus: c.lastTestStatus,
          lastTestAt: c.lastTestAt,
          user: c.user ? `${c.user.name} (${c.user.email})` : 'Unknown',
          notifications: c.notifications
        })),
        lastOrder: recentOrder ? {
          orderNumber: recentOrder.orderNumber,
          customer: recentOrder.customer?.name,
          totalAmount: recentOrder.totalAmount,
          createdAt: recentOrder.createdAt,
          orderStatus: recentOrder.orderStatus
        } : null,
        recentLogs: logs.map(log => ({
          type: log.type,
          orderNumber: log.orderNumber,
          phoneNumber: log.phoneNumber ? `${log.phoneNumber.substring(0, 4)}...${log.phoneNumber.substring(-4)}` : 'N/A',
          success: log.success,
          error: log.error,
          createdAt: log.createdAt
        })),
        serverInfo: {
          nodeVersion: process.version,
          environment: process.env.NODE_ENV,
          whatsappService: 'loaded'
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug WhatsApp error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};