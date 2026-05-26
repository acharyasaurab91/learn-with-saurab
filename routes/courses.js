const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Category = require('../models/Category');
const { requireLogin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, search, level } = req.query;
    const filter = { isPublished: true };
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (search) filter.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') }
    ];
    const [courses, categories] = await Promise.all([
      Course.find(filter).sort({ isFeatured: -1, createdAt: -1 }),
      Category.find({ isVisible: true }).sort({ order: 1 })
    ]);
    res.render('courses', { title: 'Browse Courses', courses, categories, user: req.user || null, query: req.query });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load courses.', user: req.user || null });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course || !course.isPublished) {
      return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.user || null });
    }
    const isEnrolled = req.user ? req.user.enrolledCourses.some(id => id.toString() === course._id.toString()) : false;
    const related = await Course.find({ category: course.category, _id: { $ne: course._id }, isPublished: true }).limit(3);
    res.render('course-preview', { title: course.title, course, isEnrolled, related, user: req.user || null });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load course.', user: req.user || null });
  }
});

router.get('/:id/learn', requireLogin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.render('error', { title: 'Not Found', message: 'Course not found.', user: req.user });
    const isEnrolled = req.user.enrolledCourses.some(id => id.toString() === course._id.toString());
    if (!isEnrolled && course.price > 0) {
      return res.redirect(`/courses/${course._id}?msg=Please+enroll+first`);
    }
    const { v: videoIdx, m: moduleIdx } = req.query;
    res.render('course-learn', {
      title: 'Learning: ' + course.title,
      course, isEnrolled,
      currentModule: parseInt(moduleIdx) || 0,
      currentVideo: parseInt(videoIdx) || 0,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load lesson.', user: req.user });
  }
});

module.exports = router;
