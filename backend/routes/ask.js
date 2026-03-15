const express = require('express');
const router = express.Router();
const { askQuestion, streamAskPdf } = require('../controllers/askController');
const { protect } = require('../middleware/auth');

router.post('/query', protect, askQuestion);
router.get('/pdf/:token', protect, streamAskPdf);

module.exports = router;
