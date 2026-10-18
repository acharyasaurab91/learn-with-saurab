// ============================================
// Student-facing chapter notes (Phase 6.5B)
// Mounted at /notes in server.js
// ============================================

const express = require('express');
const router = express.Router();
const Chapter = require('../models/Chapter');

// Public view of a published chapter note
router.get('/:slug', async (req, res) => {
  try {
    const chapter = await Chapter.findOne({ slug: req.params.slug });
    if (!chapter || !chapter.isPublished) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'This note does not exist or has not been published yet.',
        user: req.user || null
      });
    }
    res.render('notes/chapter-view', {
      title: chapter.title,
      chapter,
      user: req.user || null
    });
  } catch (err) {
    console.error('Notes route error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Could not load this note. Please try again later.',
      user: req.user || null
    });
  }
});

module.exports = router;