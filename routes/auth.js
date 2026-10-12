const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const { sendEmail } = require('../utils/mailer');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../helpers/emailHelpers');

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
    // Step 2: unverified users cannot log in — no session is created
    if (user.isVerified === false) {
      req.session.pendingVerifyEmail = user.email;
      return res.render('auth/verify-pending', {
        title: 'Verify Your Email',
        email: user.email,
        msg: '',
        error: 'Please verify your email first.',
        user: null
      });
    }
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
      isVerified: false
    });
    await user.save();
    try {
      await sendEmail(email, 'Verify your email — Learn With Saurab', sendVerificationEmail(user, verifyToken));
    } catch (mailErr) {
      console.error('Verification email failed:', mailErr.message);
    }
    // Step 1: do NOT log the user in — they must verify via email first
    req.session.pendingVerifyEmail = email.toLowerCase().trim();
    res.redirect('/verify-pending');
  } catch (err) {
    console.error(err);
    res.render('auth/signup', { title: 'Sign Up', error: 'Server error. Please try again.', user: null });
  }
});

router.get('/verify-pending', (req, res) => {
  res.render('auth/verify-pending', {
    title: 'Verify Your Email',
    email: req.session.pendingVerifyEmail || '',
    msg: req.query.resent ? 'Verification email sent again — check your inbox.' : '',
    error: req.query.error ? 'Could not send the verification email. Please try again.' : '',
    user: null
  });
});

router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const email = (req.body && req.body.email) || req.session.pendingVerifyEmail || '';
    if (!email) return res.redirect('/verify-pending?error=1');
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Regenerate the token only for existing unverified users, but always
    // show the same success page (never reveal whether the email exists)
    if (user && !user.isVerified) {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      user.emailVerifyToken = verifyToken;
      user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();
      await sendEmail(user.email, 'Verify your email — Learn With Saurab', sendVerificationEmail(user, verifyToken));
      req.session.pendingVerifyEmail = user.email;
    }
    res.redirect('/verify-pending?resent=1');
  } catch (err) {
    console.error(err);
    res.redirect('/verify-pending?error=1');
  }
});

router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const user = await User.findOne({
      emailVerifyToken: req.params.token,
      emailVerifyExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.render('auth/verify-email', {
        title: 'Email Verification',
        success: false,
        message: 'This verification link is invalid or has expired.',
        user: null
      });
    }
    user.isVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    await sendEmail(user.email, 'Welcome to Learn With Saurab! 🎓', sendWelcomeEmail(user));
    // Step 1: log the verified user in and send them to the dashboard
    req.session.userId = user._id.toString();
    req.session.isAdmin = user.isAdmin;
    delete req.session.pendingVerifyEmail;
    res.redirect('/dashboard');
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
      await sendEmail(user.email, 'Reset your password — Learn With Saurab', sendPasswordResetEmail(user, token));
    }
    res.render('auth/forgot-password', { title: 'Forgot Password', msg: 'If that email exists, a reset link was sent.', error: '', user: null });
  } catch (err) {
    console.error(err);
    res.render('auth/forgot-password', { title: 'Forgot Password', msg: '', error: 'Server error.', user: null });
  }
});

router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() }
    });
    if (!user) return res.render('auth/forgot-password', { title: 'Forgot Password', msg: '', error: 'Password reset link is invalid or expired. Please request a new one below.', user: null });
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
    if (!user) return res.render('auth/forgot-password', { title: 'Forgot Password', msg: '', error: 'Password reset link is invalid or expired. Please request a new one below.', user: null });
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
