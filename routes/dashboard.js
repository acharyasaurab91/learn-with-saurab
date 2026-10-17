const express = require('express');
const router = express.Router();
const { requireLogin, requireVerified } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const TestAttempt = require('../models/TestAttempt');
const MistakeEntry = require('../models/MistakeEntry');
const User = require('../models/User');
const VideoProgress = require('../models/VideoProgress');
const Setting = require('../models/Setting');

// Load the signed-in user with enrolled course documents populated.
async function loadUser(req) {
  return User.findById(req.session.userId).populate('enrolledCourses');
}

// Enrolled courses with deleted references dropped (never reassign the
// populated Mongoose array itself — that can drop the populated docs).
function enrolledCoursesOf(user) {
  return ((user && user.enrolledCourses) || []).filter(Boolean);
}

// Per-course data shared by /dashboard and /my-courses.
//  - courseProgress % : completed VideoProgress rows / total videos in course.modules[].videos[]
//  - lastAccessed     : most recent VideoProgress updatedAt per course
//  - enrollmentDate   : completed purchase date if any, else first lesson activity (no date is
//                       stored on User.enrolledCourses, so this is the best available signal)
async function computeCourseData(userId, courses) {
  const courseProgress = {};
  const lastAccessed = {};
  const enrollmentDate = {};
  const lastVideoId = {};
  if (!courses.length) return { courseProgress, lastAccessed, enrollmentDate, lastVideoId };

  const ids = courses.map(c => c._id);
  const [progRecords, txns] = await Promise.all([
    VideoProgress.find({ userId, courseId: { $in: ids } }).sort({ updatedAt: -1 }),
    Transaction.find({ userId, courseId: { $in: ids }, status: 'completed' }).sort({ createdAt: 1 })
  ]);

  courses.forEach(course => {
    const cid = course._id.toString();
    const totalVideos = (course.modules || []).reduce((sum, m) => sum + (m.videos || []).length, 0);
    const rows = progRecords.filter(p => p.courseId.toString() === cid);
    const watched = rows.filter(p => p.completed).length;
    courseProgress[cid] = totalVideos > 0 ? Math.round((watched / totalVideos) * 100) : 0;

    const purchase = txns.find(t => t.courseId.toString() === cid);
    if (rows.length) {
      lastAccessed[cid] = rows[0].updatedAt;                 // sorted desc → most recent
      lastVideoId[cid] = rows[0].videoId;
      const firstActivity = rows[rows.length - 1].createdAt; // sorted desc → oldest
      enrollmentDate[cid] = purchase ? purchase.createdAt : firstActivity;
    } else if (purchase) {
      enrollmentDate[cid] = purchase.createdAt;
    }
  });

  return { courseProgress, lastAccessed, enrollmentDate, lastVideoId };
}

