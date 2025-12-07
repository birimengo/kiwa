const Order = require('../models/Order');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Notification = require('../models/Notification');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppLog = require('../models/WhatsAppLog');
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

// Helper function to send WhatsApp notifications - UPDATED
async function sendWhatsAppOrderNotification(order, notificationType, note = '') {
  console.log('\n📱 === WHATSAPP NOTIFICATION START ===');
  console.log(`📱 Processing ${notificationType} for order: ${order.orderNumber}`);
  
  try {
    // Map notification type to preference key
    let notificationPrefKey = '';
    switch(notificationType) {
      case 'new_order':
        notificationPrefKey = 'newOrders';
        console.log('📱 Notification type: New Order');
        break;
      case 'processing':
      case 'delivered':
      case 'confirmed':
      case 'cancelled':
        notificationPrefKey = 'orderUpdates';
        console.log('📱 Notification type: Order Update');
        break;
      default:
        console.log('❌ Unknown notification type:', notificationType);
        return [];
    }
    
    console.log(`📱 Looking for WhatsApp configs with: notifications.${notificationPrefKey} = true`);
    
    // Find ALL active WhatsApp configurations first
    const allConfigs = await WhatsAppConfig.find({
      isActive: true,
      phoneNumber: { $exists: true, $ne: '' }
    })
    .select('+apiKey')
    .populate('user', 'name email role')
    .lean();
    
    console.log(`📱 Found ${allConfigs.length} total active WhatsApp configs`);
    
    // Filter by notification preference
    const adminConfigs = allConfigs.filter(config => {
      const hasApiKey = config.apiKey && config.apiKey.trim() !== '';
      const hasNotificationPref = config.notifications && config.notifications[notificationPrefKey] === true;
      
      console.log(`📱 Config for ${config.user?.name || 'Unknown'}:`);
      console.log(`   - Phone: ${config.phoneNumber}`);
      console.log(`   - Has API Key: ${hasApiKey}`);
      console.log(`   - ${notificationPrefKey}: ${hasNotificationPref}`);
      console.log(`   - All Notifications:`, config.notifications);
      
      return hasApiKey && hasNotificationPref;
    });
    
    console.log(`📱 After filtering: ${adminConfigs.length} configs match all criteria`);
    
    if (adminConfigs.length === 0) {
      console.log('❌ No WhatsApp configurations found that match all criteria:');
      console.log('   1. isActive: true');
      console.log('   2. phoneNumber exists and not empty');
      console.log('   3. apiKey exists and not empty');
      console.log(`   4. notifications.${notificationPrefKey}: true`);
      
      // Log why configurations were filtered out
      allConfigs.forEach((config, index) => {
        const hasApiKey = config.apiKey && config.apiKey.trim() !== '';
        const hasNotificationPref = config.notifications && config.notifications[notificationPrefKey] === true;
        
        if (!hasApiKey) {
          console.log(`   Config ${index + 1} (${config.user?.name}): Missing API Key`);
        } else if (!hasNotificationPref) {
          console.log(`   Config ${index + 1} (${config.user?.name}): ${notificationPrefKey} is false`);
        }
      });
      
      return [];
    }
    
    // Send notifications
    const results = [];
    for (const config of adminConfigs) {
      try {
        console.log(`\n📱 Sending to ${config.user?.name || 'Unknown'} (${config.phoneNumber})...`);
        
        const result = await whatsappService.sendOrderNotification(
          {
            phoneNumber: config.phoneNumber,
            apiKey: config.apiKey
          },
          order,
          notificationType,
          note
        );
        
        console.log(`✅ Result for ${config.phoneNumber}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
          console.log(`   Error: ${result.message}`);
        }
        
        // Log to database
        try {
          await WhatsAppLog.create({
            user: config.user?._id,
            type: notificationType,
            phoneNumber: config.phoneNumber,
            orderNumber: order.orderNumber,
            orderId: order._id,
            message: result.message || `Order ${notificationType} notification`,
            success: result.success,
            response: result.data,
            error: result.success ? null : result.message
          });
        } catch (logError) {
          console.error('❌ Failed to save WhatsApp log:', logError.message);
        }
        
        results.push({
          user: config.user?.name || 'Unknown',
          phone: config.phoneNumber,
          success: result.success,
          message: result.message
        });
        
      } catch (error) {
        console.error(`❌ Error sending to ${config.phoneNumber}:`, error.message);
        
        // Log error to database
        try {
          await WhatsAppLog.create({
            user: config.user?._id,
            type: notificationType,
            phoneNumber: config.phoneNumber,
            orderNumber: order.orderNumber,
            orderId: order._id,
            success: false,
            error: error.message
          });
        } catch (logError) {
          console.error('❌ Failed to save error log:', logError.message);
        }
        
        results.push({
          user: config.user?.name || 'Unknown',
          phone: config.phoneNumber,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('\n📱 === WHATSAPP NOTIFICATION SUMMARY ===');
    console.log(`📱 Total attempts: ${results.length}`);
    console.log(`📱 Successful: ${results.filter(r => r.success).length}`);
    console.log(`📱 Failed: ${results.filter(r => !r.success).length}`);
    
    if (results.filter(r => !r.success).length > 0) {
      console.log('\n📱 Failed notifications:');
      results.filter(r => !r.success).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.user} (${r.phone}): ${r.error || r.message}`);
      });
    }
    
    console.log('📱 === WHATSAPP NOTIFICATION END ===\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in WhatsApp notification system:', error);
    console.error('Stack trace:', error.stack);
    
    // Log system error
    try {
      await WhatsAppLog.create({
        type: notificationType,
        orderNumber: order?.orderNumber || 'Unknown',
        orderId: order?._id,
        success: false,
        error: `System error: ${error.message}`
      });
    } catch (logError) {
      console.error('❌ Failed to log system error:', logError.message);
    }
    
    return [];
  }
}

