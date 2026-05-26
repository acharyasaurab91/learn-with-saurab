const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  answers:     [{ questionId: String, selectedOption: Number }],
  score:       Number,
  totalMarks:  Number,
  passed:      Boolean,
  timeTaken:   Number,
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

testAttemptSchema.index({ userId: 1 });
testAttemptSchema.index({ testId: 1 });

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
