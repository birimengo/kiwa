const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppLog = require('../models/WhatsAppLog');
const whatsappService = require('../services/whatsappService');

// @desc    Get WhatsApp configuration
// @route   GET /api/whatsapp/config
// @access  Private/Admin
exports.getConfig = async (req, res) => {
  try {
    console.log(`📱 Fetching WhatsApp config for user ${req.user.id}`);
    
    const config = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('-apiKey') // Don't send API key to frontend for security
      .lean();

    if (!config) {
      console.log(`📱 No WhatsApp config found for user ${req.user.id}, returning defaults`);
      return res.json({
        success: true,
        config: {
          user: req.user.id,
          phoneNumber: '',
          isActive: false,
          notifications: {
            newOrders: true,
            orderUpdates: true,
            payments: true,
            lowStock: true
          },
          lastTestStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log(`✅ WhatsApp config found for user ${req.user.id}:`, {
      isActive: config.isActive,
      phoneConfigured: !!config.phoneNumber,
      lastTestStatus: config.lastTestStatus
    });

    res.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('❌ Get WhatsApp config error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching WhatsApp configuration',
      error: error.message
    });
  }
};

// @desc    Save WhatsApp configuration
// @route   POST /api/whatsapp/config
// @access  Private/Admin
exports.saveConfig = async (req, res) => {
  try {
    const { phoneNumber, apiKey, isActive = false, notifications = {} } = req.body;

    console.log('📱 Saving WhatsApp config:', { 
      phoneNumber, 
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      isActive,
      notifications 
    });

    // Validate required fields when isActive is true
    if (isActive) {
      if (!phoneNumber || !apiKey) {
        console.log('❌ Missing phone number or API key');
        return res.status(400).json({
          success: false,
          message: 'Phone number and API key are required when activating WhatsApp notifications'
        });
      }

      // Validate phone number format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      const cleanedPhone = phoneNumber.replace(/\s/g, '');
      
      if (!phoneRegex.test(cleanedPhone)) {
        console.log('❌ Invalid phone number format:', phoneNumber);
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Use format: +256700000000'
        });
      }
      
      // Basic API key validation
      if (apiKey.length < 5) {
        console.log('❌ API key too short:', apiKey.length);
        return res.status(400).json({
          success: false,
          message: 'API key appears to be too short'
        });
      }
    }

    // Prepare config data
    const configData = {
      user: req.user.id,
      phoneNumber: phoneNumber,
      apiKey: apiKey,
      isActive: isActive,
      notifications: {
        newOrders: notifications.newOrders !== undefined ? notifications.newOrders : true,
        orderUpdates: notifications.orderUpdates !== undefined ? notifications.orderUpdates : true,
        payments: notifications.payments !== undefined ? notifications.payments : true,
        lowStock: notifications.lowStock !== undefined ? notifications.lowStock : true
      },
      lastUpdated: new Date()
    };

    // Update last test info only if activating
    if (isActive && phoneNumber && apiKey) {
      configData.lastTestAt = new Date();
      configData.lastTestStatus = 'pending'; // Will be updated after test
    } else if (!isActive) {
      configData.lastTestStatus = 'pending';
    }

    // Use findOneAndUpdate with upsert
    const config = await WhatsAppConfig.findOneAndUpdate(
      { user: req.user.id },
      configData,
      { 
        new: true, 
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    // Don't send API key in response
    const responseConfig = config.toObject();
    delete responseConfig.apiKey;

    console.log(`✅ WhatsApp configuration saved for user ${req.user.id}:`, {
      isActive: config.isActive,
      phoneConfigured: !!config.phoneNumber,
      configId: config._id,
      lastTestStatus: config.lastTestStatus
    });

    res.json({
      success: true,
      message: 'WhatsApp configuration saved successfully',
      config: responseConfig
    });

  } catch (error) {
    console.error('❌ Save WhatsApp config error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while saving WhatsApp configuration',
      error: error.message
    });
  }
};

// @desc    Test WhatsApp notification
// @route   POST /api/whatsapp/test
// @access  Private/Admin
exports.testNotification = async (req, res) => {
  try {
    console.log('📱 Testing WhatsApp notification for user:', req.user.id);
    
    // Get config WITH API key
    const config = await WhatsAppConfig.findOne({ user: req.user.id }).select('+apiKey');

    if (!config) {
      console.log('❌ WhatsApp not configured for user:', req.user.id);
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not configured. Please add phone number and API key first.'
      });
    }

    if (!config.phoneNumber || !config.apiKey) {
      console.log('❌ WhatsApp incomplete configuration:', {
        hasPhone: !!config.phoneNumber,
        hasApiKey: !!config.apiKey
      });
      return res.status(400).json({
        success: false,
        message: 'WhatsApp configuration incomplete. Please add phone number and API key.'
      });
    }

    if (!config.isActive) {
      console.log('❌ WhatsApp not active for user:', req.user.id);
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not active. Please activate it first.'
      });
    }

    console.log(`📱 Sending test notification to ${config.phoneNumber}`);

    // Create test order data
    const testOrder = whatsappService.generateTestOrder();

    // Send test notification
    const result = await whatsappService.sendOrderNotification(
      {
        phoneNumber: config.phoneNumber,
        apiKey: config.apiKey
      },
      testOrder,
      'new_order',
      'This is a test notification to verify WhatsApp integration is working correctly.'
    );

    // Update config with test result
    await WhatsAppConfig.findOneAndUpdate(
      { user: req.user.id },
      {
        lastTestAt: new Date(),
        lastTestStatus: result.success ? 'success' : 'failed'
      }
    );

    // Log the test
    await WhatsAppLog.create({
      user: req.user.id,
      type: 'test',
      phoneNumber: config.phoneNumber,
      orderNumber: testOrder.orderNumber,
      success: result.success,
      message: result.message,
      response: result.data,
      error: result.error || null,
      metadata: {
        test: true,
        orderNumber: testOrder.orderNumber,
        timestamp: new Date()
      }
    });

    console.log(`📱 Test notification result for ${config.phoneNumber}:`, result.success ? 'Success' : 'Failed');

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully! Check your WhatsApp.',
        orderNumber: testOrder.orderNumber,
        timestamp: new Date(),
        result: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.message || 'Unknown error',
        details: result.data
      });
    }

  } catch (error) {
    console.error('❌ Test WhatsApp notification error:', error);
    console.error('Stack trace:', error.stack);
    
    // Log the error
    try {
      await WhatsAppLog.create({
        user: req.user.id,
        type: 'test',
        phoneNumber: 'unknown',
        success: false,
        error: error.message,
        metadata: {
          test: true,
          error: error.message,
          timestamp: new Date(),
          stack: error.stack
        }
      });
    } catch (logError) {
      console.error('❌ Error logging WhatsApp test error:', logError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while sending test notification',
      error: error.message
    });
  }
};

