const emailjs = require('@emailjs/nodejs');

const sendEmail = async (options) => {
  try {
    console.log('📧 Sending email to:', options.email);
    
    const templateParams = {
      to_email: options.email,
      subject: options.subject || 'Your OTP Code',
      message: options.message || '',  // Pass the full HTML message
    };

    console.log('Sending email with subject:', templateParams.subject);

    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    console.log('✅ Email sent! Status:', response.status);
    return response;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

module.exports = sendEmail;