const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

connectDB();

// Restrict CORS when FRONTEND_URL is set (comma-separated origins).
// Leave unset for open CORS (handy for mobile clients / local dev).
const corsOptions = process.env.FRONTEND_URL
  ? { origin: process.env.FRONTEND_URL.split(',').map((s) => s.trim()) }
  : {};
app.use(cors(corsOptions));
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
