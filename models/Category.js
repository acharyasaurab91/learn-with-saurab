const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true },
  icon:        { type: String, default: 'fas fa-book' },
  color:       { type: String, default: '#00D4FF' },
  description: String,
  subjects:    [String],
  isVisible:   { type: Boolean, default: true },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

categorySchema.index({ order: 1, isVisible: 1 });

module.exports = mongoose.model('Category', categorySchema);
