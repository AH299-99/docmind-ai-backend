// Long-running server entry point (local dev, Render, VPS, ...).
// For serverless (Vercel), see api/index.js instead.
let app;
try {
  app = require('./app');
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}

// Fail fast if the initial DB connection drops on a traditional server.
require('./config/db')().catch(() => process.exit(1));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
