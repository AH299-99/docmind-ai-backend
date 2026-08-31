const express = require('express');
const router = express.Router();
const { analyzeText } = require('../controllers/aiController');
const protect = require('../middleware/authMiddleware');

router.post('/analyze', protect, analyzeText);

module.exports = router;
