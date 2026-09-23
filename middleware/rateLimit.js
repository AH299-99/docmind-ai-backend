const rateLimit = require('express-rate-limit');

const jsonMessage = { message: 'Too many requests, please try again later.' };

// Stricter: brute-force protection on signup/login.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});

// AI endpoints cost money per call — cap usage per IP.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});

module.exports = { authLimiter, aiLimiter };
