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
    color: '#0E7C72',
    description: 'One CEE entrance for MBBS, BDS, BSc Nursing, B.Pharmacy & Paramedic — choose your target program inside the course. No Math.',
    subjects: ['MBBS', 'BDS', 'BSc Nursing', 'B.Pharmacy', 'Paramedic/BSc MLT', 'Biology', 'Chemistry', 'Physics', 'English'],
    isVisible: true,
    order: 1
  },
  {
    name: 'CEE — BNS (B.N.Sc.)',
    slug: 'cee-bns',
    icon: 'fas fa-heart-pulse',
    color: '#2F7D6C',
    description: 'Bachelor of Nursing Science (BNS) — a separate CEE entrance exam under TU, distinct from Medical & Paramedical. Subjects: Biology, Chemistry, Physics.',
    subjects: ['Biology', 'Chemistry', 'Physics'],
    isVisible: true,
    order: 2
  },
  {
    name: 'IOE — Engineering',
    slug: 'ioe-engineering',
    icon: 'fas fa-microchip',
    color: '#3A6A8A',
    description: 'Institute of Engineering entrance exam — BE, B.Arch, BEI programs under TU.',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'],
    isVisible: true,
    order: 3
  },
  {
    name: 'Loksewa / लोकसेवा',
    slug: 'loksewa',
    icon: 'fas fa-landmark',
    color: '#B9852D',
    description: 'Nepal Public Service Commission (PSC) exams — all levels and services. GK, Current Affairs, IQ, Constitution.',
    subjects: ['GK / सामान्य ज्ञान', 'Current Affairs', 'IQ / बौद्धिक क्षमता', 'Nepal Constitution', 'Administration'],
    isVisible: true,
    order: 4
  },
  {
    name: 'License Exams',
    slug: 'license',
    icon: 'fas fa-id-card',
    color: '#A14A4A',
    description: 'Professional registration license exams for healthcare workers — NNC, NHPC, NPC official license exams.',
    subjects: ['Nursing License Exam (NNC)', 'CMLT License Exam (NHPC)', 'Pharmacy License Exam (NPC)', 'HA License Exam (NHPC)'],
    isVisible: true,
    order: 5
  },
  {
    name: 'SEE, Grade 11 & 12',
    slug: 'see-neb',
    icon: 'fas fa-school',
    color: '#4A6B5A',
    description: 'SEE (Grade 10), Grade 11 & Grade 12 preparation — Science & Management streams can be added per course.',
    subjects: ['SEE — Grade 10', 'Grade 11', 'Grade 12'],
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
      console.log(`✅ Updated: ${cat.name} → ${cat.color}`);
    } else {
      await Category.create(cat);
      console.log(`🆕 Created: ${cat.name} → ${cat.color}`);
    }
  }

  console.log('\n🎉 Categories seeded successfully!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
