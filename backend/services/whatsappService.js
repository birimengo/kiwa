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
      
      if (!phoneNumber || !apiKey) {
        console.log('❌ WhatsApp notification skipped: Phone number or API key not configured');
        return { 
          success: false, 
          message: 'WhatsApp configuration missing',
          type: notificationType 
        };
      }

      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        console.error('❌ Invalid phone number format:', phoneNumber);
        return { 
          success: false, 
          message: 'Invalid phone number format',
          type: notificationType 
        };
      }

      // Format message with order details based on notification type
      const message = this.formatOrderMessage(order, notificationType, note);
      
      // Encode message for URL (max 4096 characters for WhatsApp)
      if (message.length > 4096) {
        console.warn('⚠️ WhatsApp message too long, truncating...');
        const truncatedMessage = message.substring(0, 4000) + '\n\n[Message truncated due to length]';
        return await this.sendMessage(phoneNumber, apiKey, truncatedMessage, notificationType, order.orderNumber);
      }
      
      return await this.sendMessage(phoneNumber, apiKey, message, notificationType, order.orderNumber);
      
    } catch (error) {
      console.error('❌ WhatsApp notification error:', error.message);
      return {
        success: false,
        message: error.message,
        type: notificationType
      };
    }
  }

  async sendMessage(phoneNumber, apiKey, message, notificationType, orderNumber, retryCount = 0) {
    try {
      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      
      // Build URL
      const url = `${this.baseURL}?phone=${this.formatPhoneForApi(phoneNumber)}&text=${encodedMessage}&apikey=${apiKey}`;
      
      console.log(`📱 Sending WhatsApp ${notificationType} notification for order ${orderNumber} to ${phoneNumber}`);
      
      // Send request with timeout
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'ElectroShop-Backend/1.0'
        }
      });
      
      console.log(`✅ WhatsApp ${notificationType} notification sent to ${phoneNumber} for order ${orderNumber}`);
      console.log('📊 Response:', response.data);
      
      return {
        success: true,
        data: response.data,
        type: notificationType,
        orderNumber,
        timestamp: new Date()
      };
      
    } catch (error) {
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
})}`;

    return message;
  }

  formatPhoneForApi(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If starts with 0, replace with country code (assume Uganda +256)
    if (cleaned.startsWith('0')) {
      cleaned = '256' + cleaned.substring(1);
    }
    
    // If doesn't start with +, add it
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }
    
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Basic validation: 10-15 digits
    if (cleaned.length < 10 || cleaned.length > 15) {
      return false;
    }
    
    // Additional validation for specific countries
    if (cleaned.startsWith('256')) { // Uganda
      return cleaned.length === 12; // 256 XXX XXX XXX
    } else if (cleaned.startsWith('1')) { // US/Canada
      return cleaned.length === 11; // 1 XXX XXX XXXX
    } else if (cleaned.startsWith('44')) { // UK
      return cleaned.length === 12; // 44 XX XXXX XXXX
    }
    
    return true;
  }

  generateTestOrder() {
    return {
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
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method to send multiple notifications
  async sendBulkNotifications(configs, order, notificationType, note = '') {
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
    
    return results;
  }

  // Method to verify API key by sending a simple test message
  async verifyApiKey(phoneNumber, apiKey) {
    try {
      const testMessage = '✅ WhatsApp notifications are working correctly!\n\nThis is a verification message from ElectroShop.\n\nYou will receive order notifications on this number.';
      const encodedMessage = encodeURIComponent(testMessage);
      const url = `${this.baseURL}?phone=${this.formatPhoneForApi(phoneNumber)}&text=${encodedMessage}&apikey=${apiKey}`;
      
      const response = await axios.get(url, { timeout: 10000 });
      
      return {
        success: true,
        message: 'API key verified successfully',
        data: response.data
      };
    } catch (error) {
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