/* ============================================
   LEARN WITH SAURAB - Main Server (Clean MVC)
   Replaces 3961-line monolith
   ============================================ */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { loadUser } = require('./middleware/auth');
const { generalLimiter } = require('./middleware/rateLimiter');
const xssSanitizer = require('./middleware/xssSanitizer');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================ ENV VALIDATION
// Sessions cannot be signed without a real secret — fail fast instead of
// silently falling back to a hardcoded one.
if (!process.env.SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET is missing. Set SESSION_SECRET in .env (Freebuff → Settings → Environment) before starting the server.'
  );
}

// ============================================ DATABASE
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ============================================ APP SETTINGS
// Trust Replit's reverse proxy
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================ STATIC FILES
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  setHeaders: (res) => {
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store');
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================ COMPRESSION
app.use(compression());

// ============================================ BODY PARSERS (one of each)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// ============================================ SECURITY
app.use(cors({ origin: process.env.BASE_URL || true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ============================================ SESSION
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 7 * 24 * 60 * 60,
    touchAfter: 24 * 3600,
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// ============================================ GLOBAL MIDDLEWARE
app.use(loadUser);

// Rate limiters: the general limiter runs globally here; the strict auth
// limiter (authLimiter, 10/15min) is applied per-route on login, signup,
// forgot-password and reset-password inside routes/auth.js
app.use(generalLimiter);

// Flash messages helper
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;
  next();
});

// Ensure upload directories exist
['uploads/videos', 'uploads/course-images', 'uploads/question-images', 'uploads/resources', 'uploads/notes-pdfs'].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// ============================================ XSS SANITIZER
app.use(xssSanitizer);

// ============================================ ROUTES

// Auth: login, register, logout, forgot-password
app.use('/', require('./routes/auth'));

// Home page
app.get('/', async (req, res) => {
  try {
    const Course = require('./models/Course');
    const Category = require('./models/Category');
    // DB query is primary: only visible categories, sorted by order
    const categories = await Category.find({ isVisible: true }).sort({ order: 1 });
    const slugs = categories.map(c => c.slug);
    const [featuredCourses, demoCourses, countAgg] = await Promise.all([
      Course.find({ isPublished: true, isFeatured: true }).sort({ createdAt: -1 }).limit(6),
      Course.find({ isPublished: true, demoVideoUrl: { $exists: true, $ne: '' } })
            .sort({ createdAt: -1 }).limit(3)
            .select('title description category examType imageUrl demoVideoUrl demoVideoType demoTitle'),
      slugs.length
        ? Course.aggregate([
            { $match: { category: { $in: slugs }, isPublished: true } },
            { $group: { _id: '$category', n: { $sum: 1 } } }
          ])
        : Promise.resolve([])
    ]);
    const courseCounts = {};
    countAgg.forEach(c => { courseCounts[c._id] = c.n; });
    res.render('index', {
      title: "Nepal's #1 Exam Prep Platform | Learn With Saurab",
      categories,
      featuredCourses,
      demoCourses,
      courseCounts,
      user: req.user || null
    });
  } catch (err) {
    console.error('Home route error:', err.message);
    res.render('index', {
      title: 'Learn With Saurab',
      categories: [],
      featuredCourses: [],
      demoCourses: [],
      courseCounts: {},
      user: req.user || null
    });
  }
});

// Courses (also /browse-courses alias used in nav)
app.use('/courses', require('./routes/courses'));
app.use('/browse-courses', require('./routes/courses'));

// Tests (also /free-tests alias used in nav)
app.use('/tests', require('./routes/tests'));
app.use('/free-tests', require('./routes/tests'));

// Dashboard — all student portal pages (also /profile, /my-courses, /my-tests aliases)
app.use('/dashboard', require('./routes/dashboard'));
app.use('/profile', require('./routes/dashboard'));
app.use('/my-courses', require('./routes/dashboard'));
app.use('/my-tests', require('./routes/dashboard'));
app.use('/live-class', require('./routes/dashboard'));

// Mistake / Weakness notebook
app.use('/mistake-notebook', require('./routes/mistakes'));

// Payment
app.use('/payment', require('./routes/payment'));

// Chapter notes (public, published-only)
app.use('/notes', require('./routes/notes'));

// Admin panel
app.use('/admin', require('./routes/admin'));

// Email verification notice page
app.get('/verify-email-notice', (req, res) => {
  const verifyEmail = req.session.pendingVerifyEmail || (req.user ? req.user.email : '');
  res.render('auth/verify-email-notice', {
    title: 'Verify Your Email | Learn With Saurab',
    user: req.user || null,
    verifyEmail,
    resent: req.query.resent === '1' ? true : undefined,
    error: req.query.error === '1' ? true : undefined
  });
});

// Static info pages
app.get('/about', (req, res) => res.render('about', {
  title: 'About | Learn With Saurab',
  user: req.user || null
}));
app.get('/contact', (req, res) => res.render('contact', {
  title: 'Contact Us | Learn With Saurab',
  user: req.user || null
}));
app.get('/terms', (req, res) => res.render('error', {
  title: 'Terms of Service',
  message: 'Our Terms of Service will be available soon.',
  user: req.user || null
}));
app.get('/privacy', (req, res) => res.render('error', {
  title: 'Privacy Policy',
  message: 'Our Privacy Policy will be available soon.',
  user: req.user || null
}));

// ============================================ VIDEO STREAMING (Protected)
app.get('/stream/*', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized — please log in.' });
  }
  const relPath = req.params[0];
  const filePath = path.join(__dirname, 'uploads', 'videos', relPath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not found.' });
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkSize
    });
    stream.pipe(res);
    stream.on('error', () => res.end());
  } else {
    res.writeHead(200, { 'Content-Length': fileSize });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => res.end());
  }
});

// ============================================ ERROR HANDLING
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 — Page Not Found',
    message: 'The page you are looking for does not exist. It may have been moved or deleted.',
    user: req.user || null
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred. Please try again.',
    user: req.user || null
  });
});

// ============================================ LISTEN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Learn With Saurab → http://0.0.0.0:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
