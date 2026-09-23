const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { authLimiter, aiLimiter } = require('./middleware/rateLimit');

const app = express();

// Fail fast on missing secrets — never boot with broken auth/DB config.
const requiredEnv = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Trust the first proxy (Render/Heroku/etc.) so rate limiting sees the real client IP.
app.set('trust proxy', 1);

app.use(helmet());

connectDB();

// CORS fails SAFE: when FRONTEND_URL is unset, cross-origin requests are
// denied (no Access-Control-Allow-Origin header). Never falls back to '*'.
// (Native mobile apps are not browsers, so this does not block them.)
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : { origin: false }));

// Explicit body size limit — rejects oversized payloads before routing.
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DocMind AI backend is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Central error handler — generic messages to clients, details only in logs.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message || 'Request failed',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
