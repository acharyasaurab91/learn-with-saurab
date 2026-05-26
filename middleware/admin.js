const User = require('../models/User');

const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login?msg=Admin+access+required');
  }
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user || !user.isAdmin) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'Administrator privileges required.',
        user: req.user || null
      });
    }
    req.admin = user;
    res.locals.admin = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAdmin };
