const axios = require('axios');
const crypto = require('crypto');

class WhatsAppService {
  constructor() {
    this.baseURL = 'https://api.callmebot.com/whatsapp.php';
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  async sendOrderNotification(whatsappConfig, order, notificationType = 'new_order', note = '') {
    try {
      const { phoneNumber, apiKey } = whatsappConfig;
      
      console.log('📱 Starting WhatsApp notification:', {
        phoneNumber,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length,
        notificationType,
        orderNumber: order.orderNumber
      });

      if (!phoneNumber || !apiKey) {
        console.log('❌ WhatsApp notification skipped: Phone number or API key not configured');
        return { 
          success: false, 
          message: 'WhatsApp configuration missing',
          type: notificationType,
          error: 'Missing phone number or API key'
        };
      }

      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        console.error('❌ Invalid phone number format:', phoneNumber);
        return { 
          success: false, 
          message: 'Invalid phone number format',
          type: notificationType,
          error: 'Invalid phone number format'
        };
      }

      // Format message with order details based on notification type
      const message = this.formatOrderMessage(order, notificationType, note);
      
      console.log('📱 WhatsApp message prepared:', {
        messageLength: message.length,
        notificationType,
        orderNumber: order.orderNumber
      });
      
      // Encode message for URL (max 4096 characters for WhatsApp)
      if (message.length > 4096) {
        console.warn('⚠️ WhatsApp message too long, truncating...');
        const truncatedMessage = message.substring(0, 4000) + '\n\n[Message truncated due to length]';
        return await this.sendMessage(phoneNumber, apiKey, truncatedMessage, notificationType, order.orderNumber);
      }
      
      return await this.sendMessage(phoneNumber, apiKey, message, notificationType, order.orderNumber);
      
    } catch (error) {
      console.error('❌ WhatsApp notification error:', error.message);
      console.error('Stack trace:', error.stack);
      return {
        success: false,
        message: error.message,
        type: notificationType,
        error: error.message
      };
    }
  }

