const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  course:          { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title:           { type: String, required: true },
  description:     { type: String, default: '' },
  type:            { type: String, default: 'video' },
  videoPath:       { type: String, default: '' },
  videoFilename:   { type: String, default: '' },
  isFreePreview:   { type: Boolean, default: false },
  duration:        { type: Number, default: 0 },
  order:           { type: Number, default: 1 }
}, { timestamps: true });

moduleSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model('Module', moduleSchema);
