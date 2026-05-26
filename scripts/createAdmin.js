/* ============================================
   Admin Seeder Script
   Usage: node scripts/createAdmin.js
   ============================================ */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ isAdmin: true });
  if (existing) {
    console.log('✅ Admin already exists:', existing.email);
    process.exit(0);
  }
  const admin = await User.create({
    firstName: 'Saurab',
    lastName: 'Admin',
    username: 'saurab_admin',
    email: process.env.ADMIN_EMAIL || 'admin@learnwithsaurab.com',
    mobile: '9800000000',
    password: process.env.ADMIN_PASS || 'Admin@1234',
    isAdmin: true,
    isVerified: true
  });
  console.log('🎉 Admin created!');
  console.log('   Email:', admin.email);
  console.log('   Password:', process.env.ADMIN_PASS || 'Admin@1234');
  console.log('   Login at: /login');
  process.exit(0);
}

createAdmin().catch(err => { console.error(err); process.exit(1); });
