// Pure helpers for the chunked document-upload flow.
// Lets clients upload files up to MAX_UPLOAD_BYTES in small pieces so hosts
// with tiny request-payload caps (e.g. Vercel's ~4.5MB Hobby limit) still
// accept large documents. No Express or DB access here — unit tested.
const { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES, isAllowedUpload } = require('./documents');

// Raw bytes per chunk the client should send. Base64 inflates ~33%, so a
// 2.5MB chunk is ~3.4MB on the wire — safely under Vercel's ~4.5MB cap.
const CHUNK_BYTES = Math.floor(2.5 * 1024 * 1024);
const MAX_CHUNKS = 32;

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

// Validate POST /api/ai/upload/init body. Throws with a client-facing message.
const validateInitParams = ({ filename, fileSize, totalChunks }) => {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('Filename is required.');
  }
  if (!isAllowedUpload(filename)) {
    throw new Error('Unsupported file type. Only .pdf, .docx and .txt files are allowed.');
  }
  if (!Number.isInteger(fileSize) || fileSize <= 0) {
    throw new Error('fileSize must be a positive integer (bytes).');
  }
  if (fileSize > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large. Maximum file size is ${MAX_UPLOAD_MB}MB.`);
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
    throw new Error(`totalChunks must be an integer between 1 and ${MAX_CHUNKS}.`);
  }
  const minChunks = Math.ceil(fileSize / CHUNK_BYTES);
  if (totalChunks < minChunks) {
    throw new Error(
      `totalChunks too small for this fileSize — need at least ${minChunks} chunks of ${CHUNK_BYTES} bytes.`
    );
  }
  return { filename: filename.trim(), fileSize, totalChunks };
};

// Validate POST /api/ai/upload/chunk body against its session.
// Returns the decoded Buffer. Throws with a client-facing message.
const validateChunkParams = ({ uploadId, index, data }, session) => {
  if (typeof uploadId !== 'string' || !uploadId) {
    throw new Error('uploadId is required.');
  }
  if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
    throw new Error('Invalid chunk index.');
  }
  if (typeof data !== 'string' || !data || data.length % 4 !== 0 || !BASE64_RE.test(data)) {
    throw new Error('Chunk data must be a base64 string.');
  }
  const buf = Buffer.from(data, 'base64');
  if (buf.length === 0) {
    throw new Error('Chunk data is empty.');
  }
  if (buf.length > CHUNK_BYTES) {
    throw new Error(`Chunk too large — max ${CHUNK_BYTES} bytes of raw data per chunk.`);
  }
  return buf;
};

// Reassemble staged chunks into the original file buffer.
// chunks: [{ index, data }]. Throws when chunks are missing/duplicated or
// the reassembled size does not match the session's declared fileSize.
const assembleChunks = (chunks, session) => {
  if (!Array.isArray(chunks) || chunks.length !== session.totalChunks) {
    throw new Error('Upload incomplete — some chunks are missing.');
  }
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].index !== i) {
      throw new Error('Upload incomplete — some chunks are missing.');
    }
  }
  const buffer = Buffer.concat(sorted.map((c) => c.data));
  if (buffer.length !== session.fileSize) {
    throw new Error('Upload corrupted — reassembled size does not match fileSize.');
  }
  return buffer;
};

module.exports = {
  CHUNK_BYTES,
  MAX_CHUNKS,
  validateInitParams,
  validateChunkParams,
  assembleChunks,
};