// @desc    Test WhatsApp notification manually
// @route   POST /api/orders/test/whatsapp
// @access  Private/Admin
exports.testWhatsAppOrder = async (req, res) => {
  try {
    console.log('\n🧪 === MANUAL WHATSAPP TEST START ===');
    
    // Get current user's WhatsApp config
    const userConfig = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('+apiKey')
      .populate('user', 'name email')
      .lean();
    
    if (!userConfig) {
      console.log('❌ User has no WhatsApp configuration');
      return res.status(400).json({
        success: false,
        message: 'You have not configured WhatsApp notifications yet'
      });
    }
    
    console.log('📱 User config found:');
    console.log('   Name:', userConfig.user?.name);
    console.log('   Phone:', userConfig.phoneNumber);
    console.log('   API Key present:', !!userConfig.apiKey);
    console.log('   Is Active:', userConfig.isActive);
    console.log('   Notifications:', userConfig.notifications);
    
    // Create test order
    const testOrder = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'TEST-' + Date.now().toString().slice(-6),
      customer: {
        name: 'Test Customer',
        phone: '+256700000000',
        location: 'Kampala, Uganda',
        email: 'test@example.com'
      },
      items: [
        {
          productName: 'iPhone 13 Pro',
          productBrand: 'Apple',
          quantity: 1,
          unitPrice: 4500000,
          totalPrice: 4500000
        },
        {
          productName: 'AirPods Pro',
          productBrand: 'Apple',
          quantity: 1,
          unitPrice: 850000,
          totalPrice: 850000
        }
      ],
      subtotal: 5350000,
      shippingFee: 10000,
      taxAmount: 963000,
      totalAmount: 6413000,
      paymentMethod: 'onDelivery',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      shippingAddress: {
        street: 'Test Street 123',
        city: 'Kampala',
        country: 'Uganda'
      },
      notes: 'This is a test order to verify WhatsApp integration',
      createdAt: new Date()
    };
    
    console.log(`🧪 Test order created: ${testOrder.orderNumber}`);
    console.log('🧪 Total amount:', testOrder.totalAmount);
    
    // Send test notification
    const result = await whatsappService.sendOrderNotification(
      {
        phoneNumber: userConfig.phoneNumber,
        apiKey: userConfig.apiKey
      },
      testOrder,
      'new_order',
      'Manual test notification from admin panel'
    );
    
    // Update config with test result
    await WhatsAppConfig.findByIdAndUpdate(userConfig._id, {
      lastTestAt: new Date(),
      lastTestStatus: result.success ? 'success' : 'failed'
    });
    
    // Log the test
    await WhatsAppLog.create({
      user: req.user.id,
      type: 'test',
      phoneNumber: userConfig.phoneNumber,
      orderNumber: testOrder.orderNumber,
      success: result.success,
      message: result.message,
      response: result.data,
      error: result.success ? null : result.message
    });
    
    console.log('🧪 Test result:', result.success ? 'SUCCESS' : 'FAILED');
    if (!result.success) {
      console.log('🧪 Error:', result.message);
    }
    
    console.log('🧪 === MANUAL WHATSAPP TEST END ===\n');
    
    res.json({
      success: result.success,
      message: result.success 
        ? 'Test notification sent successfully! Check your WhatsApp.' 
        : 'Failed to send test notification',
      orderNumber: testOrder.orderNumber,
      timestamp: new Date(),
      details: result
    });
    
  } catch (error) {
    console.error('❌ Manual WhatsApp test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during WhatsApp test',
      error: error.message
    });
  }
};

// @desc    Get all WhatsApp configurations (admin only)
// @route   GET /api/orders/whatsapp/configs
// @access  Private/Admin
exports.getWhatsAppConfigs = async (req, res) => {
  try {
    const configs = await WhatsAppConfig.find({})
      .populate('user', 'name email role')
      .select('-apiKey') // Don't expose API key
      .lean();
    
    // Count active configs
    const activeConfigs = await WhatsAppConfig.countDocuments({
      isActive: true,
      phoneNumber: { $exists: true, $ne: '' },
      apiKey: { $exists: true, $ne: '' }
    });
    
    // Get recent logs
    const recentLogs = await WhatsAppLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name')
      .lean();
    
    res.json({
      success: true,
      stats: {
        total: configs.length,
        active: activeConfigs,
        inactive: configs.length - activeConfigs
      },
      configs: configs.map(c => ({
        id: c._id,
        user: {
          name: c.user?.name || 'Unknown',
          email: c.user?.email,
          role: c.user?.role
        },
        phoneNumber: c.phoneNumber,
        isActive: c.isActive,
        notifications: c.notifications,
        lastTestAt: c.lastTestAt,
        lastTestStatus: c.lastTestStatus,
        createdAt: c.createdAt
      })),
      recentLogs: recentLogs.map(l => ({
        type: l.type,
        orderNumber: l.orderNumber,
        phone: l.phoneNumber,
        success: l.success,
        message: l.error || l.message,
        timestamp: l.createdAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Get WhatsApp configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching WhatsApp configurations',
      error: error.message
    });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  console.log('\n🛒 === ORDER CREATION START ===');
  
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { items, paymentMethod, customerInfo, notes, shippingAddress } = req.body;

    console.log('📦 Order details:');
    console.log('   Items:', items?.length);
    console.log('   Customer:', customerInfo?.name);
    console.log('   Phone:', customerInfo?.phone);
    console.log('   Location:', customerInfo?.location);
    console.log('   Payment:', paymentMethod);

    // Validate required fields
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

    // Process order items
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

      // Update product stock
      product.stock -= cartItem.quantity;
      product.totalSold += cartItem.quantity;
      product.stockHistory.push({
        previousStock: product.stock + cartItem.quantity,
        newStock: product.stock,
        unitsChanged: -cartItem.quantity,
        type: 'sale',
        user: req.user.id,
        notes: `Order: ${cartItem.quantity} units sold`
      });

      await product.save({ session });
    }

    // Calculate totals
    const shippingFee = calculateShippingFee(orderItems, customerInfo.location);
    const taxAmount = calculateTaxAmount(subtotal);
    const totalAmount = subtotal + shippingFee + taxAmount;

    console.log('💰 Order totals:');
    console.log('   Subtotal:', subtotal);
    console.log('   Shipping:', shippingFee);
    console.log('   Tax:', taxAmount);
    console.log('   Total:', totalAmount);

    // Generate order number
    const orderNumber = await generateOrderNumber();
    console.log('📝 Order number:', orderNumber);
    
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
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product && product.stockHistory.length > 0) {
        product.stockHistory[product.stockHistory.length - 1].reference = order._id;
        await product.save({ session });
      }
    }

    // Create notification for admins
    await createOrderNotification(order, 'new_order');
    
    // Send WhatsApp notification
    console.log('\n📱 Attempting WhatsApp notification...');
    const whatsappResult = await sendWhatsAppOrderNotification(order, 'new_order');
    console.log('📱 WhatsApp result:', whatsappResult.length > 0 ? 'Attempted' : 'No configs found');

    await session.commitTransaction();
    await session.endSession();
    
    console.log('✅ Order created successfully:', orderNumber);
    console.log('🛒 === ORDER CREATION END ===\n');

    const populatedOrder = await Order.findById(order._id)
      .populate('customer.user', 'name email')
      .populate('items.product', 'name images');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      whatsappNotification: whatsappResult.length > 0,
      whatsappResult: whatsappResult,
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
    if (status && status !== 'all') query.orderStatus = status;
    
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
    
    if (order.customer.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
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
    order.statusHistory.push({
      status: orderStatus,
      note: note || `Status changed from ${previousStatus} to ${orderStatus}`,
      changedBy: req.user.id
    });
    
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
      order.deliveredBy = req.user.id;
      await createOrderNotification(order, 'delivered', note);
      await sendWhatsAppOrderNotification(order, 'delivered', note);
    } else if (orderStatus === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Order cancelled by admin';
      await createOrderNotification(order, 'cancelled', order.cancellationReason);
      await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
      await restoreOrderStock(order, req.user.id, session);
    } else if (orderStatus === 'processing') {
      await createOrderNotification(order, 'processing', note);
      await sendWhatsAppOrderNotification(order, 'processing', note);
    } else if (orderStatus === 'confirmed') {
      await sendWhatsAppOrderNotification(order, 'confirmed', note);
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
    await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
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
    
    order.orderStatus = 'processing';
    order.processedBy = req.user.id;
    order.statusHistory.push({
      status: 'processing',
      note: 'Order processed by admin',
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'processing');
    await sendWhatsAppOrderNotification(order, 'processing');
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
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
    
    order.orderStatus = 'delivered';
    order.deliveredAt = new Date();
    order.deliveredBy = req.user.id;
    order.statusHistory.push({
      status: 'delivered',
      note: 'Order delivered by admin',
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'delivered');
    await sendWhatsAppOrderNotification(order, 'delivered');
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
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
    
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Rejected by admin';
    order.statusHistory.push({
      status: 'cancelled',
      note: `Order rejected by admin. Reason: ${reason || 'Not specified'}`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'cancelled', order.cancellationReason);
    await sendWhatsAppOrderNotification(order, 'cancelled', order.cancellationReason);
    await restoreOrderStock(order, req.user.id, session);
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
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
      note: `Delivery confirmed by customer. Note: ${confirmationNote || 'No note provided'}`,
      changedBy: req.user.id
    });
    
    await createOrderNotification(order, 'confirmed', confirmationNote);
    await sendWhatsAppOrderNotification(order, 'confirmed', confirmationNote);
    
    const sale = await createSaleFromOrder(order, req.user.id, session);
    order.saleReference = sale._id;
    
    await order.save({ session });
    await session.commitTransaction();
    await session.endSession();
    
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
      case 'today': startDate.setHours(0, 0, 0, 0); break;
      case 'week': startDate.setDate(startDate.getDate() - 7); break;
      case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
      case 'year': startDate.setFullYear(startDate.getFullYear() - 1); break;
      default: startDate.setMonth(startDate.getMonth() - 1);
    }
    
    const stats = await Order.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          confirmedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } },
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
    if (status && status !== 'all') query.orderStatus = status;
    
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
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
          confirmedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] } },
          shippedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'shipped'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } }
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
  const baseFee = 5000;
  const perItemFee = 1000;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
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
  const taxRate = 0.18;
  return subtotal * taxRate;
}