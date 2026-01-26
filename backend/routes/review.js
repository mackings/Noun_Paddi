const express = require('express');
const router = express.Router();
const { submitReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.post('/', protect, submitReview);

module.exports = router;
