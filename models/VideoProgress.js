const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  videoId:     { type: String, required: true },
  watchedSecs: { type: Number, default: 0 },
  completed:   { type: Boolean, default: false },
  completedAt: Date
}, { timestamps: true });

videoProgressSchema.index({ userId: 1, courseId: 1 });
videoProgressSchema.index({ userId: 1, courseId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);
