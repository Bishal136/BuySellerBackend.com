const emailjs = require('@emailjs/nodejs');

const sendEmail = async (options) => {
  try {
    console.log('📧 Sending email to:', options.email);
    console.log('OTP value:', options.otp);
    console.log('All options:', options);
    
    // FORCE the OTP into subject line (guaranteed to show)
    const emailSubject = options.subject || 'Your OTP Code';
    const subjectWithOTP = options.otp 
      ? `${emailSubject} - OTP: ${options.otp}` 
      : emailSubject;
    
    const templateParams = {
      to_email: options.email,
      subject: subjectWithOTP,  // OTP will show in subject
      otp: options.otp || 'NO OTP PROVIDED',
      code: options.otp,
      otp_code: options.otp,
      message: options.otp 
        ? `<h1 style="font-size:40px;color:#667eea;">${options.otp}</h1>` 
        : '<p>OTP missing</p>',
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

    console.log('✅ Email sent! Status:', response.status);
    return response;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

module.exports = sendEmail;