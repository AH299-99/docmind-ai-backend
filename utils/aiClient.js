// Thin wrapper around the Gemini API. Kept in its own module so the
// controllers call aiClient.generateContent(...) — easy to stub in tests.
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Lazily create the Gemini client so the server can boot even when the
// API key is missing — requests then fail with a clear error instead of
// crashing the whole process at import time.
const generateContent = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

module.exports = { generateContent };
