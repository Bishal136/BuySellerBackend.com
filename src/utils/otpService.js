const OTP = require('../models/OTP');
const sendEmail = require('./sendEmail');

// Generate OTP (6 digits)
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate Professional Email Template
const generateEmailTemplate = (otp, purpose) => {
  const purposeText = purpose.charAt(0).toUpperCase() + purpose.slice(1);
  const currentYear = new Date().getFullYear();
  
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
      <h2 style="margin-top: 0; color: #2d3748;">Hello,</h2>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.6;">
        You requested an OTP for <strong style="color: #667eea;">${purposeText}</strong> on ShopHub.
      </p>
      
      <p style="font-size: 16px; color: #4a5568; line-height: 1.6;">
        Use the following code to complete your verification:
      </p>
      
      <div style="
        background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
        padding: 25px 20px;
        text-align: center;
        margin: 30px 0;
        border-radius: 12px;
        border: 2px dashed #667eea;
        font-family: 'Courier New', Courier, monospace;
      ">
        <span style="
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 12px;
          color: #667eea;
        ">${otp}</span>
      </div>
      
      <div style="
        background: #fff5f5;
        border-left: 4px solid #fc8181;
        padding: 12px 15px;
        margin: 20px 0;
        border-radius: 4px;
      ">
        <p style="margin: 0; color: #c53030; font-size: 14px;">
          ⚠️ <strong>Security Warning:</strong> Never share this OTP with anyone. 
          Our team will never ask for your OTP.
        </p>
      </div>
      
      <p style="text-align: center; color: #718096; font-size: 14px; margin: 20px 0;">
        ⏰ This OTP is valid for <strong>10 minutes</strong>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
      
      <p style="color: #a0aec0; font-size: 14px; text-align: center;">
        If you didn't request this OTP, please ignore this email or contact our support team immediately.
      </p>
      
      <p style="color: #a0aec0; font-size: 13px; text-align: center; margin-top: 15px;">
        © ${currentYear} ShopHub. All rights reserved.<br>
        This is an automated message, please do not reply.
      </p>
    </div>
  `;
};

// Send OTP via Email
const sendOTPByEmail = async (email, otp, purpose) => {
  const subject = `Your OTP for ${purpose} - ShopHub`;
  const message = generateEmailTemplate(otp, purpose);

  await sendEmail({
    email,
    subject,
    message,
  });

  console.log(`[OTP] Email sent to ${email}`);
};

// Create and send OTP
const createAndSendOTP = async (email, purpose, phone = null) => {
  try {
    // Delete any existing unused OTPs for this email and purpose
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
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send OTP via email (don't await to improve response time)
    sendOTPByEmail(email, otp, purpose).catch(err => {
      console.error('[OTP] Email sending failed:', err.message);
    });

    return { 
      success: true, 
      message: 'OTP sent successfully. Please check your email.' 
    };
  } catch (error) {
    console.error('[OTP] Error:', error);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

// Verify OTP
const verifyOTP = async (email, otp, purpose) => {
  try {
    console.log(`[OTP] Verifying OTP for ${email}`);

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
        return { 
          success: false, 
          message: 'OTP has expired. Please request a new one.' 
        };
      }

      console.log(`[OTP] Invalid OTP for ${email}`);
      return { 
        success: false, 
        message: 'Invalid OTP. Please try again.' 
      };
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    console.log(`[OTP] OTP verified successfully for ${email}`);
    return { 
      success: true, 
      message: 'OTP verified successfully' 
    };
  } catch (error) {
    console.error('[OTP] Verification error:', error);
    return { 
      success: false, 
      message: 'Failed to verify OTP. Please try again.' 
    };
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
      const waitTime = 30 - Math.floor((Date.now() - recentOTP.createdAt) / 1000);
      return { 
        success: false, 
        message: `Please wait ${waitTime} seconds before requesting another OTP` 
      };
    }

    return await createAndSendOTP(email, purpose, phone);
  } catch (error) {
    console.error('[OTP] Resend error:', error);
    throw new Error('Failed to resend OTP');
  }
};

// Clean up expired OTPs (call this periodically)
const cleanupExpiredOTPs = async () => {
  try {
    const result = await OTP.deleteMany({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { isUsed: true, createdAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    });
    
    if (result.deletedCount > 0) {
      console.log(`[OTP] Cleaned up ${result.deletedCount} expired OTPs`);
    }
  } catch (error) {
    console.error('[OTP] Cleanup error:', error);
  }
};

module.exports = {
  createAndSendOTP,
  verifyOTP,
  resendOTP,
  generateOTP,
  cleanupExpiredOTPs,
};