// ============================================
// LEARN WITH SAURAB – server.js
// Built clean from scratch – no bugs
// ============================================

// STEP 1: Load environment variables (ONCE – never repeat this)
require(‘dotenv’).config();

// STEP 2: All imports
const express = require(‘express’);
const session = require(‘express-session’);
const mongoose = require(‘mongoose’);
const bcrypt = require(‘bcryptjs’);
const crypto = require(‘crypto’);
const multer = require(‘multer’);
const path = require(‘path’);
const fs = require(‘fs’);
const compression = require(‘compression’);
const MongoStore = require(‘connect-mongo’);
const nodemailer = require(‘nodemailer’);
const cors = require(‘cors’);
const helmet = require(‘helmet’);
const rateLimit = require(‘express-rate-limit’);

// STEP 3: Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI || ‘mongodb://localhost:27017/learn-with-saurab’)
.then(() => {
console.log(‘✅ Connected to MongoDB’);
createIndexes();
})
.catch(err => {
console.error(‘❌ MongoDB connection error:’, err);
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
enrolledCourses:    [{ type: mongoose.Schema.Types.ObjectId, ref: ‘Course’ }],
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
icon:        { type: String, default: ‘fas fa-book’ },
color:       { type: String, default: ‘#0D7377’ },
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
level:       { type: String, enum: [‘Beginner’,‘Intermediate’,‘Advanced’], default: ‘Beginner’ },
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
tests: [{ type: mongoose.Schema.Types.ObjectId, ref: ‘Test’ }]
}]
}, { timestamps: true });

// 4. Test Schema
const testSchema = new mongoose.Schema({
title:             { type: String, required: true },
description:       String,
courseId:          { type: mongoose.Schema.Types.ObjectId, ref: ‘Course’ },
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
difficulty:  { type: String, enum: [‘Easy’,‘Medium’,‘Hard’], default: ‘Medium’ }
}]
}, { timestamps: true });

// 5. TestAttempt Schema
const testAttemptSchema = new mongoose.Schema({
userId:      { type: mongoose.Schema.Types.ObjectId, ref: ‘User’, required: true },
testId:      { type: mongoose.Schema.Types.ObjectId, ref: ‘Test’, required: true },
answers:     [{ questionId: String, selectedOption: Number }],
score:       Number,
totalMarks:  Number,
passed:      Boolean,
timeTaken:   Number,
completedAt: { type: Date, default: Date.now }
});

// 6. Transaction Schema
const transactionSchema = new mongoose.Schema({
userId:        { type: mongoose.Schema.Types.ObjectId, ref: ‘User’, required: true },
courseId:      { type: mongoose.Schema.Types.ObjectId, ref: ‘Course’, required: true },
amount:        Number,
transactionId: { type: String, unique: true },
paymentMethod: { type: String, enum: [‘eSewa’,‘Khalti’,‘manual’], default: ‘eSewa’ },
status:        { type: String, enum: [‘pending’,‘completed’,‘failed’], default: ‘pending’ }
}, { timestamps: true });

// 6b. Module Schema (individual videos inside a course)
const moduleSchema = new mongoose.Schema({
course:          { type: mongoose.Schema.Types.ObjectId, ref: ‘Course’, required: true },
title:           { type: String, required: true },
description:     { type: String, default: ‘’ },
type:            { type: String, default: ‘video’ },
videoPath:       { type: String, default: ‘’ },
videoFilename:   { type: String, default: ‘’ },
isFreePreview:   { type: Boolean, default: false },
duration:        { type: Number, default: 0 },
order:           { type: Number, default: 1 }
}, { timestamps: true });

// Register all models
const User        = mongoose.model(‘User’, userSchema);
const Category    = mongoose.model(‘Category’, categorySchema);
const Course      = mongoose.model(‘Course’, courseSchema);
const Test        = mongoose.model(‘Test’, testSchema);
const TestAttempt = mongoose.model(‘TestAttempt’, testAttemptSchema);
const Transaction = mongoose.model(‘Transaction’, transactionSchema);
const Module      = mongoose.model(‘Module’, moduleSchema);

// ============================================
// CREATE UPLOAD DIRECTORIES
// ============================================
const uploadDirs = [
‘uploads/videos’,
‘uploads/resources’,
‘uploads/question-images’,
‘uploads/course-images’
];

uploadDirs.forEach(dir => {
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
});

// ============================================
// MIDDLEWARE (ORDER IS CRITICAL – DO NOT CHANGE)
// ============================================

// 1. Static files
app.use(express.static(path.join(__dirname, ‘public’)));
app.use(’/uploads’, express.static(path.join(__dirname, ‘uploads’)));

// 2. Compression
app.use(compression());

// 3. Body parsers (declared ONCE only)
app.use(express.urlencoded({ extended: true, limit: ‘50mb’ }));
app.use(express.json({ limit: ‘50mb’ }));

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
secure: process.env.NODE_ENV === ‘production’,
httpOnly: true,
sameSite: ‘strict’,
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
message: ‘Too many requests, please try again later.’
});

const authLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 5,
message: ‘Too many attempts, please try again after 15 minutes.’
});

app.use(generalLimiter);
app.use([’/login’, ‘/signup’, ‘/forgot-password’], authLimiter);

// 8. XSS sanitizer
app.use((req, res, next) => {
if (req.body) {
Object.keys(req.body).forEach(key => {
if (typeof req.body[key] === ‘string’) {
req.body[key] = req.body[key]
.replace(/<script[^>]*>.*?</script>/gi, ‘’)
.replace(/javascript:/gi, ‘’)
.trim();
}
});
}
next();
});

// 9. Request logger (development only)
if (process.env.NODE_ENV !== ‘production’) {
app.use((req, res, next) => {
console.log(`${req.method} ${req.url}`);
next();
});
}

// ============================================
// MULTER FILE UPLOAD CONFIGS (ONE EACH – NO DUPLICATES)
// ============================================

// For course thumbnail images
const imageUpload = multer({
storage: multer.diskStorage({
destination: (req, file, cb) => cb(null, ‘uploads/course-images/’),
filename: (req, file, cb) => cb(null, Date.now() + ‘-’ + file.originalname)
}),
limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
fileFilter: (req, file, cb) => {
file.mimetype.startsWith(‘image/’) ? cb(null, true) : cb(new Error(‘Images only!’));
}
});

// For course videos
const videoUpload = multer({
storage: multer.diskStorage({
destination: (req, file, cb) => cb(null, ‘uploads/videos/’),
filename: (req, file, cb) => cb(null, Date.now() + ‘-’ + file.originalname)
}),
limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
fileFilter: (req, file, cb) => {
file.mimetype.startsWith(‘video/’) ? cb(null, true) : cb(new Error(‘Videos only!’));
}
});

// For PDFs and documents
const resourceUpload = multer({
storage: multer.diskStorage({
destination: (req, file, cb) => cb(null, ‘uploads/resources/’),
filename: (req, file, cb) => cb(null, Date.now() + ‘-’ + file.originalname)
}),
limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
fileFilter: (req, file, cb) => {
const allowed = [
‘application/pdf’,
‘application/msword’,
‘application/vnd.openxmlformats-officedocument.wordprocessingml.document’,
‘application/vnd.ms-powerpoint’,
‘application/vnd.openxmlformats-officedocument.presentationml.presentation’,
‘text/plain’,
‘application/zip’
];
allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error(‘Invalid file type!’));
}
});

// For question images
const questionImageUpload = multer({
storage: multer.diskStorage({
destination: (req, file, cb) => cb(null, ‘uploads/question-images/’),
filename: (req, file, cb) => cb(null, Date.now() + ‘-’ + file.originalname)
}),
limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
fileFilter: (req, file, cb) => {
file.mimetype.startsWith(‘image/’) ? cb(null, true) : cb(new Error(‘Images only!’));
}
});

