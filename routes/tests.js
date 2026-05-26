const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');
const MistakeEntry = require('../models/MistakeEntry');
const User = require('../models/User');
const { requireLogin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const tests = await Test.find({ isPublished: true }).select('-questions').sort({ createdAt: -1 });
    res.render('free-tests', { title: 'Free Practice Tests', tests, user: req.user || null });
  } catch (err) {
    res.render('error', { title: 'Error', message: 'Could not load tests.', user: req.user || null });
  }
});

router.get('/:testId/take', requireLogin, async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test || !test.isPublished) {
      return res.render('error', { title: 'Not Found', message: 'Test not found.', user: req.user });
    }
    if (!test.isFree) {
      const isEnrolled = test.courseId && req.user.enrolledCourses.some(id => id.toString() === test.courseId.toString());
      if (!isEnrolled) return res.redirect('/courses?msg=Enrollment+required');
    }
    const safeQuestions = test.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionImage: q.questionImage,
      options: q.options.map(o => ({ text: o.text })),
      marks: q.marks,
      difficulty: q.difficulty
    }));
    res.render('take-test', { title: 'Taking: ' + test.title, test, safeQuestions: JSON.stringify(safeQuestions), user: req.user });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load test.', user: req.user });
  }
});

router.post('/:testId/submit', requireLogin, async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    const test = await Test.findById(req.params.testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
    let score = 0;
    let totalMarks = 0;
    const processedAnswers = [];

    for (const q of test.questions) {
      totalMarks += q.marks;
      const ans = parsedAnswers.find(a => a.questionId === q._id.toString());
      const selected = ans ? ans.selectedOption : -1;
      const correctIdx = q.options.findIndex(o => o.isCorrect);
      processedAnswers.push({ questionId: q._id.toString(), selectedOption: selected });

      if (selected === correctIdx) {
        score += q.marks;
      } else if (selected !== -1 && test.negativeMarking) {
        score -= test.negativeMarkValue;
      }

      if (selected !== -1 && selected !== correctIdx && req.user) {
        const existing = await MistakeEntry.findOne({ studentId: req.user._id, questionId: q._id.toString() });
        if (existing) {
          existing.timesMistaken += 1;
          existing.studentAnswer = selected;
          existing.lastAttempted = new Date();
          await existing.save();
        } else {
          await MistakeEntry.create({
            studentId: req.user._id,
            questionId: q._id.toString(),
            testId: test._id,
            questionText: q.questionText,
            questionImage: q.questionImage,
            options: q.options,
            correctAnswer: correctIdx,
            studentAnswer: selected,
            explanation: q.explanation,
            topic: q.topic || test.category,
            difficulty: q.difficulty,
            tags: q.tags || []
          });
        }
      }
    }

    score = Math.max(0, score);
    const passed = test.passMarks ? score >= test.passMarks : score >= totalMarks * 0.5;

    const attempt = await TestAttempt.create({
      userId: req.user._id,
      testId: test._id,
      answers: processedAnswers,
      score, totalMarks, passed,
      timeTaken: parseInt(timeTaken) || 0
    });

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'progress.testsTaken': 1 },
      $set: { 'progress.avgScore': score }
    });

    await Test.findByIdAndUpdate(test._id, { $inc: { attemptCount: 1 } });

    res.json({ success: true, attemptId: attempt._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/result/:attemptId', requireLogin, async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId).populate('testId');
    if (!attempt || attempt.userId.toString() !== req.user._id.toString()) {
      return res.render('error', { title: 'Not Found', message: 'Result not found.', user: req.user });
    }
    const test = attempt.testId;
    const questionsWithResults = test.questions.map((q, i) => {
      const ans = attempt.answers.find(a => a.questionId === q._id.toString());
      const selected = ans ? ans.selectedOption : -1;
      const correctIdx = q.options.findIndex(o => o.isCorrect);
      return { ...q.toObject(), selected, correctIdx, isCorrect: selected === correctIdx };
    });
    res.render('test-result', {
      title: 'Test Result',
      attempt, test, questionsWithResults, user: req.user
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load result.', user: req.user });
  }
});

module.exports = router;
