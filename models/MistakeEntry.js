const mongoose = require('mongoose');

const mistakeEntrySchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId:     String,
  testId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  questionText:   { type: String, required: true },
  questionImage:  String,
  options:        [{ text: String, isCorrect: Boolean }],
  correctAnswer:  Number,
  studentAnswer:  Number,
  explanation:    String,
  topic:          String,
  difficulty:     { type: String, enum: ['Easy','Medium','Hard'], default: 'Medium' },
  tags:           [String],
  timesMistaken:  { type: Number, default: 1 },
  mastered:       { type: Boolean, default: false },
  masteredAt:     Date,
  studentNotes:   String,
  lastAttempted:  { type: Date, default: Date.now }
}, { timestamps: true });

mistakeEntrySchema.index({ studentId: 1 });
mistakeEntrySchema.index({ studentId: 1, questionId: 1 });
mistakeEntrySchema.index({ studentId: 1, mastered: 1 });

module.exports = mongoose.model('MistakeEntry', mistakeEntrySchema);
