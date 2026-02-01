const express = require('express');
const router = express.Router();
const { createShareLink, getShareLink } = require('../controllers/shareController');
const { protect } = require('../middleware/auth');

// Create share link (authenticated users)
router.post('/materials/:materialId', protect, createShareLink);

// Resolve share link (public)
router.get('/:token', getShareLink);

module.exports = router;
