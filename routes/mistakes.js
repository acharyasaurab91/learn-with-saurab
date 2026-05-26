const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const MistakeEntry = require('../models/MistakeEntry');
const Test = require('../models/Test');

router.get('/', requireLogin, async (req, res) => {
  try {
    const { topic, difficulty, mastered } = req.query;
    const filter = { studentId: req.user._id };
    if (topic) filter.topic = new RegExp(topic, 'i');
    if (difficulty) filter.difficulty = difficulty;
    if (mastered !== undefined) filter.mastered = mastered === 'true';

    const mistakes = await MistakeEntry.find(filter).sort({ timesMistaken: -1, lastAttempted: -1 });
    const topics = [...new Set(mistakes.map(m => m.topic).filter(Boolean))];
    const criticalCount = mistakes.filter(m => m.timesMistaken >= 3 && !m.mastered).length;
    const masteredCount = mistakes.filter(m => m.mastered).length;

    res.render('mistake-notebook', {
      title: '⚡ Weakness Analyzer Pro',
      mistakes, topics, criticalCount, masteredCount,
      user: req.user, query: req.query
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: 'Could not load mistakes.', user: req.user });
  }
});

router.post('/manual', requireLogin, async (req, res) => {
  try {
    const { questionText, topic, difficulty, studentNotes } = req.body;
    if (!questionText) return res.status(400).json({ success: false, message: 'Question text required' });
    const entry = await MistakeEntry.create({
      studentId: req.user._id,
      questionText, topic,
      difficulty: difficulty || 'Medium',
      studentNotes: studentNotes || '',
      correctAnswer: -1, studentAnswer: -1
    });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/mastered', requireLogin, async (req, res) => {
  try {
    const entry = await MistakeEntry.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user._id },
      { mastered: true, masteredAt: new Date() },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.put('/:id/notes', requireLogin, async (req, res) => {
  try {
    const { notes } = req.body;
    const entry = await MistakeEntry.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user._id },
      { studentNotes: notes },
      { new: true }
    );
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/quiz', requireLogin, async (req, res) => {
  try {
    const { topic, difficulty } = req.query;
    const filter = { studentId: req.user._id, mastered: false };
    if (topic) filter.topic = new RegExp(topic, 'i');
    if (difficulty) filter.difficulty = difficulty;
    const mistakes = await MistakeEntry.find(filter).sort({ timesMistaken: -1 }).limit(10);
    if (mistakes.length === 0) {
      return res.json({ success: false, message: 'No mistakes to quiz on!' });
    }
    const quiz = mistakes.map(m => ({
      _id: m._id,
      questionText: m.questionText,
      options: m.options,
      topic: m.topic,
      difficulty: m.difficulty
    }));
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
