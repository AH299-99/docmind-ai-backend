const mongoose = require('mongoose');

// One document per uploaded chunk. Staged in MongoDB (not server memory) so
// chunks survive across serverless function instances. Abandoned chunks
// expire automatically via the TTL index (1 hour).
const uploadChunkSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, index: true },
  index: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

uploadChunkSchema.index({ uploadId: 1, index: 1 }, { unique: true });

module.exports = mongoose.model('UploadChunk', uploadChunkSchema);
