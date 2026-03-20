const { HttpError } = require('../lib/errors');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    next(new HttpError(401, '需要登录'));
    return;
  }
  next();
}

module.exports = { requireAuth };
