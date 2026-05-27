const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  amount:        Number,
  transactionId: { type: String, unique: true },
  paymentMethod: { type: String, enum: ['eSewa','Khalti','manual'], default: 'eSewa' },
  status:        { type: String, enum: ['pending','completed','failed'], default: 'pending' },
  esewaData:     mongoose.Schema.Types.Mixed,
  khaltiData:    mongoose.Schema.Types.Mixed,
  notes:         String
}, { timestamps: true });

transactionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
