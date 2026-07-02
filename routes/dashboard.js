const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const Course = require('../models/Course');
const TestAttempt = require('../models/TestAttempt');
const MistakeEntry = require('../models/MistakeEntry');
const User = require('../models/User');
const VideoProgress = require('../models/VideoProgress');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [enrolledCourses, recentAttempts, topMistakes] = await Promise.all([
      Course.find({ _id: { $in: req.user.enrolledCourses } }),
      TestAttempt.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5).populate('testId', 'title'),
      MistakeEntry.find({ studentId: req.user._id, mastered: false }).sort({ timesMistaken: -1 }).limit(5)
    ]);

    // Compute per-course progress % for dashboard preview
    let courseProgress = {};
    if (enrolledCourses.length > 0) {
      const progRecords = await VideoProgress.find({
        userId: req.user._id,
        courseId: { $in: enrolledCourses.map(c => c._id) }
      });
      enrolledCourses.forEach(course => {
        const totalVideos = course.modules.reduce((sum, m) => sum + m.videos.length, 0);
        const watched = progRecords.filter(p => p.courseId.toString() === course._id.toString() && p.completed).length;
        courseProgress[course._id.toString()] = totalVideos > 0 ? Math.round((watched / totalVideos) * 100) : 0;
      });
    }

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user,
      enrolledCourses,
      recentAttempts,
      topMistakes,
      courseProgress,
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

    // Compute real progress % per course
    let courseProgress = {};
    let lastWatched = {};
    if (courses.length > 0) {
      const [progRecords, lastRecords] = await Promise.all([
        VideoProgress.find({ userId: req.user._id, courseId: { $in: courses.map(c => c._id) } }),
        VideoProgress.find({ userId: req.user._id, courseId: { $in: courses.map(c => c._id) } })
          .sort({ updatedAt: -1 })
      ]);

      courses.forEach(course => {
        const cid = course._id.toString();
        const totalVideos = course.modules.reduce((sum, m) => sum + m.videos.length, 0);
        const watched = progRecords.filter(p => p.courseId.toString() === cid && p.completed).length;
        courseProgress[cid] = totalVideos > 0 ? Math.round((watched / totalVideos) * 100) : 0;

        // Find last watched video label for this course
        const last = lastRecords.find(p => p.courseId.toString() === cid);
        if (last) {
          for (const mod of course.modules) {
            const vid = mod.videos.find(v => v._id.toString() === last.videoId || v.videoUrl === last.videoId);
            if (vid) { lastWatched[cid] = vid.videoTitle; break; }
          }
        }
      });
    }

    // Separate into in-progress and not-started
    const inProgress = courses.filter(c => (courseProgress[c._id.toString()] || 0) > 0 && (courseProgress[c._id.toString()] || 0) < 100);
    const notStarted = courses.filter(c => (courseProgress[c._id.toString()] || 0) === 0);
    const completed  = courses.filter(c => (courseProgress[c._id.toString()] || 0) === 100);

    // Total lesson count across all enrolled courses
    const totalLessons = courses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.videos.length, 0), 0);

    res.render('my-courses', {
      title: 'My Courses',
      courses,
      courseProgress,
      lastWatched,
      inProgress,
      notStarted,
      completed,
      totalLessons,
      user: req.user
    });
  } catch (err) {
    console.error(err);
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

// Video progress — mark lesson watched + update minutes
router.post('/progress/video', requireLogin, async (req, res) => {
  try {
    const { courseId, videoId, duration } = req.body;
    const secs = parseInt(duration) || 0;

    const ops = [
      User.findByIdAndUpdate(req.user._id, {
        $inc: { 'progress.totalMinutesWatched': Math.floor(secs / 60) }
      })
    ];

    if (courseId && videoId) {
      // Mark video as completed (upsert so we don't double-count)
      ops.push(
        VideoProgress.findOneAndUpdate(
          { userId: req.user._id, courseId, videoId },
          {
            $set: { completed: true, completedAt: new Date() },
            $max: { watchedSecs: secs }
          },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    console.error('Video progress error:', err);
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
