const mongoose = require('mongoose');

// Tracks a chunked upload in progress. Abandoned sessions expire
// automatically via the TTL index (1 hour).
const uploadSessionSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true, index: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: { type: String, required: true },
  fileSize: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

module.exports = mongoose.model('UploadSession', uploadSessionSchema);
