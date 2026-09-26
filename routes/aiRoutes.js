const express = require('express');
const router = express.Router();
const {
  analyzeText,
  uploadDocument,
  generateAssignment,
  exportDocument,
} = require('../controllers/aiController');
const protect = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/upload');

router.post('/analyze', protect, analyzeText);

// File upload needs multer's error mapping before the controller runs.
router.post(
  '/upload',
  protect,
  (req, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (handleUploadError(err, res)) return;
      if (err) return next(err);
      next();
    });
  },
  uploadDocument
);

router.post('/assignment', protect, generateAssignment);
router.post('/export', protect, exportDocument);

module.exports = router;
