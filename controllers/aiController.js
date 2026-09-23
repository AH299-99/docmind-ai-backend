const { GoogleGenerativeAI } = require('@google/generative-ai');
const History = require('../models/History');
const {
  normalizeTask,
  DEFAULT_MAX_TEXT_LENGTH,
} = require('../utils/validation');

// Cap billable AI input; overridable via AI_MAX_TEXT_LENGTH (characters).
const MAX_TEXT_LENGTH =
  parseInt(process.env.AI_MAX_TEXT_LENGTH || String(DEFAULT_MAX_TEXT_LENGTH), 10) ||
  DEFAULT_MAX_TEXT_LENGTH;

// Lazily create the Gemini client so the server can boot even when the
// API key is missing — requests then fail with a clear error instead of
// crashing the whole process at import time.
const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });
};

const analyzeText = async (req, res) => {
  try {
    const { text, task } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res
        .status(413)
        .json({ message: `Text is too long (max ${MAX_TEXT_LENGTH} characters)` });
    }

    // Strict whitelist — anything outside summarize/explain/analyze is rejected.
    let normalizedTask;
    try {
      normalizedTask = normalizeTask(task);
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid task. Allowed values: summarize, explain, analyze' });
    }

    const prompts = {
      summarize: `Summarize the following text in a clear and concise way:\n\n${text}`,
      explain: `Explain the following text in simple terms:\n\n${text}`,
      analyze: `Analyze the following text and provide key insights:\n\n${text}`,
    };

    const model = getModel();
    const result = await model.generateContent(prompts[normalizedTask]);
    const response = result.response.text();

    // save to history
    await History.create({
      user: req.userId,
      inputText: text,
      task: normalizedTask,
      result: response,
    });

    res.status(200).json({ result: response });
  } catch (error) {
    // Log details server-side only; clients get a generic message.
    console.error('analyzeText failed:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

module.exports = { analyzeText };
