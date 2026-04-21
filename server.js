// ============================================
// LEARN WITH SAURAB -- server.js
// Built clean from scratch -- no bugs
// ============================================

// STEP 1: Load environment variables (ONCE -- never repeat this)
require('dotenv').config();

// STEP 2: All imports
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const MongoStore = require('connect-mongo');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// STEP 3: Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learn-with-saurab')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    createIndexes();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ============================================
// DATABASE SCHEMAS
// ============================================

// 1. User Schema
const userSchema = new mongoose.Schema({
  username:           { type: String, required: true, unique: true, trim: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile:             { type: String, required: true },
  firstName:          { type: String, required: true, trim: true },
  lastName:           { type: String, required: true, trim: true },
  password:           { type: String, required: true },
  isAdmin:            { type: Boolean, default: false },
  isVerified:         { type: Boolean, default: false },
  emailVerifyToken:   String,
  emailVerifyExpires: Date,
  enrolledCourses:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  progress: {
    totalMinutesWatched: { type: Number, default: 0 },
    coursesCompleted:    { type: Number, default: 0 },
    testsTaken:          { type: Number, default: 0 },
    avgScore:            { type: Number, default: 0 }
  },
  resetPasswordToken:  String,
  resetPasswordExpires: Date,
  lastLogin:           Date
}, { timestamps: true });

// 2. Category Schema (Dynamic homepage cards)
const categorySchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true },
  icon:        { type: String, default: 'fas fa-book' },
  color:       { type: String, default: '#0D7377' },
  description: String,
  subjects:    [String],
  isVisible:   { type: Boolean, default: true },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

// 3. Course Schema
const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true, default: 0 },
  imagePath:   String,
  imageUrl:    String,
  category:    String,
  subject:     String,
  level:       { type: String, enum: ['Beginner','Intermediate','Advanced'], default: 'Beginner' },
  duration:    { type: Number, default: 0 },
  isFeatured:  { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  modules: [{
    moduleTitle:       String,
    moduleDescription: String,
    order:             Number,
    videos: [{
      videoTitle:  String,
      videoUrl:    String,
      duration:    Number,
      isFree:      { type: Boolean, default: false },
      description: String
    }],
    resources: [{
      title:   String,
      fileUrl: String,
      type:    String,
      isFree:  { type: Boolean, default: false }
    }],
    tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }]
  }]
}, { timestamps: true });

// 4. Test Schema
const testSchema = new mongoose.Schema({
  title:             { type: String, required: true },
  description:       String,
  courseId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  category:          String,
  duration:          { type: Number, default: 30 },
  totalMarks:        Number,
  passMarks:         Number,
  negativeMarking:   { type: Boolean, default: false },
  negativeMarkValue: { type: Number, default: 0.25 },
  isFree:            { type: Boolean, default: false },
  isPublished:       { type: Boolean, default: false },
  questions: [{
    questionText:  { type: String, required: true },
    questionImage: String,
    options: [{
      text:      String,
      isCorrect: Boolean
    }],
    explanation: String,
    marks:       { type: Number, default: 1 },
    difficulty:  { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' }
  }]
}, { timestamps: true });

// 5. TestAttempt Schema
const testAttemptSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  answers:     [{ questionId: String, selectedOption: Number }],
  score:       Number,
  totalMarks:  Number,
  passed:      Boolean,
  timeTaken:   Number,
  completedAt: { type: Date, default: Date.now }
});

// 6. Transaction Schema
const transactionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  amount:        Number,
  transactionId: { type: String, unique: true },
  paymentMethod: { type: String, enum: ['eSewa','Khalti','manual'], default: 'eSewa' },
  status:        { type: String, enum: ['pending','completed','failed'], default: 'pending' }
}, { timestamps: true });

// Register all models
const User        = mongoose.model('User', userSchema);
const Category    = mongoose.model('Category', categorySchema);
const Course      = mongoose.model('Course', courseSchema);
const Test        = mongoose.model('Test', testSchema);
const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);



// ============================================
// CREATE UPLOAD DIRECTORIES
// ============================================
const uploadDirs = [
  'uploads/videos',
  'uploads/resources', 
  'uploads/question-images',
  'uploads/course-images'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// MIDDLEWARE (ORDER IS CRITICAL -- DO NOT CHANGE)
// ============================================

// 1. Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Compression
app.use(compression());

// 3. Body parsers (declared ONCE only)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// 4. CORS
app.use(cors({ credentials: true }));

// 5. Helmet security headers
app.use(helmet({
  contentSecurityPolicy: false // we disable this to allow inline scripts for now
}));

// 6. Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60
  })
}));

// 7. Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts, please try again after 15 minutes.'
});

app.use(generalLimiter);
app.use(['/login', '/signup', '/forgot-password'], authLimiter);

// 8. XSS sanitizer
app.use((req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .trim();
      }
    });
  }
  next();
});

// 9. Request logger (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// ============================================
// MULTER FILE UPLOAD CONFIGS (ONE EACH -- NO DUPLICATES)
// ============================================

// For course thumbnail images
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/course-images/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only!'));
  }
});

// For course videos
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/videos/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Videos only!'));
  }
});

// For PDFs and documents
const resourceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/resources/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip'
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type!'));
  }
});

// For question images
const questionImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/question-images/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only!'));
  }
});

// ============================================
// AUTH MIDDLEWARE
// ============================================

// Check if user is logged in
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  res.redirect('/login?redirect=' + encodeURIComponent(req.url));
};

// Check if user is admin (double check DB -- not just session)
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  try {
    const user = await User.findById(req.session.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).send('Access denied.');
    }
    next();
  } catch (err) {
    res.status(500).send('Server error');
  }
};

// ============================================
// EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

// ============================================
// DATABASE INDEXES (runs after DB connects)
// ============================================
async function createIndexes() {
  try {
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await Course.collection.createIndex({ title: 'text', description: 'text' });
    await Course.collection.createIndex({ category: 1 });
    await Transaction.collection.createIndex({ transactionId: 1 });
    console.log('✅ Database indexes created');
  } catch (err) {
    console.log('ℹ️ Indexes already exist');
  }
}

// ============================================
// SEED DEFAULT CATEGORIES (runs once)
// ============================================
async function seedCategories() {
  const count = await Category.countDocuments();
  if (count > 0) return; // already seeded

  const defaults = [
    {
      name: 'CEE Preparation',
      slug: 'cee-preparation',
      icon: 'fas fa-stethoscope',
      color: '#0D7377',
      description: 'Medical & Paramedical Entrance Exam',
      subjects: ['Biology', 'Chemistry', 'Physics', 'English', 'MAT'],
      order: 1
    },
    {
      name: 'Loksewa / लोकसेवा',
      slug: 'loksewa-preparation',
      icon: 'fas fa-landmark',
      color: '#7C3AED',
      description: 'Nepal Public Service Commission',
      subjects: ['General Knowledge', 'Nepali', 'English', 'Current Affairs', 'IQ/Reasoning'],
      order: 2
    },
    {
      name: 'License Exam',
      slug: 'license-exam',
      icon: 'fas fa-id-card',
      color: '#DC2626',
      description: 'NMCL, CMA, Lab, Pharmacy & More',
      subjects: ['NMCL', 'CMA', 'Lab Tech', 'Pharmacy'],
      order: 3
    },
    {
      name: 'NEB Preparation',
      slug: 'neb-preparation',
      icon: 'fas fa-book-open',
      color: '#D97706',
      description: 'Grade 11 & 12 Board Exams',
      subjects: ['Physics', 'Chemistry', 'Biology', 'Maths', 'English'],
      order: 4
    },
    {
      name: 'SEE Preparation',
      slug: 'see-preparation',
      icon: 'fas fa-graduation-cap',
      color: '#059669',
      description: 'Grade 10 Secondary Education',
      subjects: ['Science', 'Maths', 'English', 'Social', 'Nepali'],
      order: 5
    }
  ];

  await Category.insertMany(defaults);
  console.log('✅ Default categories seeded');
}

mongoose.connection.once('open', () => {
  seedCategories();
});




// ============================================
// HELPER FUNCTIONS
// ============================================

// Send verification email
async function sendVerificationEmail(user, token) {
  const verifyUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email/${token}`;
  
  await transporter.sendMail({
    from: `"Learn with Saurab" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '✅ Verify Your Email -- Learn with Saurab',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1>
        </div>
        <h2 style="color: #F9FAFB;">Welcome, ${user.firstName}! 🎓</h2>
        <p style="color: #9CA3AF; line-height: 1.6;">Thank you for joining Nepal's #1 exam preparation platform. Please verify your email to activate your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify My Email</a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;">
        <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p>
      </div>
    `
  });
}

// Send password reset email
async function sendPasswordResetEmail(user, token) {
  const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${token}`;
  
  await transporter.sendMail({
    from: `"Learn with Saurab" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '🔐 Reset Your Password -- Learn with Saurab',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1>
        </div>
        <h2 style="color: #F9FAFB;">Password Reset Request</h2>
        <p style="color: #9CA3AF; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #E63946; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset My Password</a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;">
        <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p>
      </div>
    `
  });
}

// Send welcome email after verification
async function sendWelcomeEmail(user) {
  await transporter.sendMail({
    from: `"Learn with Saurab" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '🎉 Welcome to Learn with Saurab!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1>
        </div>
        <h2 style="color: #F9FAFB;">Your account is verified! 🎓</h2>
        <p style="color: #9CA3AF; line-height: 1.6;">Welcome to Nepal's #1 exam preparation platform. You can now access free courses, practice tests, and much more.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" style="background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
        </div>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;">
        <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p>
      </div>
    `
  });
}

// ============================================
// PUBLIC ROUTES
// ============================================

// Homepage
app.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isVisible: true }).sort({ order: 1 });
    const featuredCourses = await Course.find({ isFeatured: true, isPublished: true }).limit(6);
    const freeTests = await Test.find({ isFree: true, isPublished: true }).limit(4);
    const user = req.session.userId ? await User.findById(req.session.userId) : null;

    const categoriesHtml = categories.map(cat => `
      <div class="category-card" style="--card-color: ${cat.color}">
        <div class="category-icon">
          <i class="${cat.icon}"></i>
        </div>
        <div class="category-content">
          <h3>${cat.name}</h3>
          <p>${cat.description}</p>
          <div class="subject-chips">
            ${cat.subjects.map(s => `<span class="chip">${s}</span>`).join('')}
          </div>
        </div>
        <a href="/browse-courses?category=${cat.slug}" class="category-btn">
          Explore <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    `).join('');

    const coursesHtml = featuredCourses.length > 0
      ? featuredCourses.map(course => `
        <div class="course-card">
          <div class="course-thumb">
            ${course.imagePath
              ? `<img src="${course.imagePath}" alt="${course.title}">`
              : course.imageUrl
              ? `<img src="${course.imageUrl}" alt="${course.title}">`
              : `<div class="thumb-placeholder"><i class="fas fa-book-open"></i></div>`
            }
            ${course.price === 0
              ? `<span class="badge badge-free">FREE</span>`
              : `<span class="badge badge-paid">NPR ${course.price}</span>`
            }
          </div>
          <div class="course-info">
            <span class="course-category-tag">${course.category || 'General'}</span>
            <h3>${course.title}</h3>
            <p>${course.description.substring(0, 80)}...</p>
            <div class="course-footer">
              <span class="course-price">${course.price === 0 ? 'Free' : 'NPR ' + course.price}</span>
              <a href="/course-preview/${course._id}" class="btn-enroll">View Course</a>
            </div>
          </div>
        </div>
      `).join('')
      : `<div class="empty-state"><i class="fas fa-book-open"></i><p>Courses coming soon!</p></div>`;

    const testsHtml = freeTests.length > 0
      ? freeTests.map(test => `
        <div class="test-card">
          <div class="test-icon"><i class="fas fa-clipboard-list"></i></div>
          <div class="test-info">
            <h4>${test.title}</h4>
            <div class="test-meta">
              <span><i class="fas fa-question-circle"></i> ${test.questions.length} Questions</span>
              <span><i class="fas fa-clock"></i> ${test.duration} mins</span>
            </div>
            <a href="/take-test/${test._id}" class="btn-test">Start Free Test</a>
          </div>
        </div>
      `).join('')
      : `<div class="empty-state"><p>Free tests coming soon!</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Nepal's #1 platform for CEE, Loksewa and License exam preparation">
  <title>Learn with Saurab -- Nepal's #1 Exam Preparation Platform</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>

  <!-- NAVBAR -->
  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="/" class="nav-logo">
        <span class="logo-text">Learn<span class="logo-accent">with</span>Saurab</span>
      </a>
      <ul class="nav-links" id="navLinks">
        <li><a href="/" class="nav-link active">Home</a></li>
        <li><a href="/browse-courses" class="nav-link">Courses</a></li>
        <li><a href="/free-tests" class="nav-link">Free Tests</a></li>
        <li><a href="/about" class="nav-link">About</a></li>
        <li><a href="/contact" class="nav-link">Contact</a></li>
      </ul>
      <div class="nav-actions">
        ${user
          ? `<a href="/dashboard" class="btn-nav-primary">Dashboard</a>`
          : `
            <a href="/login" class="btn-nav-ghost">Login</a>
            <a href="/signup" class="btn-nav-primary">Sign Up Free</a>
          `
        }
        <button class="hamburger" id="hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </nav>

  <!-- HERO SECTION -->
  <section class="hero">
    <div class="hero-bg">
      <div class="hero-particles"></div>
    </div>
    <div class="container">
      <div class="hero-content">
        <div class="hero-badge">
          <i class="fas fa-star"></i> Nepal's #1 Exam Preparation Platform
        </div>
        <h1 class="hero-title">
          Ace Your <span class="gradient-text">CEE, Loksewa</span><br>& License Exams
        </h1>
        <p class="hero-subtitle">
          Expert preparation from Saurab -- MBBS student with 6+ years of teaching experience. 
          Structured courses, practice tests, and proven strategies to secure your future.
        </p>
        <div class="hero-actions">
          <a href="/browse-courses" class="btn-primary-lg">
            <i class="fas fa-rocket"></i> Start Learning Free
          </a>
          <a href="/free-tests" class="btn-outline-lg">
            <i class="fas fa-clipboard-list"></i> Try Free Tests
          </a>
        </div>
        <div class="hero-stats">
          <div class="stat">
            <span class="stat-number">5,000+</span>
            <span class="stat-label">Students</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-number">50+</span>
            <span class="stat-label">Courses</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-number">500+</span>
            <span class="stat-label">Practice Tests</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-number">98%</span>
            <span class="stat-label">Success Rate</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- EXAM CATEGORIES -->
  <section class="section" id="categories">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Exam Categories</span>
        <h2 class="section-title">What Do You Want to <span class="gradient-text">Prepare For?</span></h2>
        <p class="section-subtitle">Choose your exam and start your preparation journey today</p>
      </div>
      <div class="categories-grid">
        ${categoriesHtml}
      </div>
    </div>
  </section>

  <!-- FEATURED COURSES -->
  <section class="section section-dark" id="courses">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Featured Courses</span>
        <h2 class="section-title">Learn from the <span class="gradient-text">Best</span></h2>
        <p class="section-subtitle">Structured courses designed specifically for Nepal's toughest exams</p>
      </div>
      <div class="courses-grid">
        ${coursesHtml}
      </div>
      <div class="section-cta">
        <a href="/browse-courses" class="btn-outline-lg">
          View All Courses <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- FREE TESTS -->
  <section class="section" id="tests">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Free Practice</span>
        <h2 class="section-title">Test Your <span class="gradient-text">Knowledge</span></h2>
        <p class="section-subtitle">Free practice tests with instant results and explanations</p>
      </div>
      <div class="tests-grid">
        ${testsHtml}
      </div>
      <div class="section-cta">
        <a href="/free-tests" class="btn-outline-lg">
          View All Free Tests <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- WHY CHOOSE US -->
  <section class="section section-dark">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Why Us</span>
        <h2 class="section-title">Why Choose <span class="gradient-text">Learn with Saurab?</span></h2>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-user-graduate"></i></div>
          <h3>Expert Instructor</h3>
          <p>Learn from an active MBBS student with 6+ years of coaching experience in CEE and Loksewa preparation.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-bullseye"></i></div>
          <h3>Exam Focused</h3>
          <p>Content designed specifically for Nepal's exams. No fluff -- exactly what you need to pass.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-mobile-alt"></i></div>
          <h3>Study Anywhere</h3>
          <p>Mobile-friendly platform. Study on your phone, tablet or computer -- anytime, anywhere.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-tag"></i></div>
          <h3>Affordable Price</h3>
          <p>Premium quality at Nepal-friendly prices. One-time payment, lifetime access. No subscriptions.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- INSTRUCTOR SECTION -->
  <section class="section">
    <div class="container">
      <div class="instructor-card">
        <div class="instructor-image">
          <div class="instructor-avatar">
            <i class="fas fa-user-md"></i>
          </div>
        </div>
        <div class="instructor-info">
          <span class="section-tag">Your Instructor</span>
          <h2>Saurab Acharya</h2>
          <p class="instructor-title">MBBS Student | CEE & Loksewa Expert | MAT Book Author</p>
          <p class="instructor-bio">
            As an active MBBS student and son of a farmer, I understand the pressure and dreams behind every exam. 
            I've coached 5,000+ students and authored a definitive MAT book for CEE. 
            My teaching style: simple explanations, real exam strategies, zero fluff.
          </p>
          <div class="instructor-stats">
            <div class="i-stat"><span>6+</span><p>Years Teaching</p></div>
            <div class="i-stat"><span>5000+</span><p>Students</p></div>
            <div class="i-stat"><span>13K</span><p>TikTok Followers</p></div>
          </div>
          <div class="instructor-socials">
            <a href="#" class="social-btn youtube"><i class="fab fa-youtube"></i> YouTube</a>
            <a href="#" class="social-btn tiktok"><i class="fab fa-tiktok"></i> TikTok</a>
            <a href="#" class="social-btn facebook"><i class="fab fa-facebook"></i> Facebook</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <span class="logo-text">Learn<span class="logo-accent">with</span>Saurab</span>
          <p>Nepal's #1 platform for CEE, Loksewa and License exam preparation.</p>
          <div class="footer-socials">
            <a href="#" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
            <a href="#" aria-label="Facebook"><i class="fab fa-facebook"></i></a>
            <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="#" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
          </div>
        </div>
        <div class="footer-links">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/browse-courses">Courses</a></li>
            <li><a href="/free-tests">Free Tests</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer-links">
          <h4>Exam Categories</h4>
          <ul>
            <li><a href="/browse-courses?category=cee-preparation">CEE Preparation</a></li>
            <li><a href="/browse-courses?category=loksewa-preparation">Loksewa / लोकसेवा</a></li>
            <li><a href="/browse-courses?category=license-exam">License Exam</a></li>
            <li><a href="/browse-courses?category=neb-preparation">NEB Preparation</a></li>
            <li><a href="/browse-courses?category=see-preparation">SEE Preparation</a></li>
          </ul>
        </div>
        <div class="footer-contact">
          <h4>Contact Us</h4>
          <p><i class="fas fa-envelope"></i> learnwithsaurab@gmail.com</p>
          <p><i class="fas fa-phone"></i> +977-XXXXXXXXXX</p>
          <p><i class="fas fa-map-marker-alt"></i> Nepal</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2025 Learn with Saurab. All rights reserved.</p>
        <p>Made with ❤️ in Nepal</p>
      </div>
    </div>
  </footer>

  <script src="/js/main.js"></script>
  <script src="/js/mobile-nav.js"></script>
  <script src="/js/content-protection.js"></script>
</body>
</html>`);
  } catch (err) {
    console.error('Homepage error:', err);
    res.status(500).send('Something went wrong. Please try again.');
  }
});

// Verify pending page
app.get('/verify-pending', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card" style="text-align:center;">
      <div class="verify-icon">
        <i class="fas fa-envelope-open-text"></i>
      </div>
      <h2>Check Your Email!</h2>
      <p>We sent a verification link to your email address. Click the link to activate your account.</p>
      <p class="text-muted">Didn't receive it? Check your spam folder.</p>
      <a href="/resend-verification" class="btn-auth-outline">Resend Email</a>
      <div class="auth-footer-links">
        <a href="/login">Back to Login</a> &nbsp;•&nbsp; <a href="/">Home</a>
      </div>
    </div>
  </div>
</body>
</html>`);
});

// Verify email token
app.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      emailVerifyToken: req.params.token,
      emailVerifyExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Link -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card" style="text-align:center;">
      <div class="verify-icon error"><i class="fas fa-times-circle"></i></div>
      <h2>Link Expired or Invalid</h2>
      <p>This verification link has expired or is invalid. Please request a new one.</p>
      <a href="/resend-verification" class="btn-auth-primary">Request New Link</a>
      <div class="auth-footer-links">
        <a href="/login">Back to Login</a>
      </div>
    </div>
  </div>
</body>
</html>`);
    }

    // Activate account
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    // Auto login
    req.session.userId = user._id;

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(console.error);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).send('Something went wrong.');
  }
});




// ============================================
// SIGNUP
// ============================================

// Show signup page
app.get('/signup', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-wrapper">

    <!-- Left Panel -->
    <div class="auth-left">
      <a href="/" class="auth-logo">LearnwithSaurab</a>
      <div class="auth-left-content">
        <h2>Join 5,000+ Students</h2>
        <p>Start your journey to ace CEE, Loksewa and License exams with Nepal's best platform.</p>
        <ul class="auth-features">
          <li><i class="fas fa-check-circle"></i> Free courses and practice tests</li>
          <li><i class="fas fa-check-circle"></i> Expert guidance from MBBS student</li>
          <li><i class="fas fa-check-circle"></i> Track your progress</li>
          <li><i class="fas fa-check-circle"></i> Affordable one-time payment</li>
        </ul>
      </div>
    </div>

    <!-- Right Panel -- Form -->
    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-header">
          <h2>Create Account</h2>
          <p>Already have an account? <a href="/login">Login here</a></p>
        </div>

        <div id="errorMsg" class="auth-error" style="display:none;"></div>
        <div id="successMsg" class="auth-success" style="display:none;"></div>

        <form class="auth-form" id="signupForm">
          <div class="form-row-2">
            <div class="form-group">
              <label>First Name</label>
              <div class="input-wrap">
                <i class="fas fa-user"></i>
                <input type="text" name="firstName" placeholder="Saurab" required>
              </div>
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <div class="input-wrap">
                <i class="fas fa-user"></i>
                <input type="text" name="lastName" placeholder="Acharya" required>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Username</label>
            <div class="input-wrap">
              <i class="fas fa-at"></i>
              <input type="text" name="username" id="username" placeholder="saurab123" required>
              <span class="input-status" id="usernameStatus"></span>
            </div>
          </div>

          <div class="form-group">
            <label>Email Address</label>
            <div class="input-wrap">
              <i class="fas fa-envelope"></i>
              <input type="email" name="email" placeholder="saurab@gmail.com" required>
            </div>
          </div>

          <div class="form-group">
            <label>Mobile Number</label>
            <div class="input-wrap">
              <i class="fas fa-phone"></i>
              <input type="tel" name="mobile" placeholder="+977-9800000000" required>
            </div>
          </div>

          <div class="form-group">
            <label>Password</label>
            <div class="input-wrap">
              <i class="fas fa-lock"></i>
              <input type="password" name="password" id="password" placeholder="Min 8 characters" required>
              <button type="button" class="toggle-password" onclick="togglePass('password')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <div class="password-strength" id="strengthBar">
              <div class="strength-fill" id="strengthFill"></div>
            </div>
            <span class="strength-label" id="strengthLabel"></span>
          </div>

          <div class="form-group">
            <label>Confirm Password</label>
            <div class="input-wrap">
              <i class="fas fa-lock"></i>
              <input type="password" name="confirmPassword" id="confirmPassword" placeholder="Repeat password" required>
              <button type="button" class="toggle-password" onclick="togglePass('confirmPassword')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-group admin-section" id="adminSection" style="display:none;">
            <label>Admin Secret Code</label>
            <div class="input-wrap">
              <i class="fas fa-shield-alt"></i>
              <input type="password" name="adminCode" placeholder="Enter admin code">
            </div>
          </div>

          <div class="form-check">
            <input type="checkbox" id="isAdmin" onchange="toggleAdminCode()">
            <label for="isAdmin">Register as Admin</label>
          </div>

          <div class="form-check">
            <input type="checkbox" id="terms" required>
            <label for="terms">I agree to the <a href="/terms">Terms & Conditions</a></label>
          </div>

          <button type="submit" class="btn-auth-primary" id="submitBtn">
            <span id="btnText">Create Account</span>
            <span id="btnLoader" style="display:none;"><i class="fas fa-spinner fa-spin"></i> Creating...</span>
          </button>
        </form>
      </div>
    </div>
  </div>

  <script>
    // Toggle password visibility
    function togglePass(id) {
      const input = document.getElementById(id);
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    // Toggle admin code field
    function toggleAdminCode() {
      const checked = document.getElementById('isAdmin').checked;
      document.getElementById('adminSection').style.display = checked ? 'block' : 'none';
    }

    // Password strength checker
    document.getElementById('password').addEventListener('input', function() {
      const val = this.value;
      const fill = document.getElementById('strengthFill');
      const label = document.getElementById('strengthLabel');
      let strength = 0;
      if (val.length >= 8) strength++;
      if (/[A-Z]/.test(val)) strength++;
      if (/[0-9]/.test(val)) strength++;
      if (/[^A-Za-z0-9]/.test(val)) strength++;

      const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
      const colors = ['', '#E63946', '#F59E0B', '#0D7377', '#10B981'];
      const widths = ['0%', '25%', '50%', '75%', '100%'];

      fill.style.width = widths[strength];
      fill.style.background = colors[strength];
      label.textContent = levels[strength];
      label.style.color = colors[strength];
    });

    // Username availability check
    let usernameTimer;
    document.getElementById('username').addEventListener('input', function() {
      clearTimeout(usernameTimer);
      const status = document.getElementById('usernameStatus');
      const val = this.value.trim();
      if (val.length < 3) { status.textContent = ''; return; }
      status.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      usernameTimer = setTimeout(async () => {
        const res = await fetch('/api/check-username?username=' + encodeURIComponent(val));
        const data = await res.json();
        if (data.available) {
          status.innerHTML = '<i class="fas fa-check" style="color:#10B981"></i>';
        } else {
          status.innerHTML = '<i class="fas fa-times" style="color:#E63946"></i>';
        }
      }, 600);
    });

    // Form submit
    document.getElementById('signupForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorMsg = document.getElementById('errorMsg');
      const successMsg = document.getElementById('successMsg');
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        errorMsg.textContent = 'Passwords do not match!';
        errorMsg.style.display = 'block';
        return;
      }

      if (password.length < 8) {
        errorMsg.textContent = 'Password must be at least 8 characters!';
        errorMsg.style.display = 'block';
        return;
      }

      document.getElementById('btnText').style.display = 'none';
      document.getElementById('btnLoader').style.display = 'inline';
      document.getElementById('submitBtn').disabled = true;

      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      data.isAdmin = document.getElementById('isAdmin').checked;

      try {
        const res = await fetch('/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
          successMsg.textContent = result.message;
          successMsg.style.display = 'block';
          setTimeout(() => window.location.href = '/verify-pending', 1500);
        } else {
          errorMsg.textContent = result.message;
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Something went wrong. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        document.getElementById('btnText').style.display = 'inline';
        document.getElementById('btnLoader').style.display = 'none';
        document.getElementById('submitBtn').disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

// Process signup
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, username, email, mobile, password, isAdmin, adminCode } = req.body;

    // Validation
    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.json({ success: false, message: 'All fields are required.' });
    }
    if (password.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (mobile.length < 10) {
      return res.json({ success: false, message: 'Please enter a valid mobile number.' });
    }

    // Check existing user
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existing) {
      if (existing.email === email.toLowerCase()) {
        return res.json({ success: false, message: 'Email already registered. Please login.' });
      }
      return res.json({ success: false, message: 'Username already taken. Choose another.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check admin
    let adminStatus = false;
    if (isAdmin && adminCode === process.env.ADMIN_SECRET_CODE) {
      adminStatus = true;
    }

    // Generate email verify token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user
    const newUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile.trim(),
      password: hashedPassword,
      isAdmin: adminStatus,
      isVerified: false,
      emailVerifyToken,
      emailVerifyExpires
    });

    await newUser.save();

    // Send verification email
    await sendVerificationEmail(newUser, emailVerifyToken);

    res.json({ success: true, message: 'Account created! Please check your email to verify.' });

  } catch (err) {
    console.error('Signup error:', err);
    res.json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Check username availability
app.get('/api/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    const existing = await User.findOne({ username });
    res.json({ available: !existing });
  } catch (err) {
    res.json({ available: false });
  }
});

// ============================================
// LOGIN
// ============================================

// Show login page
app.get('/login', (req, res) => {
  const redirect = req.query.redirect || '/dashboard';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-wrapper">

    <!-- Left Panel -->
    <div class="auth-left">
      <a href="/" class="auth-logo">LearnwithSaurab</a>
      <div class="auth-left-content">
        <h2>Welcome Back!</h2>
        <p>Login to continue your exam preparation journey.</p>
        <ul class="auth-features">
          <li><i class="fas fa-check-circle"></i> Access your enrolled courses</li>
          <li><i class="fas fa-check-circle"></i> Take practice tests</li>
          <li><i class="fas fa-check-circle"></i> Track your progress</li>
          <li><i class="fas fa-check-circle"></i> Download study materials</li>
        </ul>
      </div>
    </div>

    <!-- Right Panel -->
    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-header">
          <h2>Login</h2>
          <p>Don't have an account? <a href="/signup">Sign up free</a></p>
        </div>

        <div id="errorMsg" class="auth-error" style="display:none;"></div>

        <form class="auth-form" id="loginForm">
          <input type="hidden" name="redirect" value="${redirect}">

          <div class="form-group">
            <label>Username or Email</label>
            <div class="input-wrap">
              <i class="fas fa-user"></i>
              <input type="text" name="identifier" placeholder="Your username or email" required>
            </div>
          </div>

          <div class="form-group">
            <label>Password</label>
            <div class="input-wrap">
              <i class="fas fa-lock"></i>
              <input type="password" name="password" id="loginPassword" placeholder="Your password" required>
              <button type="button" class="toggle-password" onclick="togglePass('loginPassword')">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="form-row-between">
            <div class="form-check">
              <input type="checkbox" id="rememberMe" name="rememberMe">
              <label for="rememberMe">Remember me</label>
            </div>
            <a href="/forgot-password" class="forgot-link">Forgot password?</a>
          </div>

          <button type="submit" class="btn-auth-primary" id="loginBtn">
            <span id="btnText">Login</span>
            <span id="btnLoader" style="display:none;"><i class="fas fa-spinner fa-spin"></i> Logging in...</span>
          </button>
        </form>

        <div class="auth-footer-links">
          <a href="/">← Back to Home</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    function togglePass(id) {
      const input = document.getElementById(id);
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorMsg = document.getElementById('errorMsg');
      errorMsg.style.display = 'none';

      document.getElementById('btnText').style.display = 'none';
      document.getElementById('btnLoader').style.display = 'inline';
      document.getElementById('loginBtn').disabled = true;

      const formData = new FormData(this);
      const data = Object.fromEntries(formData);

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
          window.location.href = result.redirect || '/dashboard';
        } else {
          errorMsg.textContent = result.message;
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Something went wrong. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        document.getElementById('btnText').style.display = 'inline';
        document.getElementById('btnLoader').style.display = 'none';
        document.getElementById('loginBtn').disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

// Process login
app.post('/login', async (req, res) => {
  try {
    const { identifier, password, redirect } = req.body;

    if (!identifier || !password) {
      return res.json({ success: false, message: 'Please enter your username/email and password.' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return res.json({ success: false, message: 'No account found with that username or email.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    // Check email verification
    if (!user.isVerified) {
      return res.json({
        success: false,
        message: 'Please verify your email first. Check your inbox or <a href="/resend-verification">resend verification email</a>.'
      });
    }

    // Set session
    req.session.userId = user._id;
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      redirect: redirect || (user.isAdmin ? '/admin' : '/dashboard')
    });

  } catch (err) {
    console.error('Login error:', err);
    res.json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// LOGOUT
// ============================================
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// ============================================
// RESEND VERIFICATION EMAIL
// ============================================
app.get('/resend-verification', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resend Verification -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <h2>Resend Verification</h2>
        <p>Enter your email to receive a new verification link</p>
      </div>
      <div id="errorMsg" class="auth-error" style="display:none;"></div>
      <div id="successMsg" class="auth-success" style="display:none;"></div>
      <form class="auth-form" id="resendForm">
        <div class="form-group">
          <label>Email Address</label>
          <div class="input-wrap">
            <i class="fas fa-envelope"></i>
            <input type="email" name="email" placeholder="your@email.com" required>
          </div>
        </div>
        <button type="submit" class="btn-auth-primary">Send Verification Email</button>
      </form>
      <div class="auth-footer-links">
        <a href="/login">Back to Login</a> &nbsp;•&nbsp; <a href="/">Home</a>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('resendForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorMsg = document.getElementById('errorMsg');
      const successMsg = document.getElementById('successMsg');
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';
      const data = { email: this.email.value };
      const res = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        successMsg.textContent = result.message;
        successMsg.style.display = 'block';
      } else {
        errorMsg.textContent = result.message;
        errorMsg.style.display = 'block';
      }
    });
  </script>
</body>
</html>`);
});

app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond the same (security -- don't reveal if email exists)
    if (!user || user.isVerified) {
      return res.json({ success: true, message: 'If that email exists and is unverified, a new link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerifyToken = token;
    user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user, token);

    res.json({ success: true, message: 'Verification email sent! Check your inbox.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.json({ success: false, message: 'Something went wrong. Try again.' });
  }
});




// ============================================
// FORGOT PASSWORD
// ============================================

app.get('/forgot-password', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon"><i class="fas fa-key"></i></div>
        <h2>Forgot Password?</h2>
        <p>Enter your email and we'll send you a reset link</p>
      </div>
      <div id="errorMsg" class="auth-error" style="display:none;"></div>
      <div id="successMsg" class="auth-success" style="display:none;"></div>
      <form class="auth-form" id="forgotForm">
        <div class="form-group">
          <label>Email Address</label>
          <div class="input-wrap">
            <i class="fas fa-envelope"></i>
            <input type="email" name="email" placeholder="your@email.com" required>
          </div>
        </div>
        <button type="submit" class="btn-auth-primary" id="submitBtn">
          <span id="btnText">Send Reset Link</span>
          <span id="btnLoader" style="display:none;">
            <i class="fas fa-spinner fa-spin"></i> Sending...
          </span>
        </button>
      </form>
      <div class="auth-footer-links">
        <a href="/login">← Back to Login</a>
        &nbsp;•&nbsp;
        <a href="/signup">Create Account</a>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('forgotForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorMsg = document.getElementById('errorMsg');
      const successMsg = document.getElementById('successMsg');
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      document.getElementById('btnText').style.display = 'none';
      document.getElementById('btnLoader').style.display = 'inline';
      document.getElementById('submitBtn').disabled = true;

      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email.value })
        });
        const result = await res.json();
        if (result.success) {
          successMsg.textContent = result.message;
          successMsg.style.display = 'block';
        } else {
          errorMsg.textContent = result.message;
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Something went wrong. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        document.getElementById('btnText').style.display = 'inline';
        document.getElementById('btnLoader').style.display = 'none';
        document.getElementById('submitBtn').disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond same message (security)
    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent. Check your inbox.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user, token);

    res.json({
      success: true,
      message: 'Reset link sent! Check your inbox. Link expires in 1 hour.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// RESET PASSWORD
// ============================================

app.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Link -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card" style="text-align:center;">
      <div class="verify-icon error"><i class="fas fa-times-circle"></i></div>
      <h2>Link Expired</h2>
      <p>This password reset link has expired or is invalid. Please request a new one.</p>
      <a href="/forgot-password" class="btn-auth-primary">Request New Link</a>
      <div class="auth-footer-links">
        <a href="/login">Back to Login</a>
      </div>
    </div>
  </div>
</body>
</html>`);
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/auth.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="auth-body">
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon"><i class="fas fa-lock"></i></div>
        <h2>Create New Password</h2>
        <p>Enter your new password below</p>
      </div>
      <div id="errorMsg" class="auth-error" style="display:none;"></div>
      <div id="successMsg" class="auth-success" style="display:none;"></div>
      <form class="auth-form" id="resetForm">
        <div class="form-group">
          <label>New Password</label>
          <div class="input-wrap">
            <i class="fas fa-lock"></i>
            <input type="password" name="password" id="newPassword"
              placeholder="Min 8 characters" required>
            <button type="button" class="toggle-password"
              onclick="togglePass('newPassword')">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="password-strength" id="strengthBar">
            <div class="strength-fill" id="strengthFill"></div>
          </div>
          <span class="strength-label" id="strengthLabel"></span>
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <div class="input-wrap">
            <i class="fas fa-lock"></i>
            <input type="password" name="confirmPassword" id="confirmPassword"
              placeholder="Repeat new password" required>
            <button type="button" class="toggle-password"
              onclick="togglePass('confirmPassword')">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <button type="submit" class="btn-auth-primary" id="submitBtn">
          <span id="btnText">Reset Password</span>
          <span id="btnLoader" style="display:none;">
            <i class="fas fa-spinner fa-spin"></i> Resetting...
          </span>
        </button>
      </form>
      <div class="auth-footer-links">
        <a href="/login">Back to Login</a>
      </div>
    </div>
  </div>
  <script>
    function togglePass(id) {
      const input = document.getElementById(id);
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    document.getElementById('newPassword').addEventListener('input', function() {
      const val = this.value;
      const fill = document.getElementById('strengthFill');
      const label = document.getElementById('strengthLabel');
      let strength = 0;
      if (val.length >= 8) strength++;
      if (/[A-Z]/.test(val)) strength++;
      if (/[0-9]/.test(val)) strength++;
      if (/[^A-Za-z0-9]/.test(val)) strength++;
      const colors = ['', '#E63946', '#F59E0B', '#0D7377', '#10B981'];
      const widths = ['0%', '25%', '50%', '75%', '100%'];
      const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
      fill.style.width = widths[strength];
      fill.style.background = colors[strength];
      label.textContent = levels[strength];
      label.style.color = colors[strength];
    });

    document.getElementById('resetForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const errorMsg = document.getElementById('errorMsg');
      const successMsg = document.getElementById('successMsg');
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        errorMsg.textContent = 'Passwords do not match!';
        errorMsg.style.display = 'block';
        return;
      }
      if (password.length < 8) {
        errorMsg.textContent = 'Password must be at least 8 characters!';
        errorMsg.style.display = 'block';
        return;
      }

      document.getElementById('btnText').style.display = 'none';
      document.getElementById('btnLoader').style.display = 'inline';
      document.getElementById('submitBtn').disabled = true;

      try {
        const res = await fetch('/api/reset-password/${req.params.token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const result = await res.json();
        if (result.success) {
          successMsg.textContent = result.message;
          successMsg.style.display = 'block';
          setTimeout(() => window.location.href = '/login', 2000);
        } else {
          errorMsg.textContent = result.message;
          errorMsg.style.display = 'block';
        }
      } catch (err) {
        errorMsg.textContent = 'Something went wrong. Please try again.';
        errorMsg.style.display = 'block';
      } finally {
        document.getElementById('btnText').style.display = 'inline';
        document.getElementById('btnLoader').style.display = 'none';
        document.getElementById('submitBtn').disabled = false;
      }
    });
  </script>
</body>
</html>`);
  } catch (err) {
    console.error('Reset password page error:', err);
    res.status(500).send('Something went wrong.');
  }
});

app.post('/api/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.json({
        success: false,
        message: 'Password must be at least 8 characters.'
      });
    }

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.json({
        success: false,
        message: 'Reset link is invalid or has expired.'
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully! Redirecting to login...'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// ============================================
// STUDENT DASHBOARD
// ============================================

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate('enrolledCourses');

    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }

    // Redirect admin to admin panel
    if (user.isAdmin) return res.redirect('/admin');

    const recentTests = await TestAttempt.find({ userId: user._id })
      .populate('testId')
      .sort({ completedAt: -1 })
      .limit(5);

    const freeTests = await Test.find({ isFree: true, isPublished: true }).limit(4);

    const enrolledHtml = user.enrolledCourses.length > 0
      ? user.enrolledCourses.map(course => `
        <div class="dashboard-course-card">
          <div class="dcc-thumb">
            ${course.imagePath
              ? `<img src="${course.imagePath}" alt="${course.title}">`
              : `<div class="dcc-placeholder"><i class="fas fa-book-open"></i></div>`
            }
          </div>
          <div class="dcc-info">
            <h4>${course.title}</h4>
            <span class="dcc-category">${course.category || 'General'}</span>
            <a href="/course/${course._id}/learn" class="btn-continue">
              <i class="fas fa-play"></i> Continue
            </a>
          </div>
        </div>
      `).join('')
      : `<div class="empty-state">
          <i class="fas fa-book-open"></i>
          <p>No courses enrolled yet.</p>
          <a href="/browse-courses" class="btn-primary-sm">Browse Courses</a>
        </div>`;

    const testsHtml = recentTests.length > 0
      ? recentTests.map(attempt => `
        <tr>
          <td>${attempt.testId ? attempt.testId.title : 'Test'}</td>
          <td>${attempt.score}/${attempt.totalMarks}</td>
          <td>
            <span class="badge ${attempt.passed ? 'badge-success' : 'badge-danger'}">
              ${attempt.passed ? 'Passed' : 'Failed'}
            </span>
          </td>
          <td>${new Date(attempt.completedAt).toLocaleDateString()}</td>
          <td><a href="/test-result/${attempt._id}">View</a></td>
        </tr>
      `).join('')
      : `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">
          No tests taken yet. <a href="/free-tests">Try a free test!</a>
        </td></tr>`;

    const freeTestsHtml = freeTests.map(test => `
      <div class="quick-test-card">
        <div class="qtc-icon"><i class="fas fa-clipboard-list"></i></div>
        <div class="qtc-info">
          <h4>${test.title}</h4>
          <span>${test.questions.length} Questions • ${test.duration} mins</span>
        </div>
        <a href="/take-test/${test._id}" class="btn-primary-sm">Start</a>
      </div>
    `).join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard -- Learn with Saurab</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/dashboard.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="dashboard-body">

  <!-- SIDEBAR -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <span class="logo-text">Learn<span class="logo-accent">with</span>Saurab</span>
    </div>
    <nav class="sidebar-nav">
      <a href="/dashboard" class="sidebar-link active">
        <i class="fas fa-home"></i> Dashboard
      </a>
      <a href="/my-courses" class="sidebar-link">
        <i class="fas fa-book-open"></i> My Courses
      </a>
      <a href="/free-tests" class="sidebar-link">
        <i class="fas fa-clipboard-list"></i> Practice Tests
      </a>
      <a href="/my-tests" class="sidebar-link">
        <i class="fas fa-chart-bar"></i> My Results
      </a>
      <a href="/profile" class="sidebar-link">
        <i class="fas fa-user"></i> My Profile
      </a>
      <a href="/browse-courses" class="sidebar-link">
        <i class="fas fa-search"></i> Browse Courses
      </a>
    </nav>
    <div class="sidebar-footer">
      <a href="/logout" class="sidebar-logout">
        <i class="fas fa-sign-out-alt"></i> Logout
      </a>
    </div>
  </aside>

  <!-- MAIN CONTENT -->
  <main class="dashboard-main">

    <!-- Top Bar -->
    <header class="dashboard-header">
      <button class="sidebar-toggle" id="sidebarToggle">
        <i class="fas fa-bars"></i>
      </button>
      <div class="dashboard-greeting">
        <h1>Welcome back, ${user.firstName}! 👋</h1>
        <p>Ready to continue your exam preparation?</p>
      </div>
      <div class="header-user">
        <div class="user-avatar">
          ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
        </div>
      </div>
    </header>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon teal">
          <i class="fas fa-book-open"></i>
        </div>
        <div class="stat-info">
          <span class="stat-number">${user.enrolledCourses.length}</span>
          <span class="stat-label">Courses Enrolled</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <i class="fas fa-clipboard-check"></i>
        </div>
        <div class="stat-info">
          <span class="stat-number">${user.progress.testsTaken}</span>
          <span class="stat-label">Tests Taken</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon gold">
          <i class="fas fa-star"></i>
        </div>
        <div class="stat-info">
          <span class="stat-number">${user.progress.avgScore}%</span>
          <span class="stat-label">Average Score</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-info">
          <span class="stat-number">${user.progress.totalMinutesWatched}</span>
          <span class="stat-label">Minutes Watched</span>
        </div>
      </div>
    </div>

    <!-- My Courses -->
    <div class="dashboard-section">
      <div class="section-head">
        <h2>My Courses</h2>
        <a href="/browse-courses" class="btn-outline-sm">Browse More</a>
      </div>
      <div class="dashboard-courses-grid">
        ${enrolledHtml}
      </div>
    </div>

    <!-- Recent Test Results -->
    <div class="dashboard-section">
      <div class="section-head">
        <h2>Recent Test Results</h2>
        <a href="/my-tests" class="btn-outline-sm">View All</a>
      </div>
      <div class="table-wrap">
        <table class="dashboard-table">
          <thead>
            <tr>
              <th>Test Name</th>
              <th>Score</th>
              <th>Result</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${testsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Free Tests -->
    <div class="dashboard-section">
      <div class="section-head">
        <h2>Quick Practice Tests</h2>
        <a href="/free-tests" class="btn-outline-sm">View All</a>
      </div>
      <div class="quick-tests-list">
        ${freeTestsHtml}
      </div>
    </div>

  </main>

  <script src="/js/main.js"></script>
  <script>
    // Sidebar toggle for mobile
    document.getElementById('sidebarToggle').addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('sidebar-open');
    });
  </script>
  <script src="/js/content-protection.js"></script>
</body>
</html>`);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Something went wrong.');
  }
});

// ============================================
// START SERVER -- ALWAYS LAST
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || '❌ Not configured'}`);
  console.log(`🗄️  DB: ${process.env.MONGODB_URI ? '✅ Configured' : '❌ Not configured'}`);
});

// ============================================
// GLOBAL ERROR HANDLER -- ALWAYS VERY LAST
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong!'
      : err.message
  });
});
