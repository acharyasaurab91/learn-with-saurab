const mongoose = require('mongoose');

const studentNoteSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  videoId:   String,
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  tags:      [String],
  isStarred: { type: Boolean, default: false }
}, { timestamps: true });

studentNoteSchema.index({ studentId: 1 });

module.exports = mongoose.model('StudentNote', studentNoteSchema);
