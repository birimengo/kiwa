const axios = require('axios');
const crypto = require('crypto');

class WhatsAppService {
  constructor() {
    this.baseURL = 'https://api.callmebot.com/whatsapp.php';
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async sendOrderNotification(whatsappConfig, order, notificationType = 'new_order', note = '') {
    try {
      console.log('\n📱 === WHATSAPP SERVICE START ===');
      console.log('Config received:', {
        phoneNumber: whatsappConfig.phoneNumber ? 'Present' : 'Missing',
        apiKey: whatsappConfig.apiKey ? 'Present' : 'Missing'
      });
      
      const { phoneNumber, apiKey } = whatsappConfig;
      
      if (!phoneNumber || !apiKey) {
        console.log('❌ WhatsApp notification skipped: Missing phone or API key');
        return { 
          success: false, 
          message: 'WhatsApp configuration missing',
          type: notificationType 
        };
      }

      // Validate and format phone number
      const validatedPhone = this.validateAndFormatPhone(phoneNumber);
      if (!validatedPhone.valid) {
        console.error('❌ Invalid phone number:', validatedPhone.error);
        return { 
          success: false, 
          message: validatedPhone.error,
          type: notificationType 
        };
      }

      // Format message
      const message = this.formatOrderMessage(order, notificationType, note);
      console.log('📱 Message length:', message.length, 'characters');
      
      if (message.length > 4096) {
        console.warn('⚠️ WhatsApp message too long, truncating...');
        const truncatedMessage = message.substring(0, 4000) + '\n\n[Message truncated due to length]';
        return await this.sendMessage(validatedPhone.formatted, apiKey, truncatedMessage, notificationType, order.orderNumber);
      }
      
      const result = await this.sendMessage(validatedPhone.formatted, apiKey, message, notificationType, order.orderNumber);
      console.log('📱 === WHATSAPP SERVICE END ===\n');
      return result;
      
    } catch (error) {
      console.error('❌ WhatsApp service error:', error.message);
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
      
      // Build URL - VERY IMPORTANT: CallMeBot expects phone WITHOUT + sign
      const url = `${this.baseURL}?phone=${phoneNumber}&text=${encodedMessage}&apikey=${apiKey}`;
      
      console.log('📱 Making API call to CallMeBot:');
      console.log('   Phone:', phoneNumber);
      console.log('   API Key length:', apiKey.length);
      console.log('   Notification Type:', notificationType);
      console.log('   Order:', orderNumber);
      console.log('   URL (first 100 chars):', url.substring(0, 100) + '...');
      
      // Send request
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'ElectroShop-Backend/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log('✅ WhatsApp API Response:');
      console.log('   Status:', response.status);
      console.log('   Data:', response.data);
      
      return {
        success: true,
        data: response.data,
        type: notificationType,
        orderNumber,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ WhatsApp API Error Details:');
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      
      if (error.response) {
        console.error('   Response Status:', error.response.status);
        console.error('   Response Data:', error.response.data);
      }
      
      if (error.code === 'ECONNABORTED' && retryCount < this.maxRetries) {
        console.log(`🔄 Retry ${retryCount + 1}/${this.maxRetries}`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.sendMessage(phoneNumber, apiKey, message, notificationType, orderNumber, retryCount + 1);
      }
      
      throw error;
    }
  }

  validateAndFormatPhone(phoneNumber) {
    console.log('📱 Validating phone:', phoneNumber);
    
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }
    
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    console.log('📱 After cleaning:', cleaned);
    
    if (cleaned.length < 9 || cleaned.length > 15) {
      return { 
        valid: false, 
        error: `Invalid phone length: ${cleaned.length} digits. Expected 9-15 digits.` 
      };
    }
    
    // FOR UGANDA NUMBERS (Most common case)
    // If it starts with 256 and has 12 digits (256 + 9 digits)
    if (cleaned.startsWith('256') && cleaned.length === 12) {
      console.log('📱 Detected Uganda number with 256 prefix');
      return { 
        valid: true, 
        formatted: cleaned, // CallMeBot expects WITHOUT + sign
        original: phoneNumber 
      };
    }
    
    // If it's 9 digits (local Uganda number)
    if (cleaned.length === 9 && !cleaned.startsWith('0')) {
      console.log('📱 Detected local Uganda number (9 digits)');
      return { 
        valid: true, 
        formatted: '256' + cleaned, // Add Uganda code
        original: phoneNumber 
      };
    }
    
    // If it starts with 0 (local number)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      console.log('📱 Detected local number starting with 0');
      const withoutZero = cleaned.substring(1);
      return { 
        valid: true, 
        formatted: '256' + withoutZero, // Remove 0, add 256
        original: phoneNumber 
      };
    }
    
    // For other international numbers
    console.log('📱 Using as international number');
    return { 
      valid: true, 
      formatted: cleaned, // Use cleaned number
      original: phoneNumber 
    };
  }

  formatPhoneForApi(phoneNumber) {
    const validation = this.validateAndFormatPhone(phoneNumber);
    return validation.valid ? validation.formatted : phoneNumber;
  }

  formatOrderMessage(order, notificationType, note = '') {
    // Format items list
    const itemsList = order.items && order.items.length > 0 ? order.items.map((item, index) => 
      `${index + 1}. ${item.productName || 'Product'} (${item.productBrand || 'No brand'})\n   Qty: ${item.quantity || 0} × UGX ${this.formatCurrency(item.unitPrice || 0)}\n   Total: UGX ${this.formatCurrency(item.totalPrice || 0)}`
    ).join('\n\n') : 'No items';

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
Subtotal: UGX ${this.formatCurrency(order.subtotal || 0)}
Shipping: UGX ${this.formatCurrency(order.shippingFee || 0)}
Tax: UGX ${this.formatCurrency(order.taxAmount || 0)}
*Total: UGX ${this.formatCurrency(order.totalAmount || 0)}*

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

    // Add shipping address
    if (order.shippingAddress) {
      message += `
*🏠 Shipping Address:*
${order.shippingAddress.street || ''}
${order.shippingAddress.city || ''}, ${order.shippingAddress.country || ''}`;
    }

    // Add notes
    if (order.notes && notificationType === 'new_order') {
      message += `
*📝 Customer Notes:*
${order.notes}`;
    }

    // Add order status timeline
    if (notificationType !== 'new_order') {
      message += `
*📊 Order Status:*
${order.orderStatus || 'pending'}`;
      
      if (order.deliveredAt) {
        message += `\nDelivered: ${new Date(order.deliveredAt).toLocaleDateString()}`;
      }
      if (order.confirmedAt) {
        message += `\nConfirmed: ${new Date(order.confirmedAt).toLocaleDateString()}`;
      }
    }

    // Add footer
    const frontendUrl = process.env.FRONTEND_URL || 'https://your-ecommerce.com';
    message += `

*🔗 View Order:*
${frontendUrl}/admin/orders?order=${order.orderNumber}

*🕒 Notification Time:* ${new Date().toLocaleString('en-US', {
  hour12: true,
  hour: '2-digit',
  minute: '2-digit'
})}`;

    return message;
  }

  formatCurrency(amount) {
    if (!amount && amount !== 0) return '0';
    return amount.toLocaleString('en-US');
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
      notes: 'This is a test notification to verify WhatsApp integration',
      createdAt: new Date()
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async verifyApiKey(phoneNumber, apiKey) {
    try {
      console.log('🔐 Verifying API key for:', phoneNumber);
      
      const validation = this.validateAndFormatPhone(phoneNumber);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error
        };
      }
      
      const testMessage = '✅ WhatsApp notifications are working correctly!\n\nThis is a verification message from ElectroShop.\n\nYou will receive order notifications on this number.';
      const encodedMessage = encodeURIComponent(testMessage);
      const url = `${this.baseURL}?phone=${validation.formatted}&text=${encodedMessage}&apikey=${apiKey}`;
      
      console.log('🔐 Verification URL (first 100 chars):', url.substring(0, 100) + '...');
      
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'ElectroShop-Backend/1.0'
        }
      });
      
      console.log('🔐 Verification response:', response.data);
      
      return {
        success: true,
        message: 'API key verified successfully',
        data: response.data
      };
    } catch (error) {
      console.error('🔐 Verification error:', error.message);
      return {
        success: false,
        message: error.message,
        error: error.code
      };
    }
  }

  validatePhoneNumber(phoneNumber) {
    const validation = this.validateAndFormatPhone(phoneNumber);
    return validation.valid;
  }
}

module.exports = new WhatsAppService();