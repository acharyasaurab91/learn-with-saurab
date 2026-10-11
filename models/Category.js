const mongoose = require('mongoose');

// Slugify: lowercase → spaces to hyphens → strip non-alphanumeric except hyphens
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const categorySchema = new mongoose.Schema({
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true },
  icon:        { type: String, default: 'fas fa-book' },
  color:       { type: String, default: '#0E7C72' },
  description: String,
  subjects:    [String],
  isVisible:   { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-generate slug from name when slug is empty.
// NOTE: Mongoose runs validation BEFORE pre('save') middleware (verified empirically),
// so the generator is attached to pre('validate') — it fires during doc.validate() and
// during save()'s validation step, guaranteeing `slug: required` passes. A redundant
// pre('save') registration is kept for the literal save-time contract (no-op by then).
function autoSlug(next) {
  if (!this.slug) {
    this.slug = slugify(this.name) || `category-${Date.now()}`;
  }
  next();
}
categorySchema.pre('validate', autoSlug);
categorySchema.pre('save', autoSlug);

categorySchema.index({ order: 1, isVisible: 1 });

module.exports = mongoose.model('Category', categorySchema);
