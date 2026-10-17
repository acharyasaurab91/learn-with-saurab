const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../middleware/admin');
const User = require('../models/User');
const Course = require('../models/Course');
const Test = require('../models/Test');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const TestAttempt = require('../models/TestAttempt');
const Module = require('../models/Module');
const VideoProgress = require('../models/VideoProgress');
const Review = require('../models/Review');
const mongoose = require('mongoose');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'video' ? 'uploads/videos' :
                file.fieldname === 'image' ? 'uploads/course-images' :
                file.fieldname === 'questionImage' ? 'uploads/question-images' : 'uploads/resources';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

// ─── Phase 6B: dedicated uploaders for the module builder ─────────────
// The shared `upload` above is deliberately untouched: it backs course
// create/edit, the legacy add-module route and question images at 2GB.
fs.mkdirSync('uploads/videos', { recursive: true });
fs.mkdirSync('uploads/resources', { recursive: true });

const VIDEO_EXTS = ['.mp4', '.webm', '.mov'];
const RESOURCE_EXTS = ['.pdf', '.pptx', '.docx', '.txt', '.zip'];
const VIDEO_MAX_MB = 500;          // configurable: bytes = MB * 1024 * 1024
const RESOURCE_MAX_MB = 50;
const VIDEO_TYPE_MSG = 'Video must be .mp4, .webm, or .mov under 500MB';
const RESOURCE_TYPE_MSG = 'Resource must be .pdf, .pptx, .docx, .txt, or .zip under 50MB';

