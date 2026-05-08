const emailjs = require('@emailjs/nodejs');

const sendEmail = async (options) => {
  try {
    const { email, subject, message } = options;
    
    // Validation
    if (!email) throw new Error('Recipient email is required');
    if (!message) throw new Error('Email message is required');

    console.log(`📧 Sending email to: ${email}`);

    const templateParams = {
      to_email: email,
      subject: subject || 'ShopHub Notification',
      message: message,
      year: new Date().getFullYear(),
    };

    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    if (response.status === 200) {
      console.log(`✅ Email sent successfully to ${email}`);
      return { success: true, messageId: response.id };
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Email Error:', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = sendEmail;