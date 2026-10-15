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
  order:           { type: Number, default: 1 },
  videos: [{
    videoTitle:    String,
    videoUrl:      String,
    duration:      Number,
    isFree:        { type: Boolean, default: false },
    description:   String,
    order:         { type: Number, default: 0 }
  }],
  resources: [{
    title:         String,
    fileUrl:       String,
    // NOTE: never name a field `type` inside an inline array-of-subdocs literal —
    // Mongoose parses the element as a path definition and collapses the array
    // to [String] (Cast to string failed ... at path "resources").
    resourceType:  String,
    isFree:        { type: Boolean, default: false },
    order:         { type: Number, default: 0 }
  }]
}, { timestamps: true });

moduleSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model('Module', moduleSchema);
