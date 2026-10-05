const rateLimit = require('express-rate-limit');

// General-purpose limiter for all API traffic — blunts basic scraping/abuse
// and accidental infinite-loop bugs on the frontend from hammering the API.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down and try again shortly.' } },
});

// Tighter limiter specifically for the auth bootstrap endpoint, since
// unauthenticated(-ish) endpoints are the most common brute-force target.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts — please wait a few minutes.' } },
});

module.exports = { apiLimiter, authLimiter };
