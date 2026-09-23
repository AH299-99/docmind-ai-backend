const { GoogleGenerativeAI } = require('@google/generative-ai');
const History = require('../models/History');

const MAX_TEXT_LENGTH = 12000;
const ALLOWED_TASKS = new Set(['summarize', 'explain', 'analyze']);

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
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const task = typeof req.body.task === 'string' ? req.body.task.trim().toLowerCase() : 'analyze';

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ message: `Text must be ${MAX_TEXT_LENGTH} characters or fewer` });
    }
    if (!ALLOWED_TASKS.has(task)) {
      return res.status(400).json({ message: 'Task must be summarize, explain, or analyze' });
    }

    let prompt = '';
    if (task === 'summarize') {
      prompt = `Summarize the following text in a clear and concise way:\n\n${text}`;
    } else if (task === 'explain') {
      prompt = `Explain the following text in simple terms:\n\n${text}`;
    } else {
      prompt = `Analyze the following text and provide key insights:\n\n${text}`;
    }

    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // save to history
    await History.create({
      user: req.userId,
      inputText: text,
      task,
      result: response,
    });

    res.status(200).json({ result: response });
  } catch (error) {
    console.error('AI processing error:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

module.exports = { analyzeText };