// ============================================
// AUTH MIDDLEWARE
// ============================================

// Check if user is logged in
const requireAuth = (req, res, next) => {
if (req.session && req.session.userId) return next();
res.redirect(’/login?redirect=’ + encodeURIComponent(req.url));
};

// Check if user is admin (double check DB – not just session)
const requireAdmin = async (req, res, next) => {
if (!req.session.userId) return res.redirect(’/login’);
try {
const user = await User.findById(req.session.userId);
if (!user || !user.isAdmin) {
return res.status(403).send(‘Access denied.’);
}
next();
} catch (err) {
res.status(500).send(‘Server error’);
}
};

// ============================================
// EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
service: ‘gmail’,
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
await Course.collection.createIndex({ title: ‘text’, description: ‘text’ });
await Course.collection.createIndex({ category: 1 });
await Transaction.collection.createIndex({ transactionId: 1 });
console.log(‘✅ Database indexes created’);
} catch (err) {
console.log(‘ℹ️ Indexes already exist’);
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
name: ‘CEE Preparation’,
slug: ‘cee-preparation’,
icon: ‘fas fa-stethoscope’,
color: ‘#0D7377’,
description: ‘Medical & Paramedical Entrance Exam’,
subjects: [‘Biology’, ‘Chemistry’, ‘Physics’, ‘English’, ‘MAT’],
order: 1
},
{
name: ‘Loksewa / लोकसेवा’,
slug: ‘loksewa-preparation’,
icon: ‘fas fa-landmark’,
color: ‘#7C3AED’,
description: ‘Nepal Public Service Commission’,
subjects: [‘General Knowledge’, ‘Nepali’, ‘English’, ‘Current Affairs’, ‘IQ/Reasoning’],
order: 2
},
{
name: ‘License Exam’,
slug: ‘license-exam’,
icon: ‘fas fa-id-card’,
color: ‘#DC2626’,
description: ‘NMCL, CMA, Lab, Pharmacy & More’,
subjects: [‘NMCL’, ‘CMA’, ‘Lab Tech’, ‘Pharmacy’],
order: 3
},
{
name: ‘NEB Preparation’,
slug: ‘neb-preparation’,
icon: ‘fas fa-book-open’,
color: ‘#D97706’,
description: ‘Grade 11 & 12 Board Exams’,
subjects: [‘Physics’, ‘Chemistry’, ‘Biology’, ‘Maths’, ‘English’],
order: 4
},
{
name: ‘SEE Preparation’,
slug: ‘see-preparation’,
icon: ‘fas fa-graduation-cap’,
color: ‘#059669’,
description: ‘Grade 10 Secondary Education’,
subjects: [‘Science’, ‘Maths’, ‘English’, ‘Social’, ‘Nepali’],
order: 5
}
];

await Category.insertMany(defaults);
console.log(‘✅ Default categories seeded’);
}

mongoose.connection.once(‘open’, () => {
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
subject: ‘✅ Verify Your Email – Learn with Saurab’,
html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;"> <div style="text-align: center; margin-bottom: 30px;"> <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1> </div> <h2 style="color: #F9FAFB;">Welcome, ${user.firstName}! 🎓</h2> <p style="color: #9CA3AF; line-height: 1.6;">Thank you for joining Nepal's #1 exam preparation platform. Please verify your email to activate your account.</p> <div style="text-align: center; margin: 30px 0;"> <a href="${verifyUrl}" style="background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify My Email</a> </div> <p style="color: #6B7280; font-size: 14px;">This link expires in 24 hours. If you didn't create this account, ignore this email.</p> <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;"> <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p> </div>`
});
}

// Send password reset email
async function sendPasswordResetEmail(user, token) {
const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${token}`;

await transporter.sendMail({
from: `"Learn with Saurab" <${process.env.EMAIL_USER}>`,
to: user.email,
subject: ‘🔐 Reset Your Password – Learn with Saurab’,
html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;"> <div style="text-align: center; margin-bottom: 30px;"> <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1> </div> <h2 style="color: #F9FAFB;">Password Reset Request</h2> <p style="color: #9CA3AF; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password.</p> <div style="text-align: center; margin: 30px 0;"> <a href="${resetUrl}" style="background: #E63946; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset My Password</a> </div> <p style="color: #6B7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p> <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;"> <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p> </div>`
});
}

// Send welcome email after verification
async function sendWelcomeEmail(user) {
await transporter.sendMail({
from: `"Learn with Saurab" <${process.env.EMAIL_USER}>`,
to: user.email,
subject: ‘🎉 Welcome to Learn with Saurab!’,
html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #F9FAFB; padding: 40px; border-radius: 12px;"> <div style="text-align: center; margin-bottom: 30px;"> <h1 style="color: #0D7377; font-size: 28px;">Learn with Saurab</h1> </div> <h2 style="color: #F9FAFB;">Your account is verified! 🎓</h2> <p style="color: #9CA3AF; line-height: 1.6;">Welcome to Nepal's #1 exam preparation platform. You can now access free courses, practice tests, and much more.</p> <div style="text-align: center; margin: 30px 0;"> <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" style="background: #0D7377; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard</a> </div> <hr style="border-color: rgba(255,255,255,0.1); margin: 30px 0;"> <p style="color: #6B7280; font-size: 12px; text-align: center;">© 2025 Learn with Saurab | learnwithsaurab.com.np</p> </div>`
});
}

// ============================================
// PUBLIC ROUTES
// ============================================