// ─── GET /dashboard ─────────────────────────────────────────────────
async function showDashboard(req, res) {
  try {
    const user = await loadUser(req);
    if (!user) return res.redirect('/login');

    const enrolledCourses = enrolledCoursesOf(user);

    const [recentAttempts, topMistakes, courseData] = await Promise.all([
      TestAttempt.find({ userId: user._id }).sort({ completedAt: -1 }).limit(5).populate('testId', 'title'),
      MistakeEntry.find({ studentId: user._id, mastered: false }).sort({ timesMistaken: -1 }).limit(5),
      computeCourseData(user._id, enrolledCourses)
    ]);

    // Continue Learning → most recently accessed course, else most recently enrolled
    let continueCourse = null;
    if (enrolledCourses.length) {
      let recentId = null, recentAt = 0;
      enrolledCourses.forEach(c => {
        const at = courseData.lastAccessed[c._id.toString()];
        const t = at ? new Date(at).getTime() : 0;
        if (t > recentAt) { recentAt = t; recentId = c._id.toString(); }
      });
      continueCourse = recentId
        ? enrolledCourses.find(c => c._id.toString() === recentId)
        : enrolledCourses[enrolledCourses.length - 1];
    }

    res.render('dashboard', {
      title: 'Dashboard',
      user,
      enrolledCourses,
      recentAttempts,
      topMistakes,
      courseProgress: courseData.courseProgress,
      continueCourse,
      continuePct: continueCourse ? (courseData.courseProgress[continueCourse._id.toString()] || 0) : 0,
      welcome: req.query.welcome === '1',
      // Phase 7A: flash banner (e.g. "Payment submitted! Admin will verify shortly.")
      flashMsg: req.query.msg || ''
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load dashboard.', user: req.user || null });
  }
}

// ─── GET /my-courses ────────────────────────────────────────────────
async function showMyCourses(req, res) {
  try {
    const user = await loadUser(req);
    if (!user) return res.redirect('/login');

    const courses = enrolledCoursesOf(user);
    const { courseProgress, lastAccessed, enrollmentDate, lastVideoId } =
      await computeCourseData(user._id, courses);

    // Resolve the last watched lesson title per course
    const lastWatched = {};
    courses.forEach(course => {
      const cid = course._id.toString();
      const vid = lastVideoId[cid];
      if (!vid) return;
      for (const mod of course.modules || []) {
        const v = (mod.videos || []).find(x => x._id.toString() === vid || x.videoUrl === vid);
        if (v) { lastWatched[cid] = v.videoTitle; break; }
      }
    });

    // Separate into in-progress / not-started / completed
    const inProgress = courses.filter(c => { const p = courseProgress[c._id.toString()] || 0; return p > 0 && p < 100; });
    const notStarted = courses.filter(c => (courseProgress[c._id.toString()] || 0) === 0);
    const completed  = courses.filter(c => (courseProgress[c._id.toString()] || 0) === 100);

    // Total lesson count across all enrolled courses
    const totalLessons = courses.reduce((sum, c) => sum + (c.modules || []).reduce((s, m) => s + (m.videos || []).length, 0), 0);

    res.render('my-courses', {
      title: 'My Courses',
      courses,
      courseProgress,
      lastWatched,
      lastAccessed,
      enrollmentDate,
      inProgress,
      notStarted,
      completed,
      totalLessons,
      user
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load courses.', user: req.user || null });
  }
}

// ─── /profile ───────────────────────────────────────────────────────
async function showProfile(req, res) {
  res.render('profile', { title: 'My Profile', user: req.user, msg: req.query.msg || '', error: '' });
}

async function updateProfile(req, res) {
  try {
    const { firstName, lastName, mobile } = req.body;
    await User.findByIdAndUpdate(req.user._id, { firstName, lastName, mobile });
    res.redirect('/profile?msg=Profile+updated+successfully');
  } catch (err) {
    res.render('profile', { title: 'My Profile', user: req.user, msg: '', error: 'Update failed.' });
  }
}

// ─── /my-tests ──────────────────────────────────────────────────────
async function showMyTests(req, res) {
  try {
    const attempts = await TestAttempt.find({ userId: req.user._id })
      .sort({ completedAt: -1 }).populate('testId', 'title category');
    res.render('my-tests', { title: 'My Tests', attempts, user: req.user });
  } catch (err) {
    res.render('error', { title: 'Error', message: 'Could not load tests.', user: req.user || null });
  }
}

// ─── Dispatch ───────────────────────────────────────────────────────
// server.js mounts this same router at /dashboard, /my-courses, /profile and
// /my-tests. A GET or POST to the mount root (path '/') therefore has to pick
// the handler from req.baseUrl — otherwise every one of those URLs would fall
// through to the first registered handler (the dashboard view).
// ─── Phase 6.5 dispatch: the /live-class mount (path '/' inside this router) ──
// server.js also mounts this router at /live-class; serve the live class page
// there with requireLogin (per feature spec — not requireVerified) before the
// shared dispatch below claims the path.
router.get('/', requireLogin, (req, res, next) => {
  if (req.baseUrl === '/live-class') return showLiveClass(req, res, next);
  next();
});

router.get('/', requireVerified, (req, res, next) => {
  switch (req.baseUrl) {
    case '/my-courses': return showMyCourses(req, res, next);
    case '/profile':    return showProfile(req, res, next);
    case '/my-tests':   return showMyTests(req, res, next);
    default:            return showDashboard(req, res, next);
  }
});

router.post('/', requireVerified, (req, res, next) => {
  if (req.baseUrl === '/profile') return updateProfile(req, res, next);
  next();
});

// Explicit sub-paths (e.g. /dashboard/my-courses) kept for back-compat
router.get('/my-courses', requireVerified, showMyCourses);
router.get('/profile', requireVerified, showProfile);
router.post('/profile', requireVerified, updateProfile);
router.get('/my-tests', requireVerified, showMyTests);

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

// ─── Phase 6.5: Live class (/live-class) ───────────────────────────────
const LIVE_CLASS_TYPES = ['off', 'public', 'private'];
const LIVE_SETTING_KEYS = ['live_class_type', 'live_youtube_url', 'live_jitsi_room'];

// Same read helper as routes/admin.js (keys shared across the feature)
async function liveClassSettings() {
  const rows = await Setting.find({ key: { $in: LIVE_SETTING_KEYS } });
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    type: LIVE_CLASS_TYPES.includes(map.live_class_type) ? map.live_class_type : 'off',
    youtubeUrl: typeof map.live_youtube_url === 'string' ? map.live_youtube_url : '',
    jitsiRoom: typeof map.live_jitsi_room === 'string' ? map.live_jitsi_room : ''
  };
}

// Server-side video id parsing for the 4 URL formats (bare ids accepted too)
function youtubeVideoId(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;   // bare id pasted
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/,            // https://youtu.be/ID
    /[?&]v=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/,                  // youtube.com/watch?v=ID
    /\/(?:embed|live|shorts|v)\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/ // /embed|/live|/shorts|/v/ID
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ─── GET /live-class — student live class page (login required) ─────
async function showLiveClass(req, res, next) {
  try {
    if (!req.user) return res.redirect('/login');
    const settings = await liveClassSettings();
    const videoId = settings.type === 'public' ? youtubeVideoId(settings.youtubeUrl) : null;
    const room = settings.jitsiRoom;

    // Graceful degradation: a public/private type with no URL/room renders as off
    let mode = settings.type;
    if (mode === 'public' && !videoId) mode = 'off';
    if (mode === 'private' && !room) mode = 'off';

    // Paid gate (per approved decision): enrolledCourses.length > 0
    const isPaid = (req.user.enrolledCourses || []).length > 0;
    res.render('live-class', {
      title: 'Live Class',
      mode, videoId, room, isPaid,
      user: req.user
    });
  } catch (err) {
    console.error('Live class error:', err);
    res.render('error', { title: 'Error', message: 'Could not load the live class page.', user: req.user });
  }
}

// Sub-path kept like the other student pages (e.g. /dashboard/live-class);
// the primary URL /live-class is served by the mount dispatch above
router.get('/live-class', requireLogin, showLiveClass);

module.exports = router;
