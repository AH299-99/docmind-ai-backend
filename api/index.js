// Vercel serverless entry point. Vercel wraps the exported Express app as a
// function; all routes are rewritten here via vercel.json.
const app = require('../app');

module.exports = app;
