const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  slug:         { type: String, required: true, unique: true },
  subject:      { type: String },             // e.g., "Zoology"
  category:     { type: String },             // e.g., "CEE"
  rawText:      { type: String },             // Extracted directly from PDF
  processedHtml:{ type: String },             // Final HTML that renders the note
  isPublished:  { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chapter', chapterSchema);