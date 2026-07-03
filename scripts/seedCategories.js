/* ============================================
   Seed correct exam categories for Nepal
   Usage: node scripts/seedCategories.js
   ============================================ */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const categories = [
  {
    name: 'CEE — Medical & Paramedical',
    slug: 'cee-medical',
    icon: 'fas fa-stethoscope',
    color: '#00D4FF',
    description: 'One CEE entrance for MBBS, BDS, BSc Nursing & B.Pharmacy — choose your target program inside the course',
    subjects: ['MBBS', 'BDS', 'BSc Nursing', 'B.Pharmacy', 'Biology', 'Chemistry', 'Physics', 'English'],
    isVisible: true,
    order: 1
  },
  {
    name: 'CEE — BNS (B.N.Sc.)',
    slug: 'cee-bns',
    icon: 'fas fa-heart-pulse',
    color: '#EC4899',
    description: 'Bachelor of Nursing Science (BNS) — a separate CEE entrance exam, distinct from Medical & Paramedical',
    subjects: ['Biology', 'Chemistry', 'Physics', 'English'],
    isVisible: true,
    order: 2
  },
  {
    name: 'IOE — Engineering',
    slug: 'ioe-engineering',
    icon: 'fas fa-microchip',
    color: '#7C3AED',
    description: 'Institute of Engineering entrance exam — BE, B.Arch, BEI programs',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'],
    isVisible: true,
    order: 3
  },
  {
    name: 'Loksewa / लोकसेवा',
    slug: 'loksewa',
    icon: 'fas fa-landmark',
    color: '#F59E0B',
    description: 'Nepal Public Service Commission exams — all levels and services',
    subjects: ['GK / सामान्य ज्ञान', 'Current Affairs', 'IQ / Reasoning', 'Nepal Constitution', 'Local Government', 'Subject Fundamentals'],
    isVisible: true,
    order: 4
  },
  {
    name: 'License Exams',
    slug: 'license',
    icon: 'fas fa-id-card',
    color: '#10B981',
    description: 'Professional registration/license exams for healthcare fields',
    subjects: ['Nursing License (NLEN)', 'CMLT License (NHPC)', 'Pharmacy License (NPC)', 'HA License (NHPC)'],
    isVisible: true,
    order: 5
  },
  {
    name: 'SEE, Grade 11 & 12',
    slug: 'see-neb',
    icon: 'fas fa-school',
    color: '#F97316',
    description: 'SEE (Grade 10), Grade 11 & Grade 12 preparation — Science & Management streams',
    subjects: ['SEE — Grade 10', 'Grade 11', 'Grade 12', 'Science Stream', 'Management Stream'],
    isVisible: true,
    order: 6
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const cat of categories) {
    const existing = await Category.findOne({ slug: cat.slug });
    if (existing) {
      await Category.findOneAndUpdate({ slug: cat.slug }, cat);
      console.log(`✅ Updated: ${cat.name}`);
    } else {
      await Category.create(cat);
      console.log(`🆕 Created: ${cat.name}`);
    }
  }

  console.log('\n🎉 Categories seeded successfully!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
