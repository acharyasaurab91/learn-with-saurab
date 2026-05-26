const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true, default: 0 },
  imagePath:   String,
  imageUrl:    String,
  category:    String,
  subject:     String,
  level:       { type: String, enum: ['Beginner','Intermediate','Advanced'], default: 'Beginner' },
  duration:    { type: Number, default: 0 },
  isFeatured:  { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  modules: [{
    moduleTitle:       String,
    moduleDescription: String,
    order:             Number,
    videos: [{
      videoTitle:  String,
      videoUrl:    String,
      videoPath:   String,
      duration:    Number,
      isFree:      { type: Boolean, default: false },
      description: String
    }],
    resources: [{
      title:   String,
      fileUrl: String,
      type:    String,
      isFree:  { type: Boolean, default: false }
    }]
  }],
  tests:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  enrolledCount:  { type: Number, default: 0 },
  rating:         { type: Number, default: 0 },
  totalRatings:   { type: Number, default: 0 }
}, { timestamps: true });

courseSchema.index({ category: 1 });
courseSchema.index({ isFeatured: 1 });
courseSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Course', courseSchema);
