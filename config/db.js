const mongoose = require('mongoose');

// Serverless-safe connection: the promise is cached on the module, so a warm
// function reuses the existing connection instead of opening a new one per
// invocation. On failure the cache is cleared so the next cold start retries.
// Rejects instead of exiting — callers decide (long-running server exits,
// serverless functions let the invocation fail with a clear log).
let cachedPromise = null;

const connectDB = () => {
  if (cachedPromise) return cachedPromise;
  cachedPromise = mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected successfully');
    })
    .catch((error) => {
      cachedPromise = null;
      console.error('MongoDB connection failed:', error.message);
      throw error;
    });
  return cachedPromise;
};

module.exports = connectDB;
