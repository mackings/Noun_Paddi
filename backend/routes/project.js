const express = require('express');
const router = express.Router();
const { generateTopics } = require('../controllers/projectController');
const { protect } = require('../middleware/auth');

router.post('/topics', protect, generateTopics);

module.exports = router;
