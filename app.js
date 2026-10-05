const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// ── Security headers ──────────────────────────────────────────────────
// helmet sets a sensible set of HTTP response headers (X-Content-Type-
// Options, X-Frame-Options, etc.) that close off a range of common
// browser-side attacks (clickjacking, MIME sniffing) with zero config.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────
// Only the explicitly allow-listed origins (your frontend's URL, from
// .env) may call this API from a browser. Everything else is rejected
// before it ever reaches a route handler.
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────
// Cap request body size to defend against large-payload denial-of-service.
app.use(express.json({ limit: '200kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── Health check (for uptime monitoring / quick smoke test) ──────────
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date().toISOString() }));

// ── API routes ─────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 + centralised error handling (must be last) ───────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
