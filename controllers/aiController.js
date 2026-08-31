const { GoogleGenerativeAI } = require('@google/generative-ai');
const History = require('../models/History');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analyzeText = async (req, res) => {
  try {
    const { text, task } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    let prompt = '';
    if (task === 'summarize') {
      prompt = `Summarize the following text in a clear and concise way:\n\n${text}`;
    } else if (task === 'explain') {
      prompt = `Explain the following text in simple terms:\n\n${text}`;
    } else {
      prompt = `Analyze the following text and provide key insights:\n\n${text}`;
    }

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
