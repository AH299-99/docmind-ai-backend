const History = require('../models/History');
const aiClient = require('../utils/aiClient');
const { withHumanTone } = require('../utils/humanTone');
const {
  normalizeTask,
  DEFAULT_MAX_TEXT_LENGTH,
} = require('../utils/validation');
const {
  extractTextFromFile,
  isAllowedUpload,
  normalizeLevel,
  normalizeLength,
  buildAssignmentPrompt,
  splitAssignmentResult,
  slugify,
  EXPORT_FORMATS,
  normalizeExportFormat,
} = require('../utils/documents');

// Cap billable AI input; overridable via AI_MAX_TEXT_LENGTH (characters).
const MAX_TEXT_LENGTH =
  parseInt(process.env.AI_MAX_TEXT_LENGTH || String(DEFAULT_MAX_TEXT_LENGTH), 10) ||
  DEFAULT_MAX_TEXT_LENGTH;

const TASK_VERBS = {
  summarize: 'Summarize the following text in a clear and concise way',
  explain: 'Explain the following text in simple terms',
  analyze: 'Analyze the following text and provide key insights',
};

// Shared pipeline: task prompt + human-tone rules -> Gemini -> history entry.
const runTask = async (text, task, userId) => {
  const result = await aiClient.generateContent(
    withHumanTone(`${TASK_VERBS[task]}:\n\n${text}`)
  );
  await History.create({
    user: userId,
    inputText: text,
    task,
    result,
  });
  return result;
};

// POST /api/ai/analyze — unchanged request/response shape ({ result }).
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

    const result = await runTask(text, normalizedTask, req.userId);
    res.status(200).json({ result });
  } catch (error) {
    // Log details server-side only; clients get a generic message.
    console.error('analyzeText failed:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

// POST /api/ai/upload — multipart file (field "document") + task, run through
// the same human-tone AI pipeline as /analyze.
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'A file is required. Send it as the "document" field.' });
    }
    if (!isAllowedUpload(req.file.originalname)) {
      return res.status(400).json({
        message: 'Unsupported file type. Only .pdf, .docx and .txt files are allowed.',
      });
    }

    let text;
    try {
      ({ text } = await extractTextFromFile(req.file.buffer, req.file.originalname));
    } catch (extractError) {
      return res.status(400).json({ message: extractError.message });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res
        .status(413)
        .json({ message: `Extracted text is too long (max ${MAX_TEXT_LENGTH} characters)` });
    }

    // Upload defaults to 'summarize'; anything else is still whitelisted.
    let normalizedTask;
    try {
      normalizedTask = normalizeTask(req.body.task || 'summarize');
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid task. Allowed values: summarize, explain, analyze' });
    }

    const result = await runTask(text, normalizedTask, req.userId);
    res.status(200).json({
      result,
      task: normalizedTask,
      filename: req.file.originalname,
      charsExtracted: text.length,
    });
  } catch (error) {
    console.error('uploadDocument failed:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

// POST /api/ai/assignment — complete original assignment in human tone.
const generateAssignment = async (req, res) => {
  try {
    const { topic, instructions, level, length } = req.body;

    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ message: 'Topic is required' });
    }

    let normalizedLevel;
    try {
      normalizedLevel = normalizeLevel(level);
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid level. Allowed values: school, college, university' });
    }

    let normalizedLength;
    try {
      normalizedLength = normalizeLength(length);
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid length. Allowed values: short, medium, long' });
    }

    if (instructions !== undefined && typeof instructions !== 'string') {
      return res.status(400).json({ message: 'Instructions must be a string' });
    }

    const fullText = await aiClient.generateContent(
      buildAssignmentPrompt({
        topic: topic.trim(),
        instructions,
        level: normalizedLevel,
        length: normalizedLength,
      })
    );
    const { title, result } = splitAssignmentResult(fullText);

    await History.create({
      user: req.userId,
      inputText: `Assignment: ${topic.trim()} (level: ${normalizedLevel}, length: ${normalizedLength})`,
      task: 'assignment',
      result: fullText,
    });

    res.status(200).json({ title, result });
  } catch (error) {
    console.error('generateAssignment failed:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

// POST /api/ai/export — content -> downloadable file (pdf | docx | txt).
const exportDocument = async (req, res) => {
  try {
    const { title, content, format } = req.body;

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    let normalizedFormat;
    try {
      normalizedFormat = normalizeExportFormat(format);
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid format. Allowed values: pdf, docx, txt' });
    }

    if (title !== undefined && typeof title !== 'string') {
      return res.status(400).json({ message: 'Title must be a string' });
    }

    const { ext, contentType, build } = EXPORT_FORMATS[normalizedFormat];
    const safeTitle = typeof title === 'string' ? title.trim() : '';
    const filename = `${slugify(safeTitle)}${ext}`;
    const buffer = await build(safeTitle, content);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('exportDocument failed:', error);
    res.status(500).json({ message: 'Export failed' });
  }
};

module.exports = { analyzeText, uploadDocument, generateAssignment, exportDocument };
