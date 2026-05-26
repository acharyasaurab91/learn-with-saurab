const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Course = require('../models/Course');
const TestAttempt = require('../models/TestAttempt');
const MistakeEntry = require('../models/MistakeEntry');
const StudentNote = require('../models/StudentNote');
const User = require('../models/User');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [enrolledCourses, recentAttempts, topMistakes] = await Promise.all([
      Course.find({ _id: { $in: req.user.enrolledCourses } }),
      TestAttempt.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5).populate('testId', 'title'),
      MistakeEntry.find({ studentId: req.user._id, mastered: false }).sort({ timesMistaken: -1 }).limit(5)
    ]);
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      enrolledCourses,
      recentAttempts,
      topMistakes,
      welcome: req.query.welcome === '1'
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load dashboard.', user: req.user });
  }
});

router.get('/my-courses', requireLogin, async (req, res) => {
  try {
    const courses = await Course.find({ _id: { $in: req.user.enrolledCourses } });
    res.render('my-courses', { title: 'My Courses', courses, user: req.user });
  } catch (err) {
    res.render('error', { title: 'Error', message: 'Could not load courses.', user: req.user });
  }
});

router.get('/profile', requireLogin, async (req, res) => {
  res.render('profile', { title: 'My Profile', user: req.user, msg: req.query.msg || '', error: '' });
});

router.post('/profile', requireLogin, async (req, res) => {
  try {
    const { firstName, lastName, mobile } = req.body;
    await User.findByIdAndUpdate(req.user._id, { firstName, lastName, mobile });
    res.redirect('/profile?msg=Profile+updated+successfully');
  } catch (err) {
    res.render('profile', { title: 'My Profile', user: req.user, msg: '', error: 'Update failed.' });
  }
});

router.post('/progress/video', requireLogin, async (req, res) => {
  try {
    const { courseId, videoId, duration } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'progress.totalMinutesWatched': Math.floor((parseInt(duration) || 0) / 60) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/my-tests', requireLogin, async (req, res) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).populate('testId', 'title category');
    res.render('my-tests', { title: 'My Tests', attempts, user: req.user });
  } catch (err) {
    res.render('error', { title: 'Error', message: 'Could not load tests.', user: req.user });
  }
});

module.exports = router;
