const { GoogleGenerativeAI } = require('@google/generative-ai');
const History = require('../models/History');

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

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
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
      task: task || 'analyze',
      result: response,
    });

    res.status(200).json({ result: response });
  } catch (error) {
    res.status(500).json({ message: 'AI processing failed', error: error.message });
  }
};

module.exports = { analyzeText };
