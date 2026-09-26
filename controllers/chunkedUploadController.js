// Chunked document upload: POST /api/ai/upload/init, /chunk, /complete.
// Lets clients upload files up to MAX_UPLOAD_BYTES in small pieces so hosts
// with tiny request-payload caps (e.g. Vercel's ~4.5MB Hobby limit) still
// accept large documents. Chunks are staged in MongoDB so they survive
// across serverless function instances. Every step is authenticated and
// sessions are strictly scoped to the owning user.
const crypto = require('crypto');
const UploadSession = require('../models/UploadSession');
const UploadChunk = require('../models/UploadChunk');
const {
  validateInitParams,
  validateChunkParams,
  assembleChunks,
} = require('../utils/chunkedUpload');
const { extractTextFromFile } = require('../utils/documents');
const { normalizeTask } = require('../utils/validation');
const { runTask, MAX_TEXT_LENGTH } = require('./aiController');

// POST /api/ai/upload/init — { filename, fileSize, totalChunks } -> { uploadId }
const initUpload = async (req, res) => {
  try {
    const { filename, fileSize, totalChunks } = validateInitParams(req.body || {});
    const uploadId = crypto.randomUUID();
    await UploadSession.create({
      uploadId,
      user: req.userId,
      filename,
      fileSize,
      totalChunks,
    });
    res.status(200).json({ uploadId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /api/ai/upload/chunk — { uploadId, index, data (base64) } -> { received }
const receiveChunk = async (req, res) => {
  try {
    const { uploadId, index, data } = req.body || {};
    const session = await UploadSession.findOne({ uploadId, user: req.userId });
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found or expired.' });
    }
    const buf = validateChunkParams({ uploadId, index, data }, session);
    await UploadChunk.updateOne(
      { uploadId, index },
      { $set: { data: buf, createdAt: new Date() } },
      { upsert: true }
    );
    const received = await UploadChunk.countDocuments({ uploadId });
    res.status(200).json({ received, totalChunks: session.totalChunks });
  } catch (error) {
    const status = /not found|expired/i.test(error.message) ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
};

// POST /api/ai/upload/complete — { uploadId, task } -> same shape as /upload
const completeUpload = async (req, res) => {
  try {
    const { uploadId, task } = req.body || {};
    const session = await UploadSession.findOne({ uploadId, user: req.userId });
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found or expired.' });
    }
    const chunks = await UploadChunk.find({ uploadId }).select('index data').lean();
    let buffer;
    try {
      buffer = assembleChunks(chunks, session);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    let text;
    try {
      ({ text } = await extractTextFromFile(buffer, session.filename));
    } catch (extractError) {
      return res.status(400).json({ message: extractError.message });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res
        .status(413)
        .json({ message: `Extracted text is too long (max ${MAX_TEXT_LENGTH} characters)` });
    }

    let normalizedTask;
    try {
      normalizedTask = normalizeTask(task || 'summarize');
    } catch {
      return res
        .status(400)
        .json({ message: 'Invalid task. Allowed values: summarize, explain, analyze' });
    }

    const result = await runTask(text, normalizedTask, req.userId);

    // Cleanup staged data — never leave file bytes behind.
    await UploadChunk.deleteMany({ uploadId });
    await UploadSession.deleteOne({ uploadId });

    res.status(200).json({
      result,
      task: normalizedTask,
      filename: session.filename,
      charsExtracted: text.length,
    });
  } catch (error) {
    console.error('completeUpload failed:', error);
    res.status(500).json({ message: 'AI processing failed' });
  }
};

module.exports = { initUpload, receiveChunk, completeUpload };
