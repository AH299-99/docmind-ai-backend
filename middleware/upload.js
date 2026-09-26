// Multer setup for POST /api/ai/upload.
// Memory storage (files never touch disk), an env-configurable size cap
// (MAX_UPLOAD_MB, default 10MB), and an extension whitelist for
// .pdf / .docx / .txt. Validation errors are mapped to clear 400 responses
// by handleUploadError, used in routes/aiRoutes.js.
const multer = require('multer');
const { ALLOWED_UPLOAD_EXTS, MAX_UPLOAD_MB, MAX_UPLOAD_BYTES, getFileExtension } = require('../utils/documents');

const INVALID_TYPE = 'INVALID_FILE_TYPE';

const fileFilter = (req, file, cb) => {
  if (ALLOWED_UPLOAD_EXTS.includes(getFileExtension(file.originalname))) {
    return cb(null, true);
  }
  const err = new Error(
    'Unsupported file type. Only .pdf, .docx and .txt files are allowed.'
  );
  err.code = INVALID_TYPE;
  return cb(err);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter,
});

// Translate multer/fileFilter errors into client-facing 400 responses.
// Returns true when the error was handled (caller should stop), false otherwise.
const handleUploadError = (err, res) => {
  if (!err) return false;
  if (err.code === 'LIMIT_FILE_SIZE') {
    res
      .status(400)
      .json({ message: `File is too large. Maximum file size is ${MAX_UPLOAD_MB}MB.` });
    return true;
  }
  if (err.code === INVALID_TYPE) {
    res.status(400).json({ message: err.message });
    return true;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: 'File upload failed. Please try again.' });
    return true;
  }
  return false;
};

module.exports = { upload, fileFilter, handleUploadError, MAX_UPLOAD_MB, MAX_UPLOAD_BYTES };
