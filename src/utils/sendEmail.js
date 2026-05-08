const emailjs = require('@emailjs/nodejs');

const sendEmail = async (options) => {
  try {
    console.log('📧 Sending email to:', options.email);
    console.log('OTP value:', options.otp);
    
    // IMPORTANT: Check what your template expects
    const templateParams = {
      to_email: options.email,
      subject: options.subject,
      otp: options.otp,           // The OTP value
      // Also try these if otp doesn't work:
      code: options.otp,          // Backup name
      otp_code: options.otp,      // Another backup
    };

    console.log('Sending params:', templateParams);

    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    console.log('✅ Email sent!', response.status);
    return response;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

module.exports = sendEmail;