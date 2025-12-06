const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppLog = require('../models/WhatsAppLog'); // Optional: For logging
const whatsappService = require('../services/whatsappService');

// @desc    Get WhatsApp configuration
// @route   GET /api/whatsapp/config
// @access  Private/Admin
exports.getConfig = async (req, res) => {
  try {
    const config = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('-apiKey') // Don't send API key to frontend for security
      .lean();

    if (!config) {
      return res.json({
        success: true,
        config: {
          user: req.user.id,
          isActive: false,
          notifications: {
            newOrders: true,
            orderUpdates: true,
            payments: true,
            lowStock: true
          }
        }
      });
    }

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
    const { phoneNumber, apiKey, isActive, notifications } = req.body;

    // Validate phone number
    if (phoneNumber && !whatsappService.validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Please include country code (e.g., +256 XXX XXX XXX)'
      });
    }

    // Verify API key if provided
    if (apiKey && phoneNumber) {
      const verification = await whatsappService.verifyApiKey(phoneNumber, apiKey);
      if (!verification.success) {
        return res.status(400).json({
          success: false,
          message: 'API key verification failed. Please check your API key and try again.',
          error: verification.message
        });
      }
    }

    const configData = {
      user: req.user.id,
      phoneNumber: phoneNumber ? whatsappService.formatPhoneForApi(phoneNumber) : undefined,
      apiKey: apiKey || undefined,
      isActive: isActive || false,
      notifications: notifications || {
        newOrders: true,
        orderUpdates: true,
        payments: true,
        lowStock: true
      },
      lastUpdated: new Date()
    };

    const config = await WhatsAppConfig.findOneAndUpdate(
      { user: req.user.id },
      configData,
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    );

    // Remove API key from response
    const responseConfig = config.toObject();
    delete responseConfig.apiKey;

    console.log(`✅ WhatsApp configuration saved for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'WhatsApp configuration saved successfully',
      config: responseConfig
    });

  } catch (error) {
    console.error('❌ Save WhatsApp config error:', error);
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
    const config = await WhatsAppConfig.findOne({ user: req.user.id });

    if (!config || !config.isActive || !config.phoneNumber || !config.apiKey) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not configured or not active. Please configure it first.'
      });
    }

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
    config.lastTestAt = new Date();
    config.lastTestStatus = result.success ? 'success' : 'failed';
    await config.save();

    // Log the test (optional)
    if (WhatsAppLog) {
      await WhatsAppLog.create({
        user: req.user.id,
        type: 'test',
        phoneNumber: config.phoneNumber,
        orderNumber: testOrder.orderNumber,
        success: result.success,
        message: result.message,
        data: result.data
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully! Check your WhatsApp.',
        orderNumber: testOrder.orderNumber,
        timestamp: new Date()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.message,
        details: result.data
      });
    }

  } catch (error) {
    console.error('❌ Test WhatsApp notification error:', error);
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
    await WhatsAppConfig.findOneAndUpdate(
      { user: req.user.id },
      { 
        isActive: false,
        deactivatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'WhatsApp notifications deactivated successfully'
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

    if (!phoneNumber || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and API key are required'
      });
    }

    const result = await whatsappService.verifyApiKey(phoneNumber, apiKey);

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
    const config = await WhatsAppConfig.findOne({ user: req.user.id });
    
    if (!config) {
      return res.json({
        success: true,
        stats: {
          isActive: false,
          totalNotifications: 0,
          successRate: 0,
          lastNotification: null
        }
      });
    }

    let stats = {
      isActive: config.isActive,
      phoneNumber: config.phoneNumber ? `${config.phoneNumber.substring(0, 4)}...${config.phoneNumber.substring(-4)}` : 'Not configured',
      lastTest: config.lastTestAt,
      lastTestStatus: config.lastTestStatus
    };

    // If using WhatsAppLog model, add more detailed stats
    if (WhatsAppLog) {
      const logs = await WhatsAppLog.find({ user: req.user.id });
      const successfulLogs = logs.filter(log => log.success);
      
      stats.totalNotifications = logs.length;
      stats.successfulNotifications = successfulLogs.length;
      stats.successRate = logs.length > 0 ? Math.round((successfulLogs.length / logs.length) * 100) : 0;
      stats.lastNotification = logs.length > 0 ? logs[logs.length - 1].createdAt : null;
    }

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
    if (!WhatsAppLog) {
      return res.json({
        success: true,
        message: 'Logging not enabled',
        logs: []
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const logs = await WhatsAppLog.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await WhatsAppLog.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      logs,
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