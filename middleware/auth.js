const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login?msg=Please+login+to+continue');
  }
  next();
};

const requireVerified = async (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  try {
    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');
    if (!user.isVerified) {
      return res.redirect('/verify-email-notice');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const loadUser = async (req, res, next) => {
  if (req.session.userId) {
    try {
      const User = require('../models/User');
      req.user = await User.findById(req.session.userId).select('-password');
    } catch (e) {
      req.user = null;
    }
  }
  res.locals.user = req.user || null;
  next();
};

module.exports = { requireLogin, requireVerified, loadUser };
