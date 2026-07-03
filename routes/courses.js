const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Category = require('../models/Category');
const Review = require('../models/Review');
const mongoose = require('mongoose');
const { requireLogin } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');
const { reviewNotificationEmailHtml } = require('../utils/reviewNotificationEmail');

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function sendReviewNotification({ req, user, course, rating, comment }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'contactsaurabsir@gmail.com';
  const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Student';
  const baseUrl = getBaseUrl(req);
  const html = reviewNotificationEmailHtml({
    studentName,
    studentEmail: user.email,
    courseTitle: course.title,
    courseUrl: `${baseUrl}/courses/${course._id}`,
    rating,
    comment,
    adminReviewsUrl: `${baseUrl}/admin/reviews`
  });
  await sendEmail(adminEmail, `⭐ New Review (${rating}/5) on "${course.title}"`, html);
}

async function recalcCourseRating(courseId) {
  const stats = await Review.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: '$courseId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const avg = stats.length ? stats[0].avg : 0;
  const count = stats.length ? stats[0].count : 0;
  await Course.findByIdAndUpdate(courseId, { rating: Math.round(avg * 10) / 10, totalRatings: count });
}

router.get('/', async (req, res) => {
  try {
    const { category, search, examType } = req.query;
    const filter = { isPublished: true };
    if (category) filter.category = category;
    if (examType) filter.examType = examType;
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
    const reviews = await Review.find({ courseId: course._id }).populate('userId', 'firstName lastName').sort({ createdAt: -1 }).limit(50);
    const myReview = req.user ? reviews.find(r => r.userId && r.userId._id.toString() === req.user._id.toString()) : null;
    const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
      star, count: reviews.filter(r => r.rating === star).length
    }));
    res.render('course-preview', { title: course.title, course, isEnrolled, related, reviews, myReview, ratingBreakdown, query: req.query, user: req.user || null });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load course.', user: req.user || null });
  }
});

router.post('/:id/review', requireLogin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.redirect('/browse-courses');
    const isEnrolled = req.user.enrolledCourses.some(id => id.toString() === course._id.toString());
    if (!isEnrolled) {
      return res.redirect(`/courses/${course._id}?error=Enroll+in+this+course+to+leave+a+review`);
    }
    const rating = parseInt(req.body.rating);
    const comment = (req.body.comment || '').trim();
    if (!rating || rating < 1 || rating > 5) {
      return res.redirect(`/courses/${course._id}?error=Please+select+a+rating+from+1+to+5`);
    }
    const existingReview = await Review.findOne({ courseId: course._id, userId: req.user._id });
    await Review.findOneAndUpdate(
      { courseId: course._id, userId: req.user._id },
      { rating, comment },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await recalcCourseRating(course._id);
    if (!existingReview) {
      sendReviewNotification({ req, user: req.user, course, rating, comment })
        .catch(err => console.error('Review notification email error:', err));
    }
    res.redirect(`/courses/${course._id}?msg=Thanks+for+your+review!#reviews`);
  } catch (err) {
    console.error(err);
    res.redirect(`/courses/${req.params.id}?error=Could+not+submit+review`);
  }
});

router.delete('/:id/review', requireLogin, async (req, res) => {
  try {
    await Review.findOneAndDelete({ courseId: req.params.id, userId: req.user._id });
    await recalcCourseRating(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
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
