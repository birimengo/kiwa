const WhatsAppConfig = require('../models/WhatsAppConfig');
const WhatsAppLog = require('../models/WhatsAppLog');
const whatsappService = require('../services/whatsappService');

// @desc    Get WhatsApp configuration for current user
// @route   GET /api/whatsapp/config
// @access  Private/Admin
exports.getConfig = async (req, res) => {
  try {
    console.log('📱 Fetching WhatsApp config for user:', req.user.id);
    
    const config = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('-apiKey')
      .lean();

    if (!config) {
      console.log('📱 No config found, returning default');
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

    console.log('📱 Config found:', {
      phone: config.phoneNumber ? 'Present' : 'Missing',
      isActive: config.isActive,
      notifications: config.notifications
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
    const { phoneNumber, apiKey, isActive, notifications } = req.body;
    
    console.log('\n📱 === SAVING WHATSAPP CONFIG ===');
    console.log('User:', req.user.id);
    console.log('Phone:', phoneNumber);
    console.log('API Key present:', !!apiKey);
    console.log('Is Active:', isActive);
    console.log('Notifications:', notifications);

    // Validate phone number
    if (phoneNumber) {
      const validation = whatsappService.validateAndFormatPhone(phoneNumber);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      console.log('📱 Phone validation passed:', validation.formatted);
    }

    // Verify API key if provided
    if (apiKey && phoneNumber) {
      console.log('🔐 Verifying API key...');
      const verification = await whatsappService.verifyApiKey(phoneNumber, apiKey);
      console.log('🔐 Verification result:', verification.success ? 'SUCCESS' : 'FAILED');
      
      if (!verification.success) {
        return res.status(400).json({
          success: false,
          message: 'API key verification failed',
          error: verification.message
        });
      }
    }

    const configData = {
      user: req.user.id,
      phoneNumber: phoneNumber || undefined,
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
    console.log('📱 === CONFIG SAVED ===\n');

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
    console.log('\n🧪 === WHATSAPP TEST START ===');
    
    const config = await WhatsAppConfig.findOne({ user: req.user.id })
      .select('+apiKey');

    if (!config || !config.isActive || !config.phoneNumber || !config.apiKey) {
      console.log('❌ WhatsApp not configured or inactive');
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not configured or not active. Please configure it first.'
      });
    }

    console.log('🧪 Using config:', {
      phone: config.phoneNumber,
      apiKey: config.apiKey ? 'Present' : 'Missing',
      isActive: config.isActive
    });

    // Create test order
    const testOrder = whatsappService.generateTestOrder();
    console.log('🧪 Test order:', testOrder.orderNumber);

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

    // Log the test
    await WhatsAppLog.create({
      user: req.user.id,
      type: 'test',
      phoneNumber: config.phoneNumber,
      orderNumber: testOrder.orderNumber,
      success: result.success,
      message: result.message,
      response: result.data
    });

    console.log('🧪 Test result:', result.success ? 'SUCCESS' : 'FAILED');
    console.log('🧪 === WHATSAPP TEST END ===\n');

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

    console.log(`✅ WhatsApp deactivated for user ${req.user.id}`);

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
      phoneNumber: config.phoneNumber ? `${config.phoneNumber.substring(0, 4)}...${config.phoneNumber.slice(-4)}` : 'Not configured',
      lastTest: config.lastTestAt,
      lastTestStatus: config.lastTestStatus
    };

    // Get detailed stats from logs
    const logs = await WhatsAppLog.find({ user: req.user.id });
    const successfulLogs = logs.filter(log => log.success);
    
    stats.totalNotifications = logs.length;
    stats.successfulNotifications = successfulLogs.length;
    stats.successRate = logs.length > 0 ? Math.round((successfulLogs.length / logs.length) * 100) : 0;
    stats.lastNotification = logs.length > 0 ? logs[0].createdAt : null;

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

// @desc    Manual WhatsApp test endpoint (for debugging)
// @route   POST /api/whatsapp/manual-test
// @access  Private/Admin
exports.manualTest = async (req, res) => {
  try {
    const { phoneNumber, apiKey, message } = req.body;
    
    if (!phoneNumber || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and API key are required'
      });
    }

    console.log('🧪 Manual WhatsApp test:', { phoneNumber, apiKey });

    const testMessage = message || '✅ Manual WhatsApp API Test!\n\nThis is a manual test from ElectroShop Admin.\n\nTime: ' + new Date().toLocaleString();
    
    const encodedMessage = encodeURIComponent(testMessage);
    const formattedPhone = whatsappService.formatPhoneForApi(phoneNumber);
    
    const url = `https://api.callmebot.com/whatsapp.php?phone=${formattedPhone}&text=${encodedMessage}&apikey=${apiKey}`;
    
    console.log('🧪 URL (first 100 chars):', url.substring(0, 100) + '...');

    const axios = require('axios');
    const response = await axios.get(url, { timeout: 10000 });

    console.log('🧪 Response:', response.data);

    res.json({
      success: true,
      message: 'Manual test completed',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Manual test error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.code
    });
  }
};