// @desc    Deactivate WhatsApp notifications
// @route   DELETE /api/whatsapp/config
// @access  Private/Admin
exports.deactivate = async (req, res) => {
  try {
    console.log(`📱 Deactivating WhatsApp for user ${req.user.id}`);
    
    const config = await WhatsAppConfig.findOneAndUpdate(
      { user: req.user.id },
      { 
        isActive: false,
        deactivatedAt: new Date(),
        lastTestStatus: 'pending'
      },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    console.log(`✅ WhatsApp deactivated for user ${req.user.id}`);

    // Remove API key from response
    const responseConfig = config.toObject();
    delete responseConfig.apiKey;

    res.json({
      success: true,
      message: 'WhatsApp notifications deactivated successfully',
      config: responseConfig
    });

  } catch (error) {
    console.error('❌ Deactivate WhatsApp error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating WhatsApp notifications',
      error: error.message
    });
  }
};

// @desc    Verify API key
// @route   POST /api/whatsapp/verify
// @access  Private/Admin
exports.verifyApiKey = async (req, res) => {
  try {
    const { phoneNumber, apiKey } = req.body;

    console.log('📱 Verifying API key for phone:', phoneNumber ? `${phoneNumber.substring(0, 4)}...` : 'none');

    if (!phoneNumber || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and API key are required'
      });
    }

    // Verify API key
    const result = await whatsappService.verifyApiKey(phoneNumber, apiKey);

    console.log(`📱 API key verification result:`, result.success ? 'Success' : 'Failed');

    res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });

  } catch (error) {
    console.error('❌ Verify API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying API key',
      error: error.message
    });
  }
};

