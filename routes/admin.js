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

router.get('/categories', async (req, res) => {
  const categories = await Category.find().sort({ order: 1 });
  res.render('admin/categories', { title: 'Manage Categories', categories, admin: req.admin, user: req.admin });
});

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, icon, color, description, subjects, order } = req.body;
    const subjectsArr = subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : [];
    await Category.create({ name, slug: slug || name.toLowerCase().replace(/\s+/g, '-'), icon, color, description, subjects: subjectsArr, order: order || 0 });
    res.redirect('/admin/categories?msg=Category+created');
  } catch (err) {
    res.redirect('/admin/categories?error=' + encodeURIComponent(err.message));
  }
});

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

router.post('/categories/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    await Promise.all(order.map((id, idx) => Category.findByIdAndUpdate(id, { order: idx })));
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
    const { title, description, price, category, subject, examType, demoVideoUrl, demoVideoType, demoTitle, isFeatured, isPublished, stream } = req.body;
    let targetPrograms = req.body.targetPrograms;
    if (targetPrograms && !Array.isArray(targetPrograms)) targetPrograms = [targetPrograms];
    const course = new Course({
      title, description, price: parseFloat(price) || 0,
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
    if (req.files && req.files.image) {
      course.imagePath = req.files.image[0].path;
      course.imageUrl = '/' + req.files.image[0].path.replace(/\\/g, '/');
    }
    await course.save();
    res.redirect('/admin/courses?msg=Course+created');
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
    const { title, description, price, category, subject, examType, demoVideoUrl, demoVideoType, demoTitle, isFeatured, isPublished, stream } = req.body;
    let targetPrograms = req.body.targetPrograms;
    if (targetPrograms && !Array.isArray(targetPrograms)) targetPrograms = [targetPrograms];
    const update = {
      title, description, price: parseFloat(price) || 0,
      category, subject, examType,
      targetPrograms: targetPrograms || [],
      stream: stream || '',
      demoTitle, demoVideoType: demoVideoType || 'youtube',
      isFeatured: isFeatured === 'on', isPublished: isPublished === 'on'
    };
    if (demoVideoUrl) update.demoVideoUrl = demoVideoUrl;
    if (req.files && req.files.image) {
      update.imagePath = req.files.image[0].path;
      update.imageUrl = '/' + req.files.image[0].path.replace(/\\/g, '/');
    }
    if (req.files && req.files.demoVideo) {
      update.demoVideoUrl = '/' + req.files.demoVideo[0].path.replace(/\\/g, '/');
      update.demoVideoType = 'local';
    }
    await Course.findByIdAndUpdate(req.params.id, update);
    res.redirect('/admin/courses?msg=Course+updated');
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
    const { title, description, category, subject, duration, passMarks, negativeMarking, negativeMarkValue, isFree, isPublished } = req.body;
    const test = await Test.create({
      title, description, category, subject,
      duration: parseInt(duration) || 30,
      passMarks: parseInt(passMarks) || 0,
      negativeMarking: negativeMarking === 'on',
      negativeMarkValue: parseFloat(negativeMarkValue) || 0.25,
      isFree: isFree === 'on',
      isPublished: isPublished === 'on'
    });
    res.redirect(`/admin/tests/${test._id}/questions`);
  } catch (err) {
    res.redirect('/admin/tests?error=' + encodeURIComponent(err.message));
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

module.exports = router;