// Unique, collision-resistant name: timestamp + random + sanitized original name
// (special chars stripped, extension kept, lowercased)
const builderFilename = (req, file, cb) => {
  const rawExt = path.extname(file.originalname || '');
  const ext = rawExt.toLowerCase().replace(/[^.a-z0-9]/g, '');
  const base = (path.basename(file.originalname || '', rawExt) || 'upload')
    .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'upload';
  cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`);
};

// Multer rejections (bad extension, oversize, unexpected field) → 400 JSON, never 500
const multerJson = (uploadMw, typeMsg) => (req, res, next) =>
  uploadMw(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? typeMsg
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Unexpected file field.'
      : (err.message || typeMsg);
    res.status(400).json({ success: false, message });
  });

const uploadVideoFile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/videos'),
    filename: builderFilename
  }),
  limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!VIDEO_EXTS.includes(ext)) return cb(new Error(VIDEO_TYPE_MSG));
    cb(null, true);
  }
});

const uploadResourceFile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/resources'),
    filename: builderFilename
  }),
  limits: { fileSize: RESOURCE_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!RESOURCE_EXTS.includes(ext)) return cb(new Error(RESOURCE_TYPE_MSG));
    cb(null, true);
  }
});

const videoUploadMw = multerJson(uploadVideoFile.single('videoFile'), VIDEO_TYPE_MSG);
const resourceUploadMw = multerJson(uploadResourceFile.single('resourceFile'), RESOURCE_TYPE_MSG);

// Auto-detect resourceType from extension (a non-empty form value always wins)
const RESOURCE_TYPE_BY_EXT = {
  '.pdf': 'pdf', '.pptx': 'ppt', '.ppt': 'ppt',
  '.docx': 'doc', '.doc': 'doc', '.txt': 'txt', '.zip': 'zip'
};
const detectResourceType = (name) => {
  const clean = String(name || '').split(/[?#]/)[0];   // strip URL query/hash
  return RESOURCE_TYPE_BY_EXT[path.extname(clean).toLowerCase()] || '';
};

// Best-effort cleanup when a request is rejected after multer already wrote the file
const discardUploaded = (file) => {
  if (!file || !file.path) return;
  try { fs.unlinkSync(file.path); } catch (e) { /* already gone */ }
};

router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const [userCount, courseCount, testCount, revenue, recentUsers, recentTxns] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Course.countDocuments(),
      Test.countDocuments(),
      Transaction.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.find({ isAdmin: false }).sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt'),
      Transaction.find({ status: 'completed' }).sort({ createdAt: -1 }).limit(5).populate('userId', 'firstName email').populate('courseId', 'title')
    ]);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const signupData = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, isAdmin: false } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.render('admin/index', {
      title: 'Admin Dashboard',
      admin: req.admin,
      user: req.admin,
      stats: {
        users: userCount, courses: courseCount, tests: testCount,
        revenue: revenue[0]?.total || 0
      },
      recentUsers, recentTxns,
      signupData: JSON.stringify(signupData)
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

// ─── CATEGORY MANAGEMENT ────────────────────────────────────────────
// All routes below are covered by router.use(requireAdmin) at the top of this
// file, which verifies session.userId exists AND re-loads the user from the DB
// to confirm isAdmin (never trusts the session for admin status).
const parseSubjects = (s) =>
  Array.isArray(s) ? s.map(x => String(x).trim()).filter(Boolean)
  : s ? String(s).split(',').map(x => x.trim()).filter(Boolean) : [];
const isValidHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c || '');

router.get('/categories', async (req, res) => {
  const categories = await Category.find().sort({ order: 1 });
  res.render('admin/categories', { title: 'Manage Categories', categories, admin: req.admin, user: req.admin });
});

router.get('/categories/new', (req, res) => {
  res.render('admin/category-form', { title: 'Add Category', category: null, admin: req.admin, user: req.admin });
});

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, icon, color, description, subjects, order, isVisible } = req.body;
    if (!name || !name.trim()) {
      req.session.flash = { error: 'Category name is required.' };
      return res.redirect('/admin/categories/new');
    }
    await Category.create({
      name: name.trim(),
      slug: (slug || '').trim(),
      icon: icon && icon.trim() ? icon.trim() : undefined,
      color: isValidHex(color) ? color : undefined,
      description: description || '',
      subjects: parseSubjects(subjects),
      isVisible: isVisible === 'true',
      order: Number(order) || 0
    });
    req.session.flash = { success: 'Category saved.' };
    res.redirect('/admin/categories');
  } catch (err) {
    req.session.flash = { error: err.message };
    res.redirect('/admin/categories/new');
  }
});

// Must stay BEFORE any POST /categories/:id* route so "reorder" is not captured as an :id
router.post('/categories/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ ok: false, success: false, message: 'order array required' });
    }
    if (order.length && typeof order[0] === 'object' && order[0] !== null) {
      // Spec shape: [{ id, order }, ...]
      await Promise.all(order.map(item => Category.findByIdAndUpdate(item.id, { order: Number(item.order) || 0 })));
    } else {
      // Back-compat: plain id array (legacy drag-reorder)
      await Promise.all(order.map((id, idx) => Category.findByIdAndUpdate(id, { order: idx })));
    }
    res.json({ ok: true, success: true });
  } catch (err) {
    res.status(500).json({ ok: false, success: false, message: err.message });
  }
});

router.get('/categories/:id/edit', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      req.session.flash = { error: 'Category not found.' };
      return res.redirect('/admin/categories');
    }
    res.render('admin/category-form', { title: 'Edit: ' + category.name, category, admin: req.admin, user: req.admin });
  } catch (err) {
    req.session.flash = { error: err.message };
    res.redirect('/admin/categories');
  }
});

// Update — uses doc.save() so the slug auto-generation hook runs
router.post('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      req.session.flash = { error: 'Category not found.' };
      return res.redirect('/admin/categories');
    }
    const { name, slug, icon, color, description, subjects, order, isVisible } = req.body;
    if (!name || !name.trim()) {
      req.session.flash = { error: 'Category name is required.' };
      return res.redirect('/admin/categories/' + req.params.id + '/edit');
    }
    category.name = name.trim();
    category.slug = (slug || '').trim();
    category.icon = icon && icon.trim() ? icon.trim() : 'fas fa-book';
    if (isValidHex(color)) category.color = color;
    category.description = description || '';
    category.subjects = parseSubjects(subjects);
    category.isVisible = isVisible === 'true';
    category.order = Number(order) || 0;
    await category.save();
    req.session.flash = { success: 'Category saved.' };
    res.redirect('/admin/categories');
  } catch (err) {
    req.session.flash = { error: err.message };
    res.redirect('/admin/categories');
  }
});

router.post('/categories/:id/delete', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    req.session.flash = { success: 'Category deleted.' };
  } catch (err) {
    req.session.flash = { error: err.message };
  }
  res.redirect('/admin/categories');
});

// AJAX: flips isVisible, returns JSON {isVisible: bool}
router.post('/categories/:id/toggle', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ ok: false, message: 'Category not found.' });
    category.isVisible = !category.isVisible;
    await category.save();
    res.json({ isVisible: category.isVisible });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Legacy AJAX verbs kept for existing consumers (the old modal view used PUT/DELETE)
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, slug, icon, color, description, subjects, isVisible, order } = req.body;
    const subjectsArr = subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [];
    await Category.findByIdAndUpdate(req.params.id, { name, slug, icon, color, description, subjects: subjectsArr, isVisible: isVisible === 'true', order: order || 0 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) filter.title = new RegExp(search, 'i');
    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.render('admin/courses', { title: 'Manage Courses', courses, admin: req.admin, user: req.admin, query: req.query });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.get('/courses/new', async (req, res) => {
  const categories = await Category.find().sort({ order: 1 });
  res.render('admin/course-form', { title: 'New Course', course: null, categories, admin: req.admin, user: req.admin });
});

router.post('/courses', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'demoVideo', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, description, price, duration, category, subject, examType, demoVideoUrl, demoVideoType, demoTitle, isFeatured, isPublished, stream, thumbnailMode, imageUrl } = req.body;
    let targetPrograms = req.body.targetPrograms;
    if (targetPrograms && !Array.isArray(targetPrograms)) targetPrograms = [targetPrograms];
    const course = new Course({
      title, description, price: parseFloat(price) || 0,
      duration: parseInt(duration) || 0,
      category, subject, examType,
      targetPrograms: targetPrograms || [],
      stream: stream || '',
      demoVideoUrl, demoVideoType: demoVideoType || 'youtube', demoTitle,
      isFeatured: isFeatured === 'on',
      isPublished: isPublished === 'on'
    });
    if (req.files && req.files.demoVideo) {
      course.demoVideoUrl = '/' + req.files.demoVideo[0].path.replace(/\\/g, '/');
      course.demoVideoType = 'local';
    }
    if (thumbnailMode === 'url' && imageUrl && imageUrl.trim()) {
      course.imageUrl = imageUrl.trim();
    } else if (req.files && req.files.image) {
      course.imagePath = req.files.image[0].path;
      course.imageUrl = '/' + req.files.image[0].path.replace(/\\/g, '/');
    }
    await course.save();
    req.session.flash = { success: 'Course saved. Add modules next.' };
    res.redirect('/admin/courses/' + course._id + '/modules');
  } catch (err) {
    res.redirect('/admin/courses?error=' + encodeURIComponent(err.message));
  }
});

router.get('/courses/:id/edit', async (req, res) => {
  try {
    const [course, categories] = await Promise.all([Course.findById(req.params.id), Category.find().sort({ order: 1 })]);
    if (!course) return res.redirect('/admin/courses?error=Not+found');
    res.render('admin/course-form', { title: 'Edit Course', course, categories, admin: req.admin, user: req.admin });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

router.post('/courses/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'demoVideo', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, description, price, duration, category, subject, examType, demoVideoUrl, demoVideoType, demoTitle, isFeatured, isPublished, stream, thumbnailMode, imageUrl } = req.body;
    let targetPrograms = req.body.targetPrograms;
    if (targetPrograms && !Array.isArray(targetPrograms)) targetPrograms = [targetPrograms];
    const update = {
      title, description, price: parseFloat(price) || 0,
      duration: parseInt(duration) || 0,
      category, subject, examType,
      targetPrograms: targetPrograms || [],
      stream: stream || '',
      demoTitle, demoVideoType: demoVideoType || 'youtube',
      isFeatured: isFeatured === 'on', isPublished: isPublished === 'on'
    };
    if (demoVideoUrl) update.demoVideoUrl = demoVideoUrl;
    if (thumbnailMode === 'url' && imageUrl && imageUrl.trim()) {
      update.imageUrl = imageUrl.trim();
    } else if (req.files && req.files.image) {
      update.imagePath = req.files.image[0].path;
      update.imageUrl = '/' + req.files.image[0].path.replace(/\\/g, '/');
    }
    if (req.files && req.files.demoVideo) {
      update.demoVideoUrl = '/' + req.files.demoVideo[0].path.replace(/\\/g, '/');
      update.demoVideoType = 'local';
    }
    await Course.findByIdAndUpdate(req.params.id, update);
    req.session.flash = { success: 'Course saved. Add modules next.' };
    res.redirect('/admin/courses/' + req.params.id + '/modules');
  } catch (err) {
    res.redirect('/admin/courses?error=' + encodeURIComponent(err.message));
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/courses/:id/modules', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.redirect('/admin/courses');
    const modules = await Module.find({ course: course._id }).sort({ order: 1 });
    res.render('admin/modules', { title: 'Modules: ' + course.title, course, modules, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.post('/courses/:id/modules', upload.single('video'), async (req, res) => {
  try {
    const { title, description, isFreePreview, order } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const moduleData = {
      course: course._id,
      title, description,
      isFreePreview: isFreePreview === 'true' || isFreePreview === 'on',
      order: parseInt(order) || 1
    };
    if (req.file) {
      moduleData.videoPath = req.file.path.replace(/\\/g, '/');
      moduleData.videoFilename = req.file.filename;
    }
    const mod = await Module.create(moduleData);
    res.json({ success: true, module: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/modules/:id', async (req, res) => {
  try {
    const mod = await Module.findByIdAndDelete(req.params.id);
    if (mod && mod.videoPath && fs.existsSync(mod.videoPath)) {
      fs.unlinkSync(mod.videoPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/courses/:id/modules/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    await Promise.all(order.map((id, idx) => Module.findByIdAndUpdate(id, { order: idx + 1 })));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/tests', async (req, res) => {
  try {
    const tests = await Test.find().sort({ createdAt: -1 });
    res.render('admin/tests', { title: 'Manage Tests', tests, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.post('/tests', async (req, res) => {
  try {
    const { title, description, category, courseId, subject, duration, totalMarks, passMarks, negativeMarking, negativeMarkValue, isFree, isPublished } = req.body;
    const test = await Test.create({
      title, description, category, subject,
      courseId: courseId || null,
      duration: parseInt(duration) || 30,
      totalMarks: parseInt(totalMarks) || 20,
      passMarks: parseInt(passMarks) || 10,
      negativeMarking: negativeMarking === 'on',
      negativeMarkValue: parseFloat(negativeMarkValue) || 0.25,
      isFree: isFree === 'on',
      isPublished: isPublished === 'on'
    });
    req.session.flash = { success: 'Test saved. Add questions now.' };
    res.redirect(`/admin/tests/${test._id}/questions`);
  } catch (err) {
    req.session.flash = { error: err.message };
    res.redirect('/admin/tests/new');
  }
});

// ─── TEST BUILDER — form pages, update, delete, publish ─────────────
router.get('/tests/new', async (req, res) => {
  try {
    const [categories, courses] = await Promise.all([
      Category.find().sort({ order: 1 }),
      Course.find({}).sort({ title: 1 }).select('title')
    ]);
    res.render('admin/test-form', { title: 'New Test', test: null, categories, courses, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.get('/tests/:id/edit', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.redirect('/admin/tests');
    const [categories, courses] = await Promise.all([
      Category.find().sort({ order: 1 }),
      Course.find({}).sort({ title: 1 }).select('title')
    ]);
    res.render('admin/test-form', { title: 'Edit Test', test, categories, courses, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.post('/tests/:id', async (req, res) => {
  try {
    const { title, description, category, courseId, duration, totalMarks, passMarks, negativeMarking, negativeMarkValue, isFree, isPublished } = req.body;
    await Test.findByIdAndUpdate(req.params.id, {
      $set: {
        title, description, category,
        courseId: courseId || null,
        duration: parseInt(duration) || 30,
        totalMarks: parseInt(totalMarks) || 20,
        passMarks: parseInt(passMarks) || 10,
        negativeMarking: negativeMarking === 'on',
        negativeMarkValue: parseFloat(negativeMarkValue) || 0.25,
        isFree: isFree === 'on',
        isPublished: isPublished === 'on'
      }
    });
    req.session.flash = { success: 'Test saved. Add questions now.' };
    res.redirect(`/admin/tests/${req.params.id}/questions`);
  } catch (err) {
    req.session.flash = { error: err.message };
    res.redirect(`/admin/tests/${req.params.id}/edit`);
  }
});

router.post('/tests/:id/delete', async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    req.session.flash = { success: 'Test deleted.' };
  } catch (err) {
    req.session.flash = { error: 'Could not delete test: ' + err.message };
  }
  res.redirect('/admin/tests');
});

router.post('/tests/:id/publish', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    test.isPublished = !test.isPublished;
    await test.save();
    res.json({ success: true, isPublished: test.isPublished });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/tests/:id/questions', async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.redirect('/admin/tests');
    res.render('admin/questions', { title: 'Questions: ' + test.title, test, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.post('/tests/:id/questions', upload.single('questionImage'), async (req, res) => {
  try {
    const { questionText, options, correctOption, explanation, marks, difficulty, topic, tags } = req.body;
    const optionsArr = Array.isArray(options) ? options : [options];
    const correctIdx = parseInt(correctOption);
    const questionData = {
      questionText,
      options: optionsArr.map((text, i) => ({ text, isCorrect: i === correctIdx })),
      explanation, marks: parseInt(marks) || 1,
      difficulty: difficulty || 'Medium',
      topic, tags: tags ? tags.split(',').map(t => t.trim()) : []
    };
    if (req.file) questionData.questionImage = '/' + req.file.path.replace(/\\/g, '/');
    await Test.findByIdAndUpdate(req.params.id, { $push: { questions: questionData } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/tests/:testId/questions/:qId', async (req, res) => {
  try {
    await Test.findByIdAndUpdate(req.params.testId, { $pull: { questions: { _id: req.params.qId } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Spec-named alias (POST) — same behavior as the DELETE above
router.post('/tests/:id/questions/:qid/delete', async (req, res) => {
  try {
    await Test.findByIdAndUpdate(req.params.id, { $pull: { questions: { _id: req.params.qid } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.put('/tests/:id/questions/:qid', upload.single('questionImage'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    const q = test.questions.id(req.params.qid);
    if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
    const { questionText, options, correctOption, explanation, marks, difficulty, topic, tags } = req.body;
    const optionsArr = Array.isArray(options) ? options : [options];
    const correctIdx = parseInt(correctOption);
    q.questionText = questionText;
    q.options = optionsArr.map((text, i) => ({ text, isCorrect: i === correctIdx }));
    q.explanation = explanation;
    q.marks = parseInt(marks) || 1;
    q.difficulty = difficulty || 'Medium';
    q.topic = topic;
    q.tags = tags ? tags.split(',').map(t => t.trim()) : [];
    if (req.file) q.questionImage = '/' + req.file.path.replace(/\\/g, '/');
    await test.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/tests/:id', async (req, res) => {
  try {
    const { title, description, category, subject, duration, passMarks, negativeMarking, negativeMarkValue, isFree, isPublished } = req.body;
    await Test.findByIdAndUpdate(req.params.id, {
      title, description, category, subject,
      duration: parseInt(duration) || 30,
      passMarks: parseInt(passMarks) || 0,
      negativeMarking: negativeMarking === 'true',
      negativeMarkValue: parseFloat(negativeMarkValue) || 0.25,
      isFree: isFree === 'true',
      isPublished: isPublished === 'true'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/tests/:id', async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { isAdmin: false };
    if (search) filter.$or = [
      { email: new RegExp(search, 'i') },
      { username: new RegExp(search, 'i') },
      { firstName: new RegExp(search, 'i') }
    ];
    const users = await User.find(filter).sort({ createdAt: -1 }).select('-password');
    const courses = await Course.find().select('title');
    res.render('admin/users', { title: 'Manage Users', users, courses, admin: req.admin, user: req.admin, query: req.query });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.post('/users/:id/enroll', async (req, res) => {
  try {
    const { courseId } = req.body;
    await User.findByIdAndUpdate(req.params.id, { $addToSet: { enrolledCourses: courseId } });
    await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } });
    await Transaction.create({
      userId: req.params.id, courseId,
      amount: 0, transactionId: 'MANUAL-' + Date.now(),
      paymentMethod: 'manual', status: 'completed',
      notes: `Manual enrollment by admin ${req.admin.email}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email')
      .populate('courseId', 'title price');
    res.render('admin/transactions', { title: 'Transactions', transactions, admin: req.admin, user: req.admin });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.put('/transactions/:id/complete', async (req, res) => {
  try {
    const txn = await Transaction.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
    if (txn) {
      await User.findByIdAndUpdate(txn.userId, { $addToSet: { enrolledCourses: txn.courseId } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [signupData, revenueData, topCourses] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, isAdmin: false } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]),
      Course.find().sort({ enrolledCount: -1 }).limit(5).select('title enrolledCount price')
    ]);
    res.render('admin/analytics', {
      title: 'Analytics',
      admin: req.admin, user: req.admin,
      signupData: JSON.stringify(signupData),
      revenueData: JSON.stringify(revenueData),
      topCourses
    });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

// Demo Lectures management page
router.get('/demo-lectures', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 }).select('title category examType price demoVideoUrl demoVideoType demoTitle');
    res.render('admin/demo-lectures', { title: 'Demo Lectures', courses, admin: req.admin, user: req.admin, msg: req.query.msg });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

// Clear demo lecture from a course
router.post('/courses/:id/clear-demo', async (req, res) => {
  try {
    await Course.findByIdAndUpdate(req.params.id, { $unset: { demoVideoUrl: 1, demoTitle: 1 }, demoVideoType: 'youtube' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function recalcCourseRating(courseId) {
  const stats = await Review.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: '$courseId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const avg = stats.length ? stats[0].avg : 0;
  const count = stats.length ? stats[0].count : 0;
  await Course.findByIdAndUpdate(courseId, { rating: Math.round(avg * 10) / 10, totalRatings: count });
}

// Reviews moderation
router.get('/reviews', async (req, res) => {
  try {
    const { course: courseFilter, rating: ratingFilter } = req.query;
    const filter = {};
    if (courseFilter) filter.courseId = courseFilter;
    if (ratingFilter) filter.rating = parseInt(ratingFilter);
    const [reviews, courses] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'firstName lastName email')
        .populate('courseId', 'title')
        .sort({ createdAt: -1 }),
      Course.find().sort({ title: 1 }).select('title')
    ]);
    const totalReviews = await Review.countDocuments();
    const avgRatingAgg = await Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
    const overallAvg = avgRatingAgg.length ? avgRatingAgg[0].avg : 0;
    res.render('admin/reviews', {
      title: 'Reviews',
      reviews, courses, totalReviews, overallAvg,
      query: req.query,
      admin: req.admin, user: req.admin
    });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (review) await recalcCourseRating(review.courseId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/reviews/:id/reply', async (req, res) => {
  try {
    const reply = (req.body.reply || '').trim();
    if (!reply) {
      return res.status(400).json({ success: false, message: 'Reply cannot be empty.' });
    }
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { adminReply: reply, adminReplyAt: new Date() },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/reviews/:id/reply', async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, { $unset: { adminReply: 1, adminReplyAt: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── MODULE BUILDER ROUTES ────────────────────────────────────────
// JSON in / JSON out, same contract as the existing add-module and
// reorder handlers above (the old XHR callers keep working). The
// global express.json / express.urlencoded parsers in server.js mean
// both JSON and form-encoded bodies are accepted. Every route below
// sits behind router.use(requireAdmin), so unauthenticated requests
// get the 302 to /login before any handler runs.
const isObjId = (id) => mongoose.Types.ObjectId.isValid(id);
const asBool = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

// Load a module ONLY when it belongs to :id (the course); responds
// 404 itself on any id mismatch or miss, returns null in that case.
async function findModuleInCourse(req, res) {
  if (!isObjId(req.params.id) || !isObjId(req.params.mid)) {
    res.status(404).json({ success: false, message: 'Module not found.' });
    return null;
  }
  const mod = await Module.findOne({ _id: req.params.mid, course: req.params.id });
  if (!mod) {
    res.status(404).json({ success: false, message: 'Module not found.' });
    return null;
  }
  return mod;
}

// Edit module (title, description, order) — course membership verified
router.post('/courses/:id/modules/:mid/edit', async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) return;
    const { title, description, order } = req.body;
    if (title !== undefined && String(title).trim()) mod.title = String(title).trim();
    if (description !== undefined) mod.description = String(description);
    const newOrder = parseInt(order);
    if (!isNaN(newOrder)) mod.order = newOrder;
    await mod.save();
    res.json({ success: true, module: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete module — verifies courseId match, then removes the doc and
// its uploaded video file (same cleanup as the legacy DELETE /modules/:id)
router.post('/courses/:id/modules/:mid/delete', async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) return;
    await Module.deleteOne({ _id: mod._id });
    if (mod.videoPath && fs.existsSync(mod.videoPath)) fs.unlinkSync(mod.videoPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a video to Module.videos[] — multipart (file upload) OR JSON (URL);
// file mode stores the relative path in videoUrl: uploads/videos/<filename>
router.post('/courses/:id/modules/:mid/videos', videoUploadMw, async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) { discardUploaded(req.file); return; }
    const videoTitle = String(req.body.videoTitle || '').trim();
    const videoUrl = req.file
      ? 'uploads/videos/' + req.file.filename
      : String(req.body.videoUrl || '').trim();
    if (!videoTitle) {
      discardUploaded(req.file);
      return res.status(400).json({ success: false, message: 'Video title is required.' });
    }
    if (!videoUrl) {
      discardUploaded(req.file);
      return res.status(400).json({ success: false, message: 'Choose a video file or paste a URL.' });
    }
    mod.videos.push({
      videoTitle,
      videoUrl,
      duration: parseInt(req.body.duration) || 0,
      isFree: asBool(req.body.isFree),
      description: req.body.description ? String(req.body.description) : '',
      order: mod.videos.length
    });
    await mod.save();
    res.json({ success: true, module: mod });
  } catch (err) {
    discardUploaded(req.file);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Remove one entry from Module.videos[]
router.post('/courses/:id/modules/:mid/videos/:vid/delete', async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) return;
    const idx = mod.videos.findIndex(v => String(v._id) === req.params.vid);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Video not found.' });
    mod.videos.splice(idx, 1);
    await mod.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a resource to Module.resources[] — multipart (file upload) OR JSON (URL);
// file mode stores uploads/resources/<filename> and auto-detects resourceType
router.post('/courses/:id/modules/:mid/resources', resourceUploadMw, async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) { discardUploaded(req.file); return; }
    const title = String(req.body.title || '').trim();
    const fileUrl = req.file
      ? 'uploads/resources/' + req.file.filename
      : String(req.body.fileUrl || '').trim();
    if (!title) {
      discardUploaded(req.file);
      return res.status(400).json({ success: false, message: 'Resource title is required.' });
    }
    if (!fileUrl) {
      discardUploaded(req.file);
      return res.status(400).json({ success: false, message: 'Choose a resource file or paste a URL.' });
    }
    // Form override wins; otherwise auto-detect from uploaded file or pasted URL extension
    const override = String(req.body.resourceType || req.body.type || '').trim();
    mod.resources.push({
      title,
      fileUrl,
      // Schema field is resourceType (a literal `type` key inside the inline
      // subdocs literal collapses the array to [String]); accept legacy `type` too
      resourceType: override || detectResourceType(req.file ? req.file.originalname : fileUrl),
      isFree: asBool(req.body.isFree),
      order: mod.resources.length
    });
    await mod.save();
    res.json({ success: true, module: mod });
  } catch (err) {
    discardUploaded(req.file);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Remove one entry from Module.resources[]
router.post('/courses/:id/modules/:mid/resources/:rid/delete', async (req, res) => {
  try {
    const mod = await findModuleInCourse(req, res);
    if (!mod) return;
    const idx = mod.resources.findIndex(r => String(r._id) === req.params.rid);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Resource not found.' });
    mod.resources.splice(idx, 1);
    await mod.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Flip Course.isPublished (list-page toggle)
router.post('/courses/:id/toggle-publish', async (req, res) => {
  try {
    if (!isObjId(req.params.id)) return res.status(404).json({ success: false, message: 'Course not found.' });
    const course = await Course.findById(req.params.id).select('isPublished');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
    course.isPublished = !course.isPublished;
    await course.save();
    res.json({ success: true, isPublished: course.isPublished });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================ PHASE 6C — STUDENT PROGRESS VIEWS
// Read-only routes for admin student/progress monitoring.
// Decisions honoured here:
//  - VideoProgress.completed is the watched flag (there is no `watched` field)
//  - Total lessons = Option B (player-accurate): each standalone Module doc is
//    one lesson (course-learn keys progress by module._id); embedded
//    course.modules[].videos[] is only the fallback when none exist
//  - Enrollment date = read-only proxy reused from routes/dashboard.js
//    (earliest completed Transaction.createdAt, else first lesson activity,
//    else null → view prints "Unknown"); no schema changes

// lesson totals per course id (Option B above)
async function lessonTotalsByCourse(courseIds) {
  const totals = {};
  if (!courseIds.length) return totals;
  const oid = (id) => new mongoose.Types.ObjectId(String(id));
  const counts = await Module.aggregate([
    { $match: { course: { $in: courseIds.map(oid) } } },
    { $group: { _id: '$course', n: { $sum: 1 } } }
  ]);
  const standalone = {};
  counts.forEach(c => { standalone[String(c._id)] = c.n; });

  const embeddedOnly = courseIds.filter(id => standalone[String(id)] === undefined);
  if (embeddedOnly.length) {
    const courses = await Course.find({ _id: { $in: embeddedOnly } }).select('modules');
    courses.forEach(c => {
      totals[String(c._id)] = (c.modules || []).reduce((s, m) => s + (m.videos || []).length, 0);
    });
  }
  courseIds.forEach(id => {
    const k = String(id);
    if (standalone[k] !== undefined) totals[k] = standalone[k];
  });
  return totals;
}

// Per-user stats computed live from source collections (User.progress.*
// counters are write-only placeholders): tests taken, average score %,
// videos completed, last activity across both streams.
async function studentStatsByUser(userIds) {
  const stats = {};
  const oids = userIds.map(id => new mongoose.Types.ObjectId(String(id)));
  if (!oids.length) return stats;
  const [attempts, videos] = await Promise.all([
    TestAttempt.aggregate([
      { $match: { userId: { $in: oids } } },
      { $project: {
          completedAt: 1,
          pct: { $cond: [{ $gt: ['$totalMarks', 0] }, { $multiply: [{ $divide: ['$score', '$totalMarks'] }, 100] }, 0] }
      } },
      { $group: { _id: '$userId', tests: { $sum: 1 }, avg: { $avg: '$pct' }, last: { $max: '$completedAt' } } }
    ]),
    VideoProgress.aggregate([
      { $match: { userId: { $in: oids }, completed: true } },
      { $group: { _id: '$userId', done: { $sum: 1 }, last: { $max: '$updatedAt' } } }
    ])
  ]);
  const byId = {};
  attempts.forEach(a => {
    byId[String(a._id)] = { tests: a.tests, avg: Math.round(a.avg || 0), done: 0, last: a.last || null };
  });
  videos.forEach(v => {
    const k = String(v._id);
    const cur = byId[k] || { tests: 0, avg: 0, done: 0, last: null };
    cur.done = v.done;
    if (v.last && (!cur.last || new Date(v.last) > new Date(cur.last))) cur.last = v.last;
    byId[k] = cur;
  });
  userIds.forEach(id => {
    stats[String(id)] = byId[String(id)] || { tests: 0, avg: 0, done: 0, last: null };
  });
  return stats;
}

// Per (user, course): completed lessons, most recent activity, and the
// enrollment-date proxy — same derivation as routes/dashboard.js:
// earliest completed Transaction.createdAt, else first lesson activity.
async function courseActivityByUserCourse(userIds, courseIds) {
  const map = {};
  if (!userIds.length || !courseIds.length) return map;
  const uids = userIds.map(id => new mongoose.Types.ObjectId(String(id)));
  const cids = courseIds.map(id => new mongoose.Types.ObjectId(String(id)));
  const [progress, txns] = await Promise.all([
    VideoProgress.aggregate([
      { $match: { userId: { $in: uids }, courseId: { $in: cids } } },
      { $group: {
          _id: { u: '$userId', c: '$courseId' },
          done: { $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } },
          last: { $max: '$updatedAt' },
          first: { $min: '$createdAt' }
      } }
    ]),
    Transaction.aggregate([
      { $match: { userId: { $in: uids }, courseId: { $in: cids }, status: 'completed' } },
      { $group: { _id: { u: '$userId', c: '$courseId' }, at: { $min: '$createdAt' } } }
    ])
  ]);
  progress.forEach(p => {
    map[`${p._id.u}|${p._id.c}`] = { done: p.done, last: p.last, enrolledAt: p.first };
  });
  txns.forEach(t => {
    const k = `${t._id.u}|${t._id.c}`;
    const row = map[k] || { done: 0, last: null, enrolledAt: null };
    row.enrolledAt = t.at;   // a completed purchase date wins (dashboard parity)
    map[k] = row;
  });
  return map;
}

// ─── GET /admin/students — progress-focused student list ─────────────
router.get('/students', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { isAdmin: false };
    if (search) filter.$or = [
      { email: new RegExp(search, 'i') },
      { username: new RegExp(search, 'i') },
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') }
    ];
    const users = await User.find(filter).sort({ createdAt: -1 }).select('-password');
    const stats = await studentStatsByUser(users.map(u => u._id));
    res.render('admin/students', {
      title: 'Students', users, stats, admin: req.admin, user: req.admin, query: req.query
    });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

// ─── GET /admin/student/:id — one student's progress detail ──────────
router.get('/student/:id', async (req, res) => {
  try {
    if (!isObjId(req.params.id)) {
      return res.render('error', { title: 'Not Found', message: 'Student not found.', user: req.admin });
    }
    const student = await User.findById(req.params.id).select('-password');
    if (!student) {
      return res.render('error', { title: 'Not Found', message: 'Student not found.', user: req.admin });
    }

    const courseIds = (student.enrolledCourses || []).filter(Boolean);
    const [courses, totals, activity, stats, attempts] = await Promise.all([
      Course.find({ _id: { $in: courseIds } }),
      lessonTotalsByCourse(courseIds),
      courseActivityByUserCourse([student._id], courseIds),
      studentStatsByUser([student._id]),
      TestAttempt.find({ userId: student._id }).sort({ completedAt: -1 }).limit(10).populate('testId', 'title')
    ]);

    const enrolledCourses = courses.map(c => {
      const cid = String(c._id);
      const act = activity[`${student._id}|${cid}`] || { done: 0, last: null, enrolledAt: null };
      const total = totals[cid] || 0;
      const done = act.done || 0;
      return {
        course: c,
        total,
        done,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        lastActivity: act.last || null,
        enrolledAt: act.enrolledAt || null
      };
    });

    const me = stats[String(student._id)] || { tests: 0, avg: 0, done: 0, last: null };
    res.render('admin/student-detail', {
      title: `${student.firstName} ${student.lastName}`,
      student, enrolledCourses, attempts,
      stats: {
        tests: me.tests,
        avgScore: me.avg,
        videosDone: me.done,
        // only live source for minutes watched
        minutesWatched: (student.progress && student.progress.totalMinutesWatched) || 0,
        lastActivity: me.last || student.lastLogin || null
      },
      admin: req.admin, user: req.admin
    });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

// ─── GET /admin/courses/:id/students — roster + progress for one course ──
router.get('/courses/:id/students', async (req, res) => {
  try {
    if (!isObjId(req.params.id)) {
      return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.admin });
    }
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.admin });
    }

    const students = await User.find({ enrolledCourses: course._id, isAdmin: false })
      .sort({ createdAt: -1 }).select('-password');
    const ids = students.map(s => s._id);
    const [totals, activity, stats] = await Promise.all([
      lessonTotalsByCourse([course._id]),
      courseActivityByUserCourse(ids, [course._id]),
      studentStatsByUser(ids)
    ]);
    const total = totals[String(course._id)] || 0;

    const rows = students.map(s => {
      const act = activity[`${s._id}|${course._id}`] || { done: 0, last: null, enrolledAt: null };
      const me = stats[String(s._id)] || { tests: 0, avg: 0, last: null };
      const done = act.done || 0;
      return {
        student: s,
        done,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        tests: me.tests,
        avgScore: me.avg,
        lastActivity: act.last || me.last || null,
        enrolledAt: act.enrolledAt || null
      };
    });
    const avgPct = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;

    res.render('admin/course-students', {
      title: 'Course Students', course, rows, total, avgPct,
      admin: req.admin, user: req.admin
    });
  } catch (err) {
    res.render('error', { title: 'Error', message: err.message, user: req.admin });
  }
});

module.exports = router;
