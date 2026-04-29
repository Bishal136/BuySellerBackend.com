const OTP = require('../models/OTP');
const sendEmail = require('./sendEmail');

// Generate OTP (6 digits)
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Email
const sendOTPByEmail = async (email, otp, purpose) => {
  const subject = `Your OTP for ${purpose} - ShopHub`;
  
  const message = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .content {
          padding: 40px 30px;
        }
        .otp-box {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 10px;
          color: #333;
          border-radius: 10px;
          margin: 20px 0;
          border: 2px dashed #667eea;
        }
        .button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          display: inline-block;
          margin: 20px 0;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Email Verification</h1>
        </div>
        <div class="content">
          <h2>Hello,</h2>
          <p>You requested an OTP for <strong>${purpose}</strong> on ShopHub.</p>
          <p>Use the following code to complete your verification:</p>
          <div class="otp-box">
            ${otp}
          </div>
          <p style="text-align: center;">This OTP is valid for <strong>10 minutes</strong>.</p>
          <p style="text-align: center;">If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 ShopHub. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    email,
    subject,
    message,
  });
};

// Create and send OTP
const createAndSendOTP = async (email, purpose, phone = null) => {
  try {
    // Delete any existing unused OTPs
    await OTP.deleteMany({ 
      email, 
      purpose, 
      isUsed: false 
    });

    // Generate new OTP
    const otp = generateOTP();
    
    console.log(`[OTP] Generated OTP for ${email}: ${otp}`);

    // Save OTP to database
    await OTP.create({
      email,
      otp,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send OTP via email
    await sendOTPByEmail(email, otp, purpose);
    console.log(`[OTP] Email sent to ${email}`);

    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('[OTP] Error:', error);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

// Verify OTP
const verifyOTP = async (email, otp, purpose) => {
  try {
    console.log(`[OTP] Verifying OTP for ${email}: ${otp}`);

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      // Check if OTP exists but expired
      const expiredOTP = await OTP.findOne({
        email,
        otp,
        purpose,
        isUsed: false,
        expiresAt: { $lte: new Date() },
      });

      if (expiredOTP) {
        console.log(`[OTP] OTP expired for ${email}`);
        return { success: false, message: 'OTP has expired. Please request a new one.' };
      }

      console.log(`[OTP] Invalid OTP for ${email}`);
      return { success: false, message: 'Invalid OTP' };
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    console.log(`[OTP] OTP verified successfully for ${email}`);
    return { success: true, message: 'OTP verified successfully' };
  } catch (error) {
    console.error('[OTP] Verification error:', error);
    return { success: false, message: 'Failed to verify OTP' };
  }
};

// Resend OTP
const resendOTP = async (email, purpose, phone = null) => {
  try {
    // Check if there's a recent OTP (within last 30 seconds)
    const recentOTP = await OTP.findOne({
      email,
      purpose,
      createdAt: { $gt: new Date(Date.now() - 30 * 1000) },
    });

    if (recentOTP) {
      return { success: false, message: 'Please wait 30 seconds before requesting another OTP' };
    }

    return await createAndSendOTP(email, purpose, phone);
  } catch (error) {
    console.error('[OTP] Resend error:', error);
    throw new Error('Failed to resend OTP');
  }
};

module.exports = {
  createAndSendOTP,
  verifyOTP,
  resendOTP,
  generateOTP,
};