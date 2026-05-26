const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title:             { type: String, required: true },
  description:       String,
  courseId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  category:          String,
  subject:           String,
  duration:          { type: Number, default: 30 },
  totalMarks:        Number,
  passMarks:         Number,
  negativeMarking:   { type: Boolean, default: false },
  negativeMarkValue: { type: Number, default: 0.25 },
  isFree:            { type: Boolean, default: false },
  isPublished:       { type: Boolean, default: false },
  questions: [{
    questionText:  { type: String, required: true },
    questionImage: String,
    options: [{
      text:      String,
      isCorrect: Boolean
    }],
    explanation: String,
    marks:       { type: Number, default: 1 },
    difficulty:  { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' },
    topic:       String,
    tags:        [String]
  }],
  attemptCount: { type: Number, default: 0 }
}, { timestamps: true });

testSchema.index({ category: 1 });
testSchema.index({ isFree: 1, isPublished: 1 });

module.exports = mongoose.model('Test', testSchema);
