const emailjs = require('@emailjs/nodejs');

const sendEmail = async (options) => {
  try {
    const templateParams = {
      to_email: options.email,
      subject: options.subject,
      otp: options.otp, // Add OTP parameter
      message: options.message, // Keep for flexibility
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

    console.log('Email sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = sendEmail;