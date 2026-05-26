const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:           { type: String, required: true, unique: true, trim: true, lowercase: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile:             { type: String, required: true },
  firstName:          { type: String, required: true, trim: true },
  lastName:           { type: String, required: true, trim: true },
  password:           { type: String, required: true },
  isAdmin:            { type: Boolean, default: false },
  isVerified:         { type: Boolean, default: false },
  emailVerifyToken:   String,
  emailVerifyExpires: Date,
  enrolledCourses:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  progress: {
    totalMinutesWatched: { type: Number, default: 0 },
    coursesCompleted:    { type: Number, default: 0 },
    testsTaken:          { type: Number, default: 0 },
    avgScore:            { type: Number, default: 0 }
  },
  resetPasswordToken:  String,
  resetPasswordExpires: Date,
  lastLogin:           Date,
  avatar:              String
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);