// @desc    Get WhatsApp statistics
// @route   GET /api/whatsapp/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    console.log(`📱 Fetching WhatsApp stats for user ${req.user.id}`);
    
    const config = await WhatsAppConfig.findOne({ user: req.user.id });
    
    if (!config) {
      return res.json({
        success: true,
        stats: {
          isActive: false,
          totalNotifications: 0,
          successRate: 0,
          lastNotification: null,
          lastTest: null,
          lastTestStatus: 'pending'
        }
      });
    }

    // Get logs for this user
    const logs = await WhatsAppLog.find({ user: req.user.id });
    const successfulLogs = logs.filter(log => log.success);
    
    // Calculate statistics from logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = logs.filter(log => new Date(log.createdAt) >= today);
    const successfulToday = todayLogs.filter(log => log.success);
    
    const stats = {
      isActive: config.isActive,
      phoneConfigured: !!config.phoneNumber,
      lastTest: config.lastTestAt,
      lastTestStatus: config.lastTestStatus,
      
      // Overall statistics
      totalNotifications: logs.length,
      successfulNotifications: successfulLogs.length,
      successRate: logs.length > 0 ? Math.round((successfulLogs.length / logs.length) * 100) : 0,
      lastNotification: logs.length > 0 ? logs[0].createdAt : null,
      
      // Today's statistics
      todayNotifications: todayLogs.length,
      successfulToday: successfulToday.length,
      todaySuccessRate: todayLogs.length > 0 ? Math.round((successfulToday.length / todayLogs.length) * 100) : 0,
      
      // Notification type breakdown
      notificationTypes: {
        new_order: logs.filter(log => log.type === 'new_order').length,
        test: logs.filter(log => log.type === 'test').length,
        delivered: logs.filter(log => log.type === 'delivered').length,
        cancelled: logs.filter(log => log.type === 'cancelled').length,
        processing: logs.filter(log => log.type === 'processing').length,
        confirmed: logs.filter(log => log.type === 'confirmed').length
      }
    };

    console.log(`✅ WhatsApp stats for user ${req.user.id}:`, {
      isActive: stats.isActive,
      totalNotifications: stats.totalNotifications,
      successRate: `${stats.successRate}%`
    });

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Get WhatsApp stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching WhatsApp statistics',
      error: error.message
    });
  }
};

// @desc    Get WhatsApp notification logs
// @route   GET /api/whatsapp/logs
// @access  Private/Admin
exports.getNotificationLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, success, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    console.log(`📱 Fetching WhatsApp logs for user ${req.user.id}, page ${page}`);

    // Build query
    let query = { user: req.user.id };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (success !== undefined) {
      query.success = success === 'true';
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await WhatsAppLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await WhatsAppLog.countDocuments(query);

    // Format logs for response
    const formattedLogs = logs.map(log => ({
      id: log._id,
      type: log.type,
      orderNumber: log.orderNumber,
      phoneNumber: log.phoneNumber ? `${log.phoneNumber.substring(0, 4)}...${log.phoneNumber.substring(-4)}` : 'N/A',
      success: log.success,
      message: log.message,
      error: log.error,
      createdAt: log.createdAt,
      response: log.response ? 'Received' : 'None'
    }));

    console.log(`✅ Found ${logs.length} WhatsApp logs for user ${req.user.id}`);

    res.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get WhatsApp logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification logs',
      error: error.message
    });
  }
};

