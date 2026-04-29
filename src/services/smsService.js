const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  async sendOTP(phoneNumber, otp) {
    try {
      // For development, log OTP instead of sending actual SMS
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
        return { success: true, message: 'OTP sent (development mode)' };
      }

      // Production: Send actual SMS via Twilio
      if (this.client) {
        const message = await this.client.messages.create({
          body: `Your ShopHub verification code is: ${otp}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber,
        });
        return { success: true, messageId: message.sid };
      } else {
        throw new Error('Twilio not configured');
      }
    } catch (error) {
      console.error('SMS sending failed:', error);
      // Fallback: Return OTP in response for development
      if (process.env.NODE_ENV === 'development') {
        return { success: true, otp, message: 'Development mode - OTP provided' };
      }
      throw new Error('Failed to send OTP');
    }
  }
}

module.exports = new SMSService();