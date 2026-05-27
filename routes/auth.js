const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendEmail(to, subject, html) {
  try {
    const t = getTransporter();
    await t.sendMail({ from: `"Learn With Saurab" <${process.env.EMAIL_USER}>`, to, subject, html });
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username || username.length < 3) return res.json({ available: false, message: 'Min 3 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.json({ available: false, message: 'Only letters, numbers, underscores' });
  try {
    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.json({ available: false, message: 'Username taken' });
    return res.json({ available: true, message: 'Available!' });
  } catch (e) {
    return res.json({ available: false, message: 'Error checking' });
  }
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login', msg: req.query.msg || '', error: '', user: null });
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.render('auth/login', { title: 'Login', msg: '', error: 'All fields required.', user: null });
    const user = await User.findOne({ $or: [{ email: email.toLowerCase().trim() }, { username: email.toLowerCase().trim() }] });
    if (!user) return res.render('auth/login', { title: 'Login', msg: '', error: 'Invalid credentials.', user: null });
    const match = await user.comparePassword(password);
    if (!match) return res.render('auth/login', { title: 'Login', msg: '', error: 'Invalid credentials.', user: null });
    req.session.userId = user._id.toString();
    req.session.isAdmin = user.isAdmin;
    user.lastLogin = new Date();
    await user.save();
    const returnTo = req.session.returnTo || (user.isAdmin ? '/admin' : '/dashboard');
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error(err);
    res.render('auth/login', { title: 'Login', msg: '', error: 'Server error. Please try again.', user: null });
  }
});

router.get('/signup', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/signup', { title: 'Sign Up', error: '', user: null });
});

router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, username, email, mobile, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !username || !email || !mobile || !password) {
      return res.render('auth/signup', { title: 'Sign Up', error: 'All fields are required.', user: null });
    }
    // Strict email format validation
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.render('auth/signup', { title: 'Sign Up', error: 'Please enter a valid email address (e.g. yourname@gmail.com).', user: null });
    }
    if (password !== confirmPassword) {
      return res.render('auth/signup', { title: 'Sign Up', error: 'Passwords do not match.', user: null });
    }
    if (password.length < 8) {
      return res.render('auth/signup', { title: 'Sign Up', error: 'Password must be at least 8 characters.', user: null });
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (existing) {
      return res.render('auth/signup', { title: 'Sign Up', error: 'Email or username already in use.', user: null });
    }
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const user = new User({
      firstName, lastName,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      mobile, password,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isVerified: true
    });
    await user.save();
    const verifyUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/verify-email/${verifyToken}`;
    await sendEmail(email, 'Verify your email – Learn With Saurab', `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#fff;padding:40px;border-radius:12px;">
        <h1 style="color:#00D4FF;">Welcome to Learn With Saurab! 🎓</h1>
        <p>Hi ${firstName}, please verify your email:</p>
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D4FF,#7C3AED);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0;">Verify Email</a>
        <p style="color:#9CA3AF;">Link expires in 24 hours.</p>
      </div>
    `);
    req.session.userId = user._id.toString();
    req.session.isAdmin = false;
    res.redirect('/dashboard?welcome=1');
  } catch (err) {
    console.error(err);
    res.render('auth/signup', { title: 'Sign Up', error: 'Server error. Please try again.', user: null });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      emailVerifyToken: req.params.token,
      emailVerifyExpires: { $gt: new Date() }
    });
    if (!user) return res.render('error', { title: 'Invalid Link', message: 'Verification link is invalid or expired.', user: null });
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    res.redirect('/login?msg=Email+verified!+You+can+now+login.');
  } catch (err) {
    next(err);
  }
});

router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password', msg: '', error: '', user: null });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const url = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password/${token}`;
      await sendEmail(email, 'Reset Password – Learn With Saurab', `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#fff;padding:40px;border-radius:12px;">
          <h1 style="color:#00D4FF;">Reset Your Password</h1>
          <p>Hi ${user.firstName}, click below to reset your password:</p>
          <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#00D4FF,#7C3AED);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:20px 0;">Reset Password</a>
          <p style="color:#9CA3AF;">Expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `);
    }
    res.render('auth/forgot-password', { title: 'Forgot Password', msg: 'If that email exists, a reset link was sent.', error: '', user: null });
  } catch (err) {
    console.error(err);
    res.render('auth/forgot-password', { title: 'Forgot Password', msg: '', error: 'Server error.', user: null });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() }
    });
    if (!user) return res.render('error', { title: 'Invalid Link', message: 'Password reset link is invalid or expired.', user: null });
    res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, error: '', user: null });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, error: 'Passwords do not match.', user: null });
    }
    if (password.length < 8) {
      return res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, error: 'Min 8 characters.', user: null });
    }
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() }
    });
    if (!user) return res.render('error', { title: 'Invalid Link', message: 'Link expired.', user: null });
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.redirect('/login?msg=Password+reset+successful!');
  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token, error: 'Server error.', user: null });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