// @desc    Debug WhatsApp system
// @route   GET /api/whatsapp/debug
// @access  Private/Admin
exports.debugWhatsApp = async (req, res) => {
  try {
    console.log('📱 Debugging WhatsApp system for user:', req.user.id);
    
    // Get user's config
    const config = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('phoneNumber isActive notifications lastTestAt lastTestStatus')
      .lean();
    
    // Get all active configs in system
    const allActiveConfigs = await WhatsAppConfig.find({ isActive: true })
      .select('phoneNumber user notifications')
      .populate('user', 'name email role')
      .lean();
    
    // Get recent logs
    const recentLogs = await WhatsAppLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Get user's recent logs
    const userLogs = await WhatsAppLog.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    // Calculate system health
    const totalLogs = await WhatsAppLog.countDocuments();
    const successfulLogs = await WhatsAppLog.countDocuments({ success: true });
    const systemSuccessRate = totalLogs > 0 ? Math.round((successfulLogs / totalLogs) * 100) : 0;
    
    const debugInfo = {
      timestamp: new Date(),
      userConfig: config || { message: 'No configuration found' },
      
      systemOverview: {
        totalActiveConfigs: allActiveConfigs.length,
        activeConfigs: allActiveConfigs.map(c => ({
          phoneNumber: c.phoneNumber ? `${c.phoneNumber.substring(0, 4)}...${c.phoneNumber.substring(-4)}` : 'Not set',
          user: c.user ? `${c.user.name} (${c.user.email})` : 'Unknown',
          notifications: c.notifications
        })),
        totalLogs,
        successfulLogs,
        systemSuccessRate: `${systemSuccessRate}%`
      },
      
      recentSystemLogs: recentLogs.map(log => ({
        type: log.type,
        orderNumber: log.orderNumber,
        phoneNumber: log.phoneNumber ? `${log.phoneNumber.substring(0, 4)}...` : 'N/A',
        success: log.success,
        error: log.error,
        createdAt: log.createdAt
      })),
      
      userRecentLogs: userLogs.map(log => ({
        type: log.type,
        orderNumber: log.orderNumber,
        success: log.success,
        error: log.error,
        createdAt: log.createdAt
      })),
      
      serviceStatus: {
        whatsappService: 'loaded',
        callmebotApi: 'available',
        timestamp: new Date()
      },
      
      recommendations: config ? (
        !config.isActive ? ['Activate WhatsApp notifications to receive alerts'] :
        !config.phoneNumber ? ['Add phone number configuration'] :
        config.lastTestStatus === 'failed' ? ['Test failed. Check API key and phone number'] :
        config.lastTestStatus === 'pending' ? ['Test your configuration'] :
        ['Configuration looks good!']
      ) : ['Please configure WhatsApp settings']
    };

    console.log('✅ WhatsApp debug info generated');

    res.json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('❌ Debug WhatsApp error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Clear WhatsApp logs
// @route   DELETE /api/whatsapp/logs
// @access  Private/Admin
exports.clearLogs = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    if (days < 1) {
      return res.status(400).json({
        success: false,
        message: 'Days must be at least 1'
      });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    console.log(`📱 Clearing WhatsApp logs older than ${days} days for user ${req.user.id}`);
    
    const result = await WhatsAppLog.deleteMany({
      user: req.user.id,
      createdAt: { $lt: cutoffDate }
    });
    
    console.log(`✅ Cleared ${result.deletedCount} WhatsApp logs for user ${req.user.id}`);
    
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} WhatsApp logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error('❌ Clear WhatsApp logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing WhatsApp logs',
      error: error.message
    });
  }
};

// @desc    Get WhatsApp configuration for all admins (system endpoint)
// @route   GET /api/whatsapp/admin/configs
// @access  Private/Admin
exports.getAllAdminConfigs = async (req, res) => {
  try {
    // Only allow super admins to access all configs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access all configurations'
      });
    }
    
    const configs = await WhatsAppConfig.find({ isActive: true })
      .select('phoneNumber notifications user lastTestAt lastTestStatus')
      .populate('user', 'name email role')
      .lean();
    
    // Mask phone numbers for security
    const maskedConfigs = configs.map(config => ({
      id: config._id,
      user: config.user,
      phoneNumber: config.phoneNumber ? `${config.phoneNumber.substring(0, 4)}...${config.phoneNumber.substring(-4)}` : 'Not set',
      isActive: true,
      notifications: config.notifications,
      lastTestStatus: config.lastTestStatus,
      lastTestAt: config.lastTestAt
    }));
    
    res.json({
      success: true,
      configs: maskedConfigs,
      count: maskedConfigs.length
    });
    
  } catch (error) {
    console.error('❌ Get all admin configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin configurations',
      error: error.message
    });
  }
};

// @desc    Quick test endpoint
// @route   GET /api/whatsapp/quick-test
// @access  Private/Admin
exports.quickTest = async (req, res) => {
  try {
    console.log('📱 Quick WhatsApp test for user:', req.user.id);
    
    const config = await WhatsAppConfig.findOne({ user: req.user.id }).select('+apiKey');
    
    if (!config || !config.phoneNumber || !config.apiKey) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    const testMessage = '✅ ElectroShop WhatsApp Test\n\nThis is a quick test message.\n\nTime: ' + new Date().toLocaleString();
    const encodedMessage = encodeURIComponent(testMessage);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${config.phoneNumber}&text=${encodedMessage}&apikey=${config.apiKey}`;
    
    console.log('📱 Quick test URL (partial):', url.substring(0, 80) + '...');
    
    const response = await axios.get(url, { timeout: 10000 });
    
    res.json({
      success: true,
      message: 'Quick test sent',
      response: response.data
    });
    
  } catch (error) {
    console.error('❌ Quick test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};