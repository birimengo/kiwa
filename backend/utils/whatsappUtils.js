const User = require('../models/User');

class WhatsAppUtils {
  // Get all admin users who should receive WhatsApp notifications
  static async getAdminRecipients() {
    try {
      const adminUsers = await User.getWhatsAppAdminUsers();
      
      // Filter users with valid phone numbers
      const recipients = adminUsers.filter(user => {
        return user.phone && 
               user.phone.trim() !== '' &&
               user.isActive &&
               user.whatsappSettings.enabled;
      });
      
      console.log(`📱 Found ${recipients.length} admin users for WhatsApp notifications`);
      return recipients;
      
    } catch (error) {
      console.error('❌ Error getting WhatsApp recipients:', error);
      return [];
    }
  }
  
  // Validate phone number for a user
  static validateUserPhone(userId, phoneNumber) {
    const user = new User({ phone: phoneNumber });
    return user.validateSync('phone') === undefined;
  }
  
  // Get WhatsApp statistics
  static async getWhatsAppStats() {
    try {
      const totalAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      const whatsappEnabled = await User.countDocuments({
        role: 'admin',
        isActive: true,
        'whatsappSettings.enabled': true,
        phone: { $exists: true, $ne: '' }
      });
      const whatsappVerified = await User.countDocuments({
        role: 'admin',
        isActive: true,
        'whatsappSettings.verified': true
      });
      
      // Get top users by notification count
      const topUsers = await User.find({
        role: 'admin',
        isActive: true,
        'whatsappSettings.notificationCount': { $gt: 0 }
      })
      .sort({ 'whatsappSettings.notificationCount': -1 })
      .limit(5)
      .select('name phone whatsappSettings.notificationCount whatsappSettings.lastNotificationSent');
      
      return {
        totalAdmins,
        whatsappEnabled,
        whatsappVerified,
        coveragePercentage: totalAdmins > 0 ? Math.round((whatsappEnabled / totalAdmins) * 100) : 0,
        topUsers
      };
      
    } catch (error) {
      console.error('❌ Error getting WhatsApp stats:', error);
      return null;
    }
  }
  
  // Send bulk WhatsApp notifications
  static async sendBulkNotification(recipients, message, type = 'notification') {
    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (const recipient of recipients) {
      try {
        // Format message with user name if available
        let personalizedMessage = message;
        if (recipient.name) {
          personalizedMessage = personalizedMessage.replace(/{{name}}/g, recipient.name);
        }
        
        // Here you would call your actual WhatsApp sending function
        // For now, we'll just simulate it
        console.log(`📱 Sending ${type} to ${recipient.name} (${recipient.phone})`);
        
        // Simulate sending
        const success = true; // Replace with actual WhatsApp sending logic
        
        if (success) {
          results.successful++;
          // Update user's notification count
          await recipient.incrementNotificationCount();
        } else {
          results.failed++;
          results.errors.push({
            user: recipient.name,
            phone: recipient.phone,
            error: 'Failed to send'
          });
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          user: recipient.name || 'Unknown',
          phone: recipient.phone || 'Unknown',
          error: error.message
        });
        console.error(`❌ Error sending to ${recipient.name}:`, error);
      }
    }
    
    return results;
  }
}

module.exports = WhatsAppUtils;