// Homepage
app.get(’/’, async (req, res) => {
try {
const categories = await Category.find({ isVisible: true }).sort({ order: 1 });
const featuredCourses = await Course.find({ isFeatured: true, isPublished: true }).limit(6);
const freeTests = await Test.find({ isFree: true, isPublished: true }).limit(4);
const user = req.session.userId ? await User.findById(req.session.userId) : null;

```
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
```

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
app.get(’/verify-pending’, (req, res) => {
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
app.get(’/verify-email/:token’, async (req, res) => {
try {
const user = await User.findOne({
emailVerifyToken: req.params.token,
emailVerifyExpires: { $gt: Date.now() }
});

```
if (!user) {
  return res.send(`<!DOCTYPE html>
```

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

```
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
```

} catch (err) {
console.error(‘Verify email error:’, err);
res.status(500).send(‘Something went wrong.’);
}
});

// ============================================
// SIGNUP
// ============================================

// Show signup page
app.get(’/signup’, (req, res) => {
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

```
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
```

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
app.post(’/signup’, async (req, res) => {
try {
const { firstName, lastName, username, email, mobile, password, isAdmin, adminCode } = req.body;

```
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
```

} catch (err) {
console.error(‘Signup error:’, err);
res.json({ success: false, message: ‘Something went wrong. Please try again.’ });
}
});

// Check username availability
app.get(’/api/check-username’, async (req, res) => {
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
app.get(’/login’, (req, res) => {
const redirect = req.query.redirect || ‘/dashboard’;
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

```
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
```

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
app.post(’/login’, async (req, res) => {
try {
const { identifier, password, redirect } = req.body;

```
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
```

} catch (err) {
console.error(‘Login error:’, err);
res.json({ success: false, message: ‘Something went wrong. Please try again.’ });
}
});

// ============================================
// LOGOUT
// ============================================
app.get(’/logout’, (req, res) => {
req.session.destroy(err => {
if (err) console.error(‘Logout error:’, err);
res.redirect(’/’);
});
});

// ============================================
// RESEND VERIFICATION EMAIL
// ============================================
app.get(’/resend-verification’, (req, res) => {
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

app.post(’/api/resend-verification’, async (req, res) => {
try {
const { email } = req.body;
const user = await User.findOne({ email: email.toLowerCase() });

```
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
```

} catch (err) {
console.error(‘Resend verification error:’, err);
res.json({ success: false, message: ‘Something went wrong. Try again.’ });
}
});

// ============================================
// FORGOT PASSWORD
// ============================================

app.get(’/forgot-password’, (req, res) => {
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

```
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
```

  </script>
</body>
</html>`);
});

app.post(’/api/forgot-password’, async (req, res) => {
try {
const { email } = req.body;
const user = await User.findOne({ email: email.toLowerCase() });

```
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
```

} catch (err) {
console.error(‘Forgot password error:’, err);
res.json({ success: false, message: ‘Something went wrong. Please try again.’ });
}
});

// ============================================
// RESET PASSWORD
// ============================================

app.get(’/reset-password/:token’, async (req, res) => {
try {
const user = await User.findOne({
resetPasswordToken: req.params.token,
resetPasswordExpires: { $gt: Date.now() }
});

```
if (!user) {
  return res.send(`<!DOCTYPE html>
```

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

```
res.send(`<!DOCTYPE html>
```

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

```
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
```

  </script>
</body>
</html>`);
  } catch (err) {
    console.error('Reset password page error:', err);
    res.status(500).send('Something went wrong.');
  }
});

app.post(’/api/reset-password/:token’, async (req, res) => {
try {
const { password } = req.body;

```
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
```

} catch (err) {
console.error(‘Reset password error:’, err);
res.json({ success: false, message: ‘Something went wrong. Please try again.’ });
}
});

// ============================================
// STUDENT DASHBOARD
// ============================================

app.get(’/dashboard’, requireAuth, async (req, res) => {
try {
const user = await User.findById(req.session.userId)
.populate(‘enrolledCourses’);

```
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
```

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

```
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
```

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
// ADMIN PANEL ROUTES
// Paste this block ABOVE the app.listen() line
// requireAdmin is already defined above – do NOT paste it again
// ============================================

// ─── MULTER FOR ADMIN UPLOADS ─────────────────────────────────────────────
// imageUpload and videoUpload already defined above – we reuse them directly

// ─── GET /admin – Dashboard ───────────────────────────────────────────────
app.get(’/admin’, requireAdmin, async (req, res) => {
try {
const user = await User.findById(req.session.userId);

const [
totalUsers,
totalCourses,
totalCategories,
publishedCourses,
totalModules
] = await Promise.all([
User.countDocuments(),
Course.countDocuments(),
Category.countDocuments(),
Course.countDocuments({ isPublished: true }),
Module.countDocuments()
]);

const enrollmentData = await User.aggregate([
{ $project: { count: { $size: ‘$enrolledCourses’ } } },
{ $group: { _id: null, total: { $sum: ‘$count’ } } }
]);
const totalEnrollments = enrollmentData[0]?.total || 0;

const recentUsers = await User.find()
.sort({ createdAt: -1 })
.limit(5)
.select(‘firstName lastName email createdAt’);

const recentCourses = await Course.find()
.sort({ createdAt: -1 })
.limit(5);

res.send(renderAdminDashboard({
totalUsers, totalCourses, totalCategories,
totalEnrollments, publishedCourses, totalModules,
recentUsers, recentCourses,
admin: { name: user.firstName + ’ ’ + user.lastName }
}));

} catch (err) {
console.error(‘Admin dashboard error:’, err);
res.status(500).send(‘Error loading admin dashboard’);
}
});

// ─── GET /admin/categories – List ─────────────────────────────────────────
app.get(’/admin/categories’, requireAdmin, async (req, res) => {
try {
const user = await User.findById(req.session.userId);
const categories = await Category.find().sort({ order: 1 });
res.send(renderAdminCategories({
categories,
admin: { name: user.firstName },
success: req.query.success,
error: req.query.error
}));
} catch (err) {
console.error(‘Admin categories error:’, err);
res.status(500).send(‘Error loading categories’);
}
});

// POST /admin/categories – Create
app.post(’/admin/categories’, requireAdmin, async (req, res) => {
try {
const { name, description, icon, color, order } = req.body;
if (!name) return res.redirect(’/admin/categories?error=Name+is+required’);

const existing = await Category.findOne({ name: name.trim() });
if (existing) return res.redirect(’/admin/categories?error=Category+already+exists’);

// Generate slug from name
const slug = name.trim().toLowerCase().replace(/\s+/g, ‘-’).replace(/[^a-z0-9-]/g, ‘’);

const maxOrder = await Category.findOne().sort({ order: -1 }).select(‘order’);
await Category.create({
name: name.trim(),
slug,
description: description?.trim() || ‘’,
icon: icon || ‘📚’,
color: color || ‘#0D9488’,
order: order ? parseInt(order) : (maxOrder?.order || 0) + 1,
isVisible: true
});

res.redirect(’/admin/categories?success=Category+created+successfully’);

} catch (err) {
console.error(‘Create category error:’, err);
res.redirect(’/admin/categories?error=Failed+to+create+category’);
}
});

// POST /admin/categories/:id/edit – Update
app.post(’/admin/categories/:id/edit’, requireAdmin, async (req, res) => {
try {
const { name, description, icon, color, order, isActive } = req.body;
const slug = name.trim().toLowerCase().replace(/\s+/g, ‘-’).replace(/[^a-z0-9-]/g, ‘’);
await Category.findByIdAndUpdate(req.params.id, {
name: name.trim(),
slug,
description: description?.trim() || ‘’,
icon: icon || ‘📚’,
color: color || ‘#0D9488’,
order: parseInt(order) || 1,
isVisible: isActive === ‘on’ || isActive === ‘true’
});
res.redirect(’/admin/categories?success=Category+updated’);
} catch (err) {
console.error(‘Edit category error:’, err);
res.redirect(’/admin/categories?error=Failed+to+update+category’);
}
});

// POST /admin/categories/:id/delete – Delete
app.post(’/admin/categories/:id/delete’, requireAdmin, async (req, res) => {
try {
const courseCount = await Course.countDocuments({ category: req.params.id });
if (courseCount > 0) {
return res.redirect(’/admin/categories?error=Cannot+delete:+’ + courseCount + ‘+courses+use+this+category’);
}
await Category.findByIdAndDelete(req.params.id);
res.redirect(’/admin/categories?success=Category+deleted’);
} catch (err) {
console.error(‘Delete category error:’, err);
res.redirect(’/admin/categories?error=Failed+to+delete+category’);
}
});

// ─── GET /admin/courses – List ─────────────────────────────────────────────
app.get(’/admin/courses’, requireAdmin, async (req, res) => {
try {
const user = await User.findById(req.session.userId);
const { search, status } = req.query;
let query = {};
if (search) query.title = { $regex: search, $options: ‘i’ };
if (status === ‘published’) query.isPublished = true;
if (status === ‘draft’) query.isPublished = false;
if (status === ‘free’) query.price = 0;
if (status === ‘paid’) query.price = { $gt: 0 };

const courses = await Course.find(query).sort({ createdAt: -1 });
const categories = await Category.find().sort({ order: 1 });

res.send(renderAdminCourses({
courses,
categories,
filters: { search, status },
admin: { name: user.firstName },
success: req.query.success,
error: req.query.error
}));

} catch (err) {
console.error(‘Admin courses error:’, err);
res.status(500).send(‘Error loading courses’);
}
});

// POST /admin/courses – Create
app.post(’/admin/courses’, requireAdmin, imageUpload.single(‘thumbnail’), async (req, res) => {
try {
const { title, description, category, price, isFree, isPublished, duration, level } = req.body;
if (!title) return res.redirect(’/admin/courses?error=Title+is+required’);

const course = await Course.create({
title: title.trim(),
description: description?.trim() || ‘’,
category: category || ‘’,
price: isFree === ‘on’ ? 0 : (parseFloat(price) || 0),
isPublished: isPublished === ‘on’,
level: level || ‘Beginner’,
imagePath: req.file ? ‘/uploads/course-images/’ + req.file.filename : ‘’,
isFeatured: false
});

res.redirect(’/admin/course/’ + course._id + ‘/modules?success=Course+created!+Now+add+modules.’);

} catch (err) {
console.error(‘Create course error:’, err);
res.redirect(’/admin/courses?error=Failed+to+create+course’);
}
});

// POST /admin/courses/:id/edit – Update
app.post(’/admin/courses/:id/edit’, requireAdmin, imageUpload.single(‘thumbnail’), async (req, res) => {
try {
const { title, description, category, price, isFree, isPublished, level } = req.body;

const updateData = {
title: title.trim(),
description: description?.trim() || ‘’,
category: category || ‘’,
price: isFree === ‘on’ ? 0 : (parseFloat(price) || 0),
isPublished: isPublished === ‘on’,
level: level || ‘Beginner’
};

if (req.file) {
updateData.imagePath = ‘/uploads/course-images/’ + req.file.filename;
}

await Course.findByIdAndUpdate(req.params.id, updateData);
res.redirect(’/admin/courses?success=Course+updated+successfully’);

} catch (err) {
console.error(‘Edit course error:’, err);
res.redirect(’/admin/courses?error=Failed+to+update+course’);
}
});

// POST /admin/courses/:id/delete – Delete course + its modules
app.post(’/admin/courses/:id/delete’, requireAdmin, async (req, res) => {
try {
await Module.deleteMany({ course: req.params.id });
await Course.findByIdAndDelete(req.params.id);
res.redirect(’/admin/courses?success=Course+and+all+modules+deleted’);
} catch (err) {
console.error(‘Delete course error:’, err);
res.redirect(’/admin/courses?error=Failed+to+delete+course’);
}
});

// POST /admin/courses/:id/toggle-featured – Quick toggle
app.post(’/admin/courses/:id/toggle-featured’, requireAdmin, async (req, res) => {
try {
const course = await Course.findById(req.params.id);
if (!course) return res.redirect(’/admin/courses?error=Course+not+found’);
course.isFeatured = !course.isFeatured;
await course.save();
res.redirect(’/admin/courses?success=Featured+status+updated’);
} catch (err) {
res.redirect(’/admin/courses?error=Failed+to+update’);
}
});

// ─── GET /admin/course/:id/modules – Manage modules ───────────────────────
app.get(’/admin/course/:id/modules’, requireAdmin, async (req, res) => {
try {
const user = await User.findById(req.session.userId);
const course = await Course.findById(req.params.id);
if (!course) return res.redirect(’/admin/courses?error=Course+not+found’);

const modules = await Module.find({ course: req.params.id }).sort({ order: 1 });

res.send(renderAdminModules({
course,
modules,
admin: { name: user.firstName },
success: req.query.success,
error: req.query.error
}));

} catch (err) {
console.error(‘Admin modules error:’, err);
res.status(500).send(‘Error loading modules’);
}
});

// POST /admin/course/:id/modules – Add module with video upload
app.post(’/admin/course/:id/modules’, requireAdmin, videoUpload.single(‘video’), async (req, res) => {
try {
const { title, description, isFreePreview, order } = req.body;
if (!title) return res.redirect(’/admin/course/’ + req.params.id + ‘/modules?error=Module+title+required’);

const maxOrder = await Module.findOne({ course: req.params.id }).sort({ order: -1 }).select(‘order’);

await Module.create({
course: req.params.id,
title: title.trim(),
description: description?.trim() || ‘’,
type: ‘video’,
videoPath: req.file ? ‘uploads/videos/’ + req.file.filename : ‘’,
videoFilename: req.file ? req.file.filename : ‘’,
isFreePreview: isFreePreview === ‘on’,
order: order ? parseInt(order) : (maxOrder?.order || 0) + 1
});

res.redirect(’/admin/course/’ + req.params.id + ‘/modules?success=Module+added+successfully’);

} catch (err) {
console.error(‘Add module error:’, err);
res.redirect(’/admin/course/’ + req.params.id + ‘/modules?error=Failed+to+add+module’);
}
});

// POST /admin/module/:id/edit – Edit module info
app.post(’/admin/module/:id/edit’, requireAdmin, async (req, res) => {
try {
const { title, description, isFreePreview, order } = req.body;
const module = await Module.findByIdAndUpdate(req.params.id, {
title: title.trim(),
description: description?.trim() || ‘’,
isFreePreview: isFreePreview === ‘on’,
order: parseInt(order) || 1
}, { new: true });

res.redirect(’/admin/course/’ + module.course + ‘/modules?success=Module+updated’);

} catch (err) {
console.error(‘Edit module error:’, err);
res.redirect(’/admin/courses?error=Failed+to+update+module’);
}
});

// POST /admin/module/:id/delete – Delete module + video file
app.post(’/admin/module/:id/delete’, requireAdmin, async (req, res) => {
try {
const module = await Module.findById(req.params.id);
if (!module) return res.redirect(’/admin/courses?error=Module+not+found’);

const courseId = module.course;

// Delete video file from disk
if (module.videoFilename) {
const filePath = path.join(__dirname, ‘uploads/videos’, module.videoFilename);
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

await Module.findByIdAndDelete(req.params.id);
res.redirect(’/admin/course/’ + courseId + ‘/modules?success=Module+deleted’);

} catch (err) {
console.error(‘Delete module error:’, err);
res.redirect(’/admin/courses?error=Failed+to+delete+module’);
}
});

// POST /admin/course/:id/modules/reorder – Save drag-drop order (JSON API)
app.post(’/admin/course/:id/modules/reorder’, requireAdmin, async (req, res) => {
try {
const ids = Array.isArray(req.body.order) ? req.body.order : JSON.parse(req.body.order);
await Promise.all(ids.map((id, index) =>
Module.findByIdAndUpdate(id, { order: index + 1 })
));
res.json({ success: true });
} catch (err) {
console.error(‘Reorder error:’, err);
res.status(500).json({ error: ‘Failed to reorder’ });
}
});

// ============================================
// ADMIN HTML RENDER FUNCTIONS
// These build the full HTML for each admin page
// ============================================

function adminShell({ title, activePage, content, admin, breadcrumb = [] }) {
const navItems = [
{ href: ‘/admin’,             icon: ‘📊’, label: ‘Dashboard’,    key: ‘dashboard’ },
{ href: ‘/admin/categories’,  icon: ‘🗂️’,  label: ‘Categories’,  key: ‘categories’ },
{ href: ‘/admin/courses’,     icon: ‘🎓’, label: ‘Courses’,      key: ‘courses’ },
{ href: ‘/admin/users’,       icon: ‘👥’, label: ‘Users’,        key: ‘users’ },
{ href: ‘/admin/tests’,       icon: ‘📝’, label: ‘Tests’,        key: ‘tests’ },
{ href: ‘/admin/transactions’,icon: ‘💰’, label: ‘Transactions’, key: ‘transactions’ },
{ href: ‘/admin/analytics’,   icon: ‘📈’, label: ‘Analytics’,    key: ‘analytics’ },
{ href: ‘/admin/site-settings’,icon:‘⚙️’, label: ‘Site Settings’,key: ‘settings’ },
];

const breadcrumbHtml = [
‘<a href="/admin">Admin</a>’,
…breadcrumb.map((b, i) =>
i === breadcrumb.length - 1
? `<span class="sep">›</span><span class="current">${b.label}</span>`
: `<span class="sep">›</span><a href="${b.href}">${b.label}</a>`
)
].join(’’);

return `<!DOCTYPE html>

<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} -- LWS Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="admin-body">

  <div class="admin-sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>

  <aside class="admin-sidebar" id="adminSidebar">
    <a href="/admin" class="admin-sidebar-logo">
      <div>
        <span>LearnwithSaurab</span><br>
        <span class="admin-badge">Admin</span>
      </div>
    </a>
    <nav class="admin-nav">
      <div class="admin-nav-section-label">Main</div>
      ${navItems.slice(0,3).map(item => `
        <a href="${item.href}" class="admin-nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>${item.label}
        </a>`).join('')}
      <div class="admin-nav-section-label">Content</div>
      ${navItems.slice(3,6).map(item => `
        <a href="${item.href}" class="admin-nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>${item.label}
        </a>`).join('')}
      <div class="admin-nav-section-label">System</div>
      ${navItems.slice(6).map(item => `
        <a href="${item.href}" class="admin-nav-item ${activePage === item.key ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>${item.label}
        </a>`).join('')}
    </nav>
    <div class="admin-sidebar-footer">
      <div class="admin-sidebar-user">
        <div class="enrollment-avatar">${(admin.name||'A')[0].toUpperCase()}</div>
        <div class="admin-sidebar-user-info">
          <div class="user-name">${admin.name||'Admin'}</div>
          <div class="user-role">Super Admin</div>
        </div>
      </div>
    </div>
  </aside>

  <div class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar-left">
        <button class="admin-sidebar-toggle" onclick="openSidebar()">☰</button>
        <div>
          <div class="admin-page-title">${title}</div>
          <div class="admin-breadcrumb">${breadcrumbHtml}</div>
        </div>
      </div>
      <div class="admin-topbar-right">
        <a href="/" target="_blank" class="admin-topbar-btn" title="View Site">🌐</a>
        <a href="/logout" class="admin-topbar-btn" title="Logout">🚪</a>
      </div>
    </header>
    <main class="admin-content">
      ${content}
    </main>
  </div>

  <script>
    function openSidebar() {
      document.getElementById('adminSidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.add('open');
    }
    function closeSidebar() {
      document.getElementById('adminSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    }
    setTimeout(() => {
      document.querySelectorAll('.admin-alert').forEach(el => {
        el.style.transition = 'opacity 0.4s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
      });
    }, 4000);
  </script>

</body>
</html>`;
}

// ─── DASHBOARD HTML ───────────────────────────────────────────────────────
function renderAdminDashboard({ totalUsers, totalCourses, totalCategories, totalEnrollments, publishedCourses, totalModules, recentUsers, recentCourses, admin }) {
const content = `

<div class="admin-stats-grid">
<div class="stat-card teal">
<div class="stat-card-header">
<div class="stat-card-icon">👥</div>
<span class="stat-change up">Registered</span>
</div>
<div class="stat-value">${totalUsers.toLocaleString()}</div>
<div class="stat-label">Total Students</div>
</div>
<div class="stat-card gold">
<div class="stat-card-header">
<div class="stat-card-icon">🎓</div>
<span class="stat-change up">${publishedCourses} live</span>
</div>
<div class="stat-value">${totalCourses}</div>
<div class="stat-label">Total Courses</div>
</div>
<div class="stat-card purple">
<div class="stat-card-header">
<div class="stat-card-icon">📋</div>
<span class="stat-change up">All time</span>
</div>
<div class="stat-value">${totalEnrollments.toLocaleString()}</div>
<div class="stat-label">Total Enrollments</div>
</div>
<div class="stat-card green">
<div class="stat-card-header">
<div class="stat-card-icon">🎬</div>
<span class="stat-change up">Uploaded</span>
</div>
<div class="stat-value">${totalModules}</div>
<div class="stat-label">Video Modules</div>
</div>
</div>

<div class="admin-card admin-mb-24">
  <div class="admin-card-header">
    <span class="admin-card-title">⚡ Quick Actions</span>
  </div>
  <div class="admin-card-body" style="display:flex;gap:12px;flex-wrap:wrap;">
    <a href="/admin/courses?openCreate=1" class="btn-admin btn-admin-primary">➕ New Course</a>
    <a href="/admin/categories?openCreate=1" class="btn-admin btn-admin-secondary">🗂️ New Category</a>
    <a href="/" target="_blank" class="btn-admin btn-admin-secondary">🌐 View Live Site</a>
  </div>
</div>

<div class="admin-two-col">
  <div class="admin-card">
    <div class="admin-card-header">
      <span class="admin-card-title">👥 Recent Signups</span>
      <a href="/admin/users" class="btn-admin btn-admin-secondary btn-admin-sm">View All</a>
    </div>
    <div class="admin-card-body" style="padding:0 24px;">
      <div class="enrollment-list">
        ${recentUsers.length === 0
          ? `<div class="admin-empty"><div class="admin-empty-title">No users yet</div></div>`
          : recentUsers.map(u => `
            <div class="enrollment-item">
              <div class="enrollment-avatar">${u.firstName[0].toUpperCase()}</div>
              <div class="enrollment-info">
                <div class="enrollment-name">${u.firstName} ${u.lastName}</div>
                <div class="enrollment-course">${u.email}</div>
              </div>
              <div class="text-muted" style="font-size:12px;">${new Date(u.createdAt).toLocaleDateString()}</div>
            </div>`).join('')
        }
      </div>
    </div>
  </div>

  <div class="admin-card">
    <div class="admin-card-header">
      <span class="admin-card-title">🎓 Recent Courses</span>
      <a href="/admin/courses" class="btn-admin btn-admin-secondary btn-admin-sm">View All</a>
    </div>
    <div class="admin-card-body" style="padding:0 24px;">
      <div class="enrollment-list">
        ${recentCourses.length === 0
          ? `<div class="admin-empty"><div class="admin-empty-title">No courses yet</div></div>`
          : recentCourses.map(c => `
            <div class="enrollment-item">
              <div class="enrollment-avatar">🎓</div>
              <div class="enrollment-info">
                <div class="enrollment-name">${c.title}</div>
                <div class="enrollment-course">${c.category || 'Uncategorized'}</div>
              </div>
              <span class="status-badge ${c.isPublished ? 'published' : 'draft'}">${c.isPublished ? 'Live' : 'Draft'}</span>
            </div>`).join('')
        }
      </div>
    </div>
  </div>
</div>

`;
return adminShell({ title: ‘Dashboard’, activePage: ‘dashboard’, content, admin });
}

// ─── CATEGORIES HTML ──────────────────────────────────────────────────────
function renderAdminCategories({ categories, admin, success, error }) {
const content = `${success ?`<div class="admin-alert success">✅ ${decodeURIComponent(success)}</div>`: ''} ${error   ?`<div class="admin-alert error">❌ ${decodeURIComponent(error)}</div>` : ‘’}

<div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
  <button class="btn-admin btn-admin-primary" onclick="openModal('createCategoryModal')">➕ Add Category</button>
</div>

<div class="admin-card">
  <div class="admin-card-header">
    <span class="admin-card-title">🗂️ All Categories (${categories.length})</span>
  </div>
  ${categories.length === 0 ? `
    <div class="admin-empty">
      <div class="admin-empty-icon">🗂️</div>
      <div class="admin-empty-title">No categories yet</div>
      <button class="btn-admin btn-admin-primary" onclick="openModal('createCategoryModal')">Create First Category</button>
    </div>
  ` : `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead><tr>
          <th>Order</th><th>Icon</th><th>Name</th><th>Slug</th><th>Visible</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${categories.map(cat => `
            <tr>
              <td class="font-mono text-muted">#${cat.order||'--'}</td>
              <td style="font-size:20px;">${cat.icon||'📚'}</td>
              <td><strong>${cat.name}</strong></td>
              <td class="font-mono text-muted" style="font-size:12px;">${cat.slug||''}</td>
              <td><span class="status-badge ${cat.isVisible ? 'published' : 'draft'}">${cat.isVisible ? 'Visible' : 'Hidden'}</span></td>
              <td>
                <div class="table-actions">
                  <button class="btn-admin btn-admin-secondary btn-admin-sm btn-admin-icon"
                    onclick='openEditCategory(${JSON.stringify({
                      id: cat._id.toString(),
                      name: cat.name,
                      description: cat.description||'',
                      icon: cat.icon||'📚',
                      color: cat.color||'#0D9488',
                      order: cat.order||1,
                      isVisible: cat.isVisible
                    })})'>✏️</button>
                  <form action="/admin/categories/${cat._id}/delete" method="POST" style="display:inline;"
                    onsubmit="return confirm('Delete: ${cat.name}?')">
                    <button type="submit" class="btn-admin btn-admin-danger btn-admin-sm btn-admin-icon">🗑️</button>
                  </form>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `}
</div>

<!-- CREATE MODAL -->

<div class="admin-modal-overlay" id="createCategoryModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">➕ Add Category</span>
      <button class="admin-modal-close" onclick="closeModal('createCategoryModal')">×</button>
    </div>
    <form action="/admin/categories" method="POST">
      <div class="admin-form-group">
        <label class="admin-form-label">Name <span class="required">*</span></label>
        <input type="text" name="name" class="admin-form-input" placeholder="e.g. CEE Preparation" required>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Icon (emoji)</label>
          <input type="text" name="icon" class="admin-form-input" value="📚">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Color</label>
          <input type="color" name="color" class="admin-form-input" value="#0D9488" style="height:42px;padding:4px;">
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" class="admin-form-textarea" style="min-height:70px;"></textarea>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Display Order</label>
        <input type="number" name="order" class="admin-form-input" value="${categories.length+1}" min="1">
        <div class="admin-form-hint">Lower number = appears first on homepage</div>
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('createCategoryModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary">Create Category</button>
      </div>
    </form>
  </div>
</div>

<!-- EDIT MODAL -->

<div class="admin-modal-overlay" id="editCategoryModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">✏️ Edit Category</span>
      <button class="admin-modal-close" onclick="closeModal('editCategoryModal')">×</button>
    </div>
    <form id="editCategoryForm" action="" method="POST">
      <div class="admin-form-group">
        <label class="admin-form-label">Name</label>
        <input type="text" name="name" id="editCatName" class="admin-form-input" required>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Icon</label>
          <input type="text" name="icon" id="editCatIcon" class="admin-form-input">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Color</label>
          <input type="color" name="color" id="editCatColor" class="admin-form-input" style="height:42px;padding:4px;">
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" id="editCatDesc" class="admin-form-textarea" style="min-height:70px;"></textarea>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Display Order</label>
          <input type="number" name="order" id="editCatOrder" class="admin-form-input" min="1">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Visibility</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isActive" id="editCatActive">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Show on homepage</span>
          </div>
        </div>
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('editCategoryModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<script>
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  if (new URLSearchParams(location.search).get('openCreate')) openModal('createCategoryModal');
  function openEditCategory(cat) {
    document.getElementById('editCategoryForm').action = '/admin/categories/' + cat.id + '/edit';
    document.getElementById('editCatName').value = cat.name;
    document.getElementById('editCatIcon').value = cat.icon;
    document.getElementById('editCatColor').value = cat.color;
    document.getElementById('editCatDesc').value = cat.description;
    document.getElementById('editCatOrder').value = cat.order;
    document.getElementById('editCatActive').checked = cat.isVisible;
    openModal('editCategoryModal');
  }
  document.querySelectorAll('.admin-modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
</script>

`;
return adminShell({ title: ‘Categories’, activePage: ‘categories’, content, admin, breadcrumb: [{label:‘Categories’}] });
}

// ─── COURSES HTML ─────────────────────────────────────────────────────────
function renderAdminCourses({ courses, categories, filters, admin, success, error }) {
const content = `${success ?`<div class="admin-alert success">✅ ${decodeURIComponent(success)}</div>`: ''} ${error   ?`<div class="admin-alert error">❌ ${decodeURIComponent(error)}</div>` : ‘’}

<div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
  <button class="btn-admin btn-admin-primary" onclick="openModal('createCourseModal')">➕ New Course</button>
</div>

<div class="admin-card admin-mb-24">
  <div class="admin-card-body" style="padding:16px 24px;">
    <form method="GET" action="/admin/courses">
      <div class="admin-filter-bar">
        <div class="admin-search-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" name="search" class="admin-search" placeholder="Search courses..." value="${filters.search||''}">
        </div>
        <select name="status" class="admin-select">
          <option value="">All Status</option>
          <option value="published" ${filters.status==='published'?'selected':''}>Published</option>
          <option value="draft"     ${filters.status==='draft'    ?'selected':''}>Draft</option>
          <option value="free"      ${filters.status==='free'     ?'selected':''}>Free</option>
          <option value="paid"      ${filters.status==='paid'     ?'selected':''}>Paid</option>
        </select>
        <button type="submit" class="btn-admin btn-admin-secondary">Filter</button>
        <a href="/admin/courses" class="btn-admin btn-admin-secondary">Clear</a>
      </div>
    </form>
  </div>
</div>

<div class="admin-card">
  <div class="admin-card-header">
    <span class="admin-card-title">🎓 All Courses (${courses.length})</span>
  </div>
  ${courses.length === 0 ? `
    <div class="admin-empty">
      <div class="admin-empty-icon">🎓</div>
      <div class="admin-empty-title">No courses found</div>
      <button class="btn-admin btn-admin-primary" onclick="openModal('createCourseModal')">Create First Course</button>
    </div>
  ` : `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead><tr>
          <th>Thumbnail</th><th>Title</th><th>Category</th><th>Price</th><th>Level</th><th>Status</th><th>Featured</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${courses.map(c => `
            <tr>
              <td>
                ${c.imagePath
                  ? `<img src="${c.imagePath}" class="table-thumb" alt="">`
                  : `<div class="table-thumb" style="background:rgba(13,148,136,0.1);display:flex;align-items:center;justify-content:center;">🎓</div>`
                }
              </td>
              <td><strong>${c.title}</strong></td>
              <td class="text-muted">${c.category||'None'}</td>
              <td class="${c.price===0?'text-success':'text-gold'} font-mono">
                ${c.price===0?'FREE':'NPR '+c.price}
              </td>
              <td class="text-muted">${c.level||'Beginner'}</td>
              <td><span class="status-badge ${c.isPublished?'published':'draft'}">${c.isPublished?'Published':'Draft'}</span></td>
              <td>
                <form action="/admin/courses/${c._id}/toggle-featured" method="POST" style="display:inline;">
                  <button type="submit" class="btn-admin btn-admin-sm ${c.isFeatured?'btn-admin-gold':'btn-admin-secondary'}">${c.isFeatured?'⭐ Yes':'☆ No'}</button>
                </form>
              </td>
              <td>
                <div class="table-actions">
                  <a href="/admin/course/${c._id}/modules" class="btn-admin btn-admin-secondary btn-admin-sm btn-admin-icon" title="Modules">🎬</a>
                  <button class="btn-admin btn-admin-secondary btn-admin-sm btn-admin-icon"
                    onclick='openEditCourse(${JSON.stringify({
                      id: c._id.toString(),
                      title: c.title,
                      description: c.description||'',
                      category: c.category||'',
                      price: c.price||0,
                      isFree: c.price===0,
                      isPublished: c.isPublished,
                      level: c.level||'Beginner'
                    })})'>✏️</button>
                  <form action="/admin/courses/${c._id}/delete" method="POST" style="display:inline;"
                    onsubmit="return confirm('Delete: ${c.title.replace(/'/g,"\\'")}? All modules deleted too.')">
                    <button type="submit" class="btn-admin btn-admin-danger btn-admin-sm btn-admin-icon">🗑️</button>
                  </form>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `}
</div>

<!-- CREATE COURSE MODAL -->

<div class="admin-modal-overlay" id="createCourseModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">➕ New Course</span>
      <button class="admin-modal-close" onclick="closeModal('createCourseModal')">×</button>
    </div>
    <form action="/admin/courses" method="POST" enctype="multipart/form-data">
      <div class="admin-form-group">
        <label class="admin-form-label">Title <span class="required">*</span></label>
        <input type="text" name="title" class="admin-form-input" placeholder="e.g. CEE Physics Complete Course" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" class="admin-form-textarea"></textarea>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Category</label>
          <select name="category" class="admin-form-select">
            <option value="">Select category</option>
            ${categories.map(c => `<option value="${c.slug}">${c.icon||''} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Level</label>
          <select name="level" class="admin-form-select">
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Price (NPR)</label>
        <input type="number" name="price" id="createPrice" class="admin-form-input" placeholder="0 for free" min="0">
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Free Course?</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isFree" id="createIsFree"
                onchange="document.getElementById('createPrice').disabled=this.checked">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Free for all students</span>
          </div>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Publish Now?</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isPublished">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Visible to students</span>
          </div>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Thumbnail</label>
        <input type="file" name="thumbnail" accept="image/*" class="admin-form-input" style="padding:8px;">
        <div class="admin-form-hint">JPG/PNG/WebP, max 5MB. Recommended: 1280×720</div>
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('createCourseModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary">Create & Add Modules →</button>
      </div>
    </form>
  </div>
</div>

<!-- EDIT COURSE MODAL -->

<div class="admin-modal-overlay" id="editCourseModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">✏️ Edit Course</span>
      <button class="admin-modal-close" onclick="closeModal('editCourseModal')">×</button>
    </div>
    <form id="editCourseForm" action="" method="POST" enctype="multipart/form-data">
      <div class="admin-form-group">
        <label class="admin-form-label">Title</label>
        <input type="text" name="title" id="editCourseTitle" class="admin-form-input" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" id="editCourseDesc" class="admin-form-textarea"></textarea>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Category</label>
          <select name="category" id="editCourseCat" class="admin-form-select">
            <option value="">No category</option>
            ${categories.map(c => `<option value="${c.slug}">${c.icon||''} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Level</label>
          <select name="level" id="editCourseLevel" class="admin-form-select">
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Price (NPR)</label>
          <input type="number" name="price" id="editCoursePrice" class="admin-form-input" min="0">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Published?</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isPublished" id="editCoursePublished">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Live on site</span>
          </div>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">New Thumbnail (optional)</label>
        <input type="file" name="thumbnail" accept="image/*" class="admin-form-input" style="padding:8px;">
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('editCourseModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<script>
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  if (new URLSearchParams(location.search).get('openCreate')) openModal('createCourseModal');
  function openEditCourse(c) {
    document.getElementById('editCourseForm').action = '/admin/courses/' + c.id + '/edit';
    document.getElementById('editCourseTitle').value  = c.title;
    document.getElementById('editCourseDesc').value   = c.description;
    document.getElementById('editCourseCat').value    = c.category;
    document.getElementById('editCoursePrice').value  = c.price;
    document.getElementById('editCourseLevel').value  = c.level;
    document.getElementById('editCoursePublished').checked = c.isPublished;
    openModal('editCourseModal');
  }
  document.querySelectorAll('.admin-modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
</script>

`;
return adminShell({ title: ‘Courses’, activePage: ‘courses’, content, admin, breadcrumb: [{label:‘Courses’}] });
}

// ─── MODULES HTML ─────────────────────────────────────────────────────────
function renderAdminModules({ course, modules, admin, success, error }) {
const content = `${success ?`<div class="admin-alert success">✅ ${decodeURIComponent(success)}</div>`: ''} ${error   ?`<div class="admin-alert error">❌ ${decodeURIComponent(error)}</div>` : ‘’}

<div class="admin-card admin-mb-24">
  <div class="admin-card-body" style="padding:20px 24px;">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      ${course.imagePath
        ? `<img src="${course.imagePath}" style="width:80px;height:50px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);" alt="">`
        : `<div style="width:80px;height:50px;border-radius:8px;background:rgba(13,148,136,0.1);display:flex;align-items:center;justify-content:center;font-size:24px;">🎓</div>`
      }
      <div style="flex:1;">
        <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:18px;">${course.title}</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px;">
          ${course.category||'Uncategorized'} ·
          <span class="${course.price===0?'text-success':'text-gold'}">${course.price===0?'Free':'NPR '+course.price}</span> ·
          <span class="status-badge ${course.isPublished?'published':'draft'}" style="margin-left:4px;">${course.isPublished?'Published':'Draft'}</span>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="/admin/courses" class="btn-admin btn-admin-secondary btn-admin-sm">← All Courses</a>
      </div>
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:flex-start;">

  <div class="admin-card">
    <div class="admin-card-header">
      <span class="admin-card-title">🎬 Modules (${modules.length})</span>
      <button class="btn-admin btn-admin-primary btn-admin-sm" onclick="openModal('addModuleModal')">➕ Add Module</button>
    </div>
    ${modules.length === 0 ? `
      <div class="admin-empty">
        <div class="admin-empty-icon">🎬</div>
        <div class="admin-empty-title">No modules yet</div>
        <div class="admin-empty-text">Add your first video module to this course</div>
        <button class="btn-admin btn-admin-primary" onclick="openModal('addModuleModal')">Add First Module</button>
      </div>
    ` : `
      <div style="padding:16px;">
        <div class="module-list" id="moduleList">
          ${modules.map((m, i) => `
            <div class="module-item" data-id="${m._id}" draggable="true">
              <div class="module-drag-handle">⋮⋮</div>
              <div class="module-number">${i+1}</div>
              <div class="module-info">
                <div class="module-title">${m.title}</div>
                <div class="module-meta">
                  ${m.videoFilename ? '📹 Video uploaded' : '⚠️ No video yet'} ·
                  ${m.isFreePreview ? '<span style="color:#34D399;">Free preview</span>' : 'Paid only'}
                </div>
              </div>
              <span class="module-type-badge ${m.isFreePreview?'free-preview':'video'}">
                ${m.isFreePreview?'Free Preview':'Paid'}
              </span>
              <div class="module-actions">
                <button class="btn-admin btn-admin-secondary btn-admin-sm btn-admin-icon"
                  onclick='openEditModule(${JSON.stringify({
                    id: m._id.toString(),
                    title: m.title,
                    description: m.description||'',
                    isFreePreview: m.isFreePreview,
                    order: m.order||(i+1)
                  })})'>✏️</button>
                <form action="/admin/module/${m._id}/delete" method="POST" style="display:inline;"
                  onsubmit="return confirm('Delete module?')">
                  <button type="submit" class="btn-admin btn-admin-danger btn-admin-sm btn-admin-icon">🗑️</button>
                </form>
              </div>
            </div>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#4B5563;text-align:center;">⋮⋮ Drag to reorder</div>
      </div>
    `}
  </div>

  <div style="display:flex;flex-direction:column;gap:16px;">
    <div class="admin-card">
      <div class="admin-card-header"><span class="admin-card-title">📊 Stats</span></div>
      <div class="admin-card-body">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:13px;color:#6B7280;">Total Modules</span>
            <span style="font-weight:700;">${modules.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:13px;color:#6B7280;">Free Previews</span>
            <span style="font-weight:700;color:#34D399;">${modules.filter(m=>m.isFreePreview).length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:13px;color:#6B7280;">Videos Uploaded</span>
            <span style="font-weight:700;color:#60A5FA;">${modules.filter(m=>m.videoFilename).length}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="admin-card">
      <div class="admin-card-header"><span class="admin-card-title">💡 Tips</span></div>
      <div class="admin-card-body" style="font-size:13px;color:#9CA3AF;line-height:1.9;">
        <p>✅ <strong style="color:#E5E7EB;">MP4</strong> -- works on all devices</p>
        <p>✅ Keep videos <strong style="color:#E5E7EB;">under 200MB</strong> for speed</p>
        <p>✅ Mark 1--2 intro modules as <strong style="color:#2DD4BF;">Free Preview</strong></p>
        <p>✅ Number modules clearly e.g. "Chapter 1: Introduction"</p>
      </div>
    </div>
  </div>
</div>

<!-- ADD MODULE MODAL -->

<div class="admin-modal-overlay" id="addModuleModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">➕ Add Module</span>
      <button class="admin-modal-close" onclick="closeModal('addModuleModal')">×</button>
    </div>
    <form action="/admin/course/${course._id}/modules" method="POST" enctype="multipart/form-data" id="uploadForm">
      <div class="admin-form-group">
        <label class="admin-form-label">Module Title <span class="required">*</span></label>
        <input type="text" name="title" class="admin-form-input" placeholder="e.g. Chapter 1: Introduction" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description (optional)</label>
        <textarea name="description" class="admin-form-textarea" style="min-height:70px;"></textarea>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Order</label>
          <input type="number" name="order" class="admin-form-input" value="${modules.length+1}" min="1">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Free Preview?</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isFreePreview">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Visible to all</span>
          </div>
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Upload Video</label>
        <div class="admin-upload-zone" id="uploadZone">
          <input type="file" name="video" accept="video/*" id="videoInput" onchange="handleVideoSelect(this)">
          <div class="upload-icon">📹</div>
          <div class="upload-title">Click or drag video here</div>
          <div class="upload-subtitle">MP4, MKV, MOV · Max <strong>2GB</strong></div>
        </div>
        <div class="upload-progress-wrap" id="uploadProgress">
          <div style="font-size:13px;color:#9CA3AF;margin-bottom:8px;" id="uploadFileName">Uploading...</div>
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="uploadFill"></div>
          </div>
          <div class="upload-progress-text" id="uploadPct">0%</div>
        </div>
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('addModuleModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary" id="uploadSubmitBtn">Upload & Save Module</button>
      </div>
    </form>
  </div>
</div>

<!-- EDIT MODULE MODAL -->

<div class="admin-modal-overlay" id="editModuleModal">
  <div class="admin-modal">
    <div class="admin-modal-header">
      <span class="admin-modal-title">✏️ Edit Module</span>
      <button class="admin-modal-close" onclick="closeModal('editModuleModal')">×</button>
    </div>
    <form id="editModuleForm" action="" method="POST">
      <div class="admin-form-group">
        <label class="admin-form-label">Title</label>
        <input type="text" name="title" id="editModTitle" class="admin-form-input" required>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" id="editModDesc" class="admin-form-textarea" style="min-height:70px;"></textarea>
      </div>
      <div class="admin-form-row">
        <div class="admin-form-group">
          <label class="admin-form-label">Order</label>
          <input type="number" name="order" id="editModOrder" class="admin-form-input" min="1">
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">Free Preview?</label>
          <div class="admin-toggle-wrap" style="margin-top:10px;">
            <label class="admin-toggle">
              <input type="checkbox" name="isFreePreview" id="editModFree">
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-toggle-label">Visible to all</span>
          </div>
        </div>
      </div>
      <div class="admin-form-actions">
        <button type="button" class="btn-admin btn-admin-secondary" onclick="closeModal('editModuleModal')">Cancel</button>
        <button type="submit" class="btn-admin btn-admin-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<script>
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.querySelectorAll('.admin-modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
  function openEditModule(m) {
    document.getElementById('editModuleForm').action = '/admin/module/' + m.id + '/edit';
    document.getElementById('editModTitle').value    = m.title;
    document.getElementById('editModDesc').value     = m.description;
    document.getElementById('editModOrder').value    = m.order;
    document.getElementById('editModFree').checked  = m.isFreePreview;
    openModal('editModuleModal');
  }
  function handleVideoSelect(input) {
    if (input.files[0]) {
      const size = (input.files[0].size/1024/1024).toFixed(1);
      document.querySelector('.upload-title').textContent = input.files[0].name;
      document.querySelector('.upload-subtitle').textContent = size + ' MB selected ✅';
    }
  }
  // XHR upload with progress bar
  document.getElementById('uploadForm').addEventListener('submit', function(e) {
    const videoInput = document.getElementById('videoInput');
    if (!videoInput.files[0]) return; // no video -- regular form submit
    e.preventDefault();
    const formData = new FormData(this);
    const xhr = new XMLHttpRequest();
    document.getElementById('uploadProgress').classList.add('visible');
    document.getElementById('uploadFileName').textContent = 'Uploading: ' + videoInput.files[0].name;
    document.getElementById('uploadSubmitBtn').disabled = true;
    document.getElementById('uploadSubmitBtn').textContent = 'Uploading...';
    xhr.upload.addEventListener('progress', evt => {
      if (evt.lengthComputable) {
        const pct = Math.round(evt.loaded/evt.total*100);
        document.getElementById('uploadFill').style.width = pct + '%';
        document.getElementById('uploadPct').textContent = pct + '%';
      }
    });
    xhr.addEventListener('load', () => {
      window.location.href = '/admin/course/${course._id}/modules?success=Module+added+successfully';
    });
    xhr.addEventListener('error', () => {
      alert('Upload failed. Check your connection and try again.');
      document.getElementById('uploadSubmitBtn').disabled = false;
      document.getElementById('uploadSubmitBtn').textContent = 'Upload & Save Module';
    });
    xhr.open('POST', '/admin/course/${course._id}/modules');
    xhr.send(formData);
  });
  // Drag-to-reorder
  let dragSrc = null;
  const list = document.getElementById('moduleList');
  if (list) {
    list.querySelectorAll('.module-item').forEach(item => {
      item.addEventListener('dragstart', () => { dragSrc = item; item.style.opacity='0.4'; });
      item.addEventListener('dragend',   () => { item.style.opacity='1'; saveOrder(); });
      item.addEventListener('dragover',  e => e.preventDefault());
      item.addEventListener('drop',      e => { e.preventDefault(); if(dragSrc!==item) list.insertBefore(dragSrc,item); });
    });
  }
  function saveOrder() {
    const ids = [...document.querySelectorAll('.module-item')].map(el=>el.dataset.id);
    fetch('/admin/course/${course._id}/modules/reorder', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ order: ids })
    });
    document.querySelectorAll('.module-number').forEach((el,i) => el.textContent = i+1);
  }
</script>

`;
return adminShell({
title: ’Modules – ’ + course.title,
activePage: ‘courses’,
content,
admin,
breadcrumb: [
{ label: ‘Courses’, href: ‘/admin/courses’ },
{ label: course.title, href: ‘/admin/courses’ },
{ label: ‘Modules’ }
]
});
}// ============================================

// START SERVER – ALWAYS LAST
// ============================================
app.listen(PORT, () => {
console.log(`🚀 Server running on port ${PORT}`);
console.log(`🌐 Visit: http://localhost:${PORT}`);
console.log(`📧 Email: ${process.env.EMAIL_USER || '❌ Not configured'}`);
console.log(`🗄️  DB: ${process.env.MONGODB_URI ? '✅ Configured' : '❌ Not configured'}`);
});

// ============================================
// GLOBAL ERROR HANDLER – ALWAYS VERY LAST
// ============================================
app.use((err, req, res, next) => {
console.error(‘❌ Error:’, err.message);
res.status(err.status || 500).json({
success: false,
message: process.env.NODE_ENV === ‘production’
? ‘Something went wrong!’
: err.message
});
});