  async sendMessage(phoneNumber, apiKey, message, notificationType, orderNumber, retryCount = 0) {
    try {
      // Add detailed logging
      console.log('📱 WhatsApp API Details:', {
        originalPhone: phoneNumber,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey?.length,
        notificationType,
        orderNumber,
        messageLength: message.length,
        retryCount
      });
      
      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      
      // Format phone number
      const formattedPhone = this.formatPhoneForApi(phoneNumber);
      
      // Build URL
      const url = `${this.baseURL}?phone=${formattedPhone}&text=${encodedMessage}&apikey=${apiKey}`;
      
      console.log(`📱 Calling WhatsApp API for order ${orderNumber}`);
      console.log(`📱 URL (partial for security): ${url.substring(0, 80)}...`);
      
      // Send request with timeout
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'ElectroShop-Backend/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log(`✅ WhatsApp ${notificationType} notification sent to ${formattedPhone} for order ${orderNumber}`);
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', typeof response.data === 'string' ? response.data.substring(0, 200) + '...' : response.data);
      
      return {
        success: true,
        data: response.data,
        type: notificationType,
        orderNumber,
        phoneNumber: formattedPhone,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ WhatsApp API error for ${phoneNumber}:`, {
        message: error.message,
        code: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      
      if (error.code === 'ECONNABORTED' && retryCount < this.maxRetries) {
        console.log(`🔄 Retry ${retryCount + 1}/${this.maxRetries} for WhatsApp notification`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.sendMessage(phoneNumber, apiKey, message, notificationType, orderNumber, retryCount + 1);
      }
      
      throw error;
    }
  }

  formatOrderMessage(order, notificationType, note = '') {
    const itemsList = order.items.map((item, index) => 
      `${index + 1}. ${item.productName} (${item.productBrand || 'No brand'})\n   Qty: ${item.quantity} × UGX ${item.unitPrice?.toLocaleString?.() || '0'}\n   Total: UGX ${item.totalPrice?.toLocaleString?.() || '0'}`
    ).join('\n\n');

    let statusEmoji = '📦';
    let statusMessage = '';
    let additionalInfo = '';
    
    switch(notificationType) {
      case 'new_order':
        statusEmoji = '🆕';
        statusMessage = '📦 *NEW ORDER RECEIVED* 📦';
        additionalInfo = `
*📋 Order Items:*
${itemsList}

*💵 Order Summary:*
Subtotal: UGX ${order.subtotal?.toLocaleString?.() || '0'}
Shipping: UGX ${order.shippingFee?.toLocaleString?.() || '0'}
Tax: UGX ${order.taxAmount?.toLocaleString?.() || '0'}
*Total: UGX ${order.totalAmount?.toLocaleString?.() || '0'}*

*💰 Payment:*
Method: ${order.paymentMethod || 'onDelivery'}
Status: ${order.paymentStatus || 'pending'}`;
        break;
        
      case 'processing':
        statusEmoji = '⚙️';
        statusMessage = '⚙️ *ORDER PROCESSING* ⚙️';
        break;
        
      case 'delivered':
        statusEmoji = '🚚';
        statusMessage = '✅ *ORDER DELIVERED* ✅';
        additionalInfo = note ? `\n*📝 Delivery Note:* ${note}` : '';
        break;
        
      case 'confirmed':
        statusEmoji = '✅';
        statusMessage = '✅ *DELIVERY CONFIRMED* ✅';
        additionalInfo = note ? `\n*📝 Confirmation Note:* ${note}` : '';
        break;
        
      case 'cancelled':
        statusEmoji = '❌';
        statusMessage = '❌ *ORDER CANCELLED* ❌';
        additionalInfo = note ? `\n*📝 Reason:* ${note}` : '';
        break;
    }

    let message = `${statusEmoji} ${statusMessage} ${statusEmoji}

*Order Number:* ${order.orderNumber || 'N/A'}
*Customer:* ${order.customer?.name || 'N/A'}
*Phone:* ${order.customer?.phone || 'N/A'}
*Location:* ${order.customer?.location || 'N/A'}
*Date:* ${new Date(order.createdAt || new Date()).toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}`;

    if (additionalInfo) {
      message += additionalInfo;
    }

    // Add shipping address if available
    if (order.shippingAddress) {
      message += `
*🏠 Shipping Address:*
${order.shippingAddress.street || ''}
${order.shippingAddress.city || ''}, ${order.shippingAddress.country || ''}`;
    }

    // Add notes if available
    if (order.notes && notificationType === 'new_order') {
      message += `
*📝 Customer Notes:*
${order.notes}`;
    }

    // Add order status timeline
    if (notificationType !== 'new_order') {
      message += `
*📊 Order Status:*
${order.orderStatus || 'pending'}
${order.deliveredAt ? `Delivered: ${new Date(order.deliveredAt).toLocaleDateString()}` : ''}
${order.confirmedAt ? `Confirmed: ${new Date(order.confirmedAt).toLocaleDateString()}` : ''}`;
    }

    // Add footer with link
    const frontendUrl = process.env.FRONTEND_URL || 'https://your-ecommerce.com';
    message += `

*🔗 View Order:*
${frontendUrl}/admin/orders?order=${order.orderNumber}

*🕒 Notification Time:* ${new Date().toLocaleString('en-US', {
  hour12: true,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})}

*💬 Sent via ElectroShop WhatsApp Notifications*`;

    return message;
  }

  formatPhoneForApi(phoneNumber) {
    if (!phoneNumber) {
      console.error('❌ formatPhoneForApi: No phone number provided');
      return '';
    }
    
    console.log(`📱 Original phone number: ${phoneNumber}`);
    
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    console.log(`📱 Cleaned phone number: ${cleaned}`);
    
    // If starts with 0, replace with 256 (Uganda)
    if (cleaned.startsWith('0')) {
      cleaned = '256' + cleaned.substring(1);
      console.log(`📱 Converted 0 to 256: ${cleaned}`);
    }
    
    // Remove any existing + signs
    cleaned = cleaned.replace(/^\+/, '');
    
    // Ensure it starts with country code
    if (!cleaned.startsWith('256') && cleaned.length >= 9) {
      // Assume Uganda number if no country code
      cleaned = '256' + cleaned;
    }
    
    // Add + prefix
    const formatted = '+' + cleaned;
    
    console.log(`📱 Final formatted phone: ${formatted}`);
    
    return formatted;
  }

  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }
    
    console.log(`📱 Validating phone number: ${phoneNumber}`);
    
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Basic validation: 9-15 digits
    if (cleaned.length < 9 || cleaned.length > 15) {
      console.log(`❌ Phone number length invalid: ${cleaned.length} digits`);
      return false;
    }
    
    // Additional validation for specific countries
    if (cleaned.startsWith('256')) { // Uganda
      const isValid = cleaned.length === 12; // 256 XXX XXX XXX
      console.log(`📱 Uganda number validation: ${isValid ? 'Valid' : 'Invalid'}`);
      return isValid;
    } else if (cleaned.startsWith('1')) { // US/Canada
      const isValid = cleaned.length === 11; // 1 XXX XXX XXXX
      console.log(`📱 US/Canada number validation: ${isValid ? 'Valid' : 'Invalid'}`);
      return isValid;
    } else if (cleaned.startsWith('44')) { // UK
      const isValid = cleaned.length === 12; // 44 XX XXXX XXXX
      console.log(`📱 UK number validation: ${isValid ? 'Valid' : 'Invalid'}`);
      return isValid;
    }
    
    // Generic validation for other countries
    const isValid = cleaned.length >= 10 && cleaned.length <= 15;
    console.log(`📱 Generic number validation: ${isValid ? 'Valid' : 'Invalid'}`);
    return isValid;
  }

  generateTestOrder() {
    const testOrder = {
      orderNumber: `TEST-${Date.now().toString().slice(-6)}`,
      customer: {
        name: 'Test Customer',
        phone: '+256700000000',
        location: 'Kampala, Uganda',
        email: 'test@example.com'
      },
      items: [
        {
          productName: 'Test Product 1',
          productBrand: 'Test Brand',
          quantity: 2,
          unitPrice: 50000,
          totalPrice: 100000
        },
        {
          productName: 'Test Product 2',
          productBrand: 'Test Brand',
          quantity: 1,
          unitPrice: 75000,
          totalPrice: 75000
        }
      ],
      subtotal: 175000,
      shippingFee: 5000,
      taxAmount: 31500,
      totalAmount: 211500,
      paymentMethod: 'onDelivery',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      shippingAddress: {
        street: 'Test Street 123',
        city: 'Kampala',
        country: 'Uganda'
      },
      notes: 'This is a test notification to verify WhatsApp integration',
      createdAt: new Date()
    };
    
    console.log('📱 Generated test order:', testOrder.orderNumber);
    return testOrder;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method to send multiple notifications
  async sendBulkNotifications(configs, order, notificationType, note = '') {
    console.log(`📱 Starting bulk WhatsApp notifications for ${configs.length} configs`);
    
    const results = [];
    
    for (const config of configs) {
      try {
        const result = await this.sendOrderNotification(config, order, notificationType, note);
        results.push({
          config: { phoneNumber: config.phoneNumber },
          ...result
        });
      } catch (error) {
        results.push({
          config: { phoneNumber: config.phoneNumber },
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`📱 Bulk notifications completed: ${results.filter(r => r.success).length}/${configs.length} successful`);
    return results;
  }

  // Method to verify API key by sending a simple test message
  async verifyApiKey(phoneNumber, apiKey) {
    try {
      console.log('📱 Verifying API key for phone:', phoneNumber ? `${phoneNumber.substring(0, 4)}...` : 'none');
      
      const testMessage = '✅ WhatsApp notifications are working correctly!\n\nThis is a verification message from ElectroShop.\n\nYou will receive order notifications on this number.';
      const encodedMessage = encodeURIComponent(testMessage);
      const formattedPhone = this.formatPhoneForApi(phoneNumber);
      const url = `${this.baseURL}?phone=${formattedPhone}&text=${encodedMessage}&apikey=${apiKey}`;
      
      console.log('📱 Verification URL (partial):', url.substring(0, 80) + '...');
      
      const response = await axios.get(url, { timeout: 10000 });
      
      console.log('✅ API key verified successfully');
      
      return {
        success: true,
        message: 'API key verified successfully',
        data: response.data
      };
    } catch (error) {
      console.error('❌ API key verification failed:', error.message);
      return {
        success: false,
        message: error.message,
        error: error.code
      };
    }
  }

  // Create hash for caching/rate limiting
  createNotificationHash(orderId, notificationType) {
    return crypto
      .createHash('md5')
      .update(`${orderId}-${notificationType}-${Date.now()}`)
      .digest('hex')
      .slice(0, 8);
  }
}

module.exports = new WhatsAppService();