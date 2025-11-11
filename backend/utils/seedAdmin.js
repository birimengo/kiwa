const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await connectDB();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'gogreenuganda70@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'admin@ham',
      role: 'admin',
      phone: '+256754535493'
    });

    console.log('✅ Admin user created successfully:');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password:', process.env.ADMIN_PASSWORD || 'admin@ham');
    console.log('⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();