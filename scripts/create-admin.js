// scripts/create-admin.js
// Run with: node scripts/create-admin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration
const ADMIN_EMAIL = 'admin@shophub.com';
const ADMIN_NAME = 'Super Admin';
const ADMIN_PHONE = '+8801234567890';

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  role: String,
  isVerified: Boolean,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
});

const adminSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: String,
  permissions: [String],
  isActive: Boolean,
  lastLogin: Date
});

const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    let admin = await User.findOne({ email: ADMIN_EMAIL });

    if (admin) {
      console.log(`⚠️  Admin with email ${ADMIN_EMAIL} already exists!`);
      console.log(`User ID: ${admin._id}`);
      console.log(`Role: ${admin.role}`);
      
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        await admin.save();
        console.log(`✅ Updated user role to admin`);
      }
    } else {
      // Create new admin user
      admin = await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        role: 'admin',
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Admin user created successfully!`);
      console.log(`User ID: ${admin._id}`);
      console.log(`Email: ${ADMIN_EMAIL}`);
      console.log(`Name: ${ADMIN_NAME}`);
    }

    // Create admin profile
    let adminProfile = await Admin.findOne({ user: admin._id });
    
    if (!adminProfile) {
      await Admin.create({
        user: admin._id,
        role: 'super_admin',
        permissions: [
          'manage_users',
          'manage_sellers',
          'manage_products',
          'manage_orders',
          'manage_categories',
          'manage_settings',
          'manage_coupons',
          'view_analytics',
          'manage_banners',
          'manage_announcements',
          'view_audit_logs'
        ],
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Admin profile created successfully!`);
    } else {
      console.log(`ℹ️  Admin profile already exists`);
    }

    console.log('\n=========================================');
    console.log('✅ ADMIN CREATED SUCCESSFULLY!');
    console.log('=========================================');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Name: ${ADMIN_NAME}`);
    console.log(`Role: admin`);
    console.log(`Status: Active`);
    console.log('\nYou can now login with OTP using this email.');
    console.log('=========================================');

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

createAdmin();