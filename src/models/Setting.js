const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  general: {
    siteName: { type: String, default: 'ShopHub' },
    siteDescription: { type: String, default: 'Multi-vendor Ecommerce Platform' },
    contactEmail: { type: String, default: 'support@shophub.com' },
    contactPhone: { type: String, default: '+8801234567890' },
    address: { type: String, default: '123 Business Street, Dhaka, Bangladesh' }
  },
  email: {
    smtpHost: { type: String, default: 'smtp.gmail.com' },
    smtpPort: { type: String, default: '587' },
    smtpUser: { type: String, default: '' },
    smtpPassword: { type: String, default: '' },
    fromEmail: { type: String, default: 'noreply@shophub.com' },
    fromName: { type: String, default: 'ShopHub' }
  },
  payment: {
    currency: { type: String, default: 'USD' },
    currencySymbol: { type: String, default: '$' },
    stripePublicKey: { type: String, default: '' },
    stripeSecretKey: { type: String, default: '' },
    bKashNumber: { type: String, default: '' },
    nagadNumber: { type: String, default: '' }
  },
  social: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    github: { type: String, default: '' }
  },
  security: {
    sessionTimeout: { type: Number, default: 60 },
    maxLoginAttempts: { type: Number, default: 5 },
    twoFactorAuth: { type: Boolean, default: false },
    recaptchaEnabled: { type: Boolean, default: false },
    recaptchaSiteKey: { type: String, default: '' },
    recaptchaSecretKey: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
