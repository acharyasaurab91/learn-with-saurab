const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true, default: 0 },
  imagePath:   String,
  imageUrl:    String,
  category:    String,
  subject:     String,
  examType:    {
    type: String,
    enum: [
      'CEE - Medical & Paramedical',
      'CEE - BNS (B.N.Sc.)',
      'IOE - Engineering',
      'Loksewa / लोकसेवा',
      'Nursing License (NLEN)',
      'CMLT License',
      'Pharmacy License',
      'HA License',
      'SEE (Grade 10)',
      'Grade 11',
      'Grade 12'
    ],
    default: 'CEE - Medical & Paramedical'
  },
  // For CEE - Medical & Paramedical: which target program(s) this course covers
  targetPrograms: [{
    type: String,
    enum: ['MBBS', 'BDS', 'BSc Nursing', 'B.Pharmacy']
  }],
  // For Grade 11 / Grade 12 courses: which stream this course belongs to
  stream: { type: String, enum: ['Science', 'Management', ''], default: '' },
  duration:    { type: Number, default: 0 },
  isFeatured:  { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  // Demo lecture — YouTube URL or uploaded video for public preview
  demoVideoUrl:  String,
  demoVideoType: { type: String, enum: ['youtube', 'local'], default: 'youtube' },
  demoTitle:     String,
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
