const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getVideoComments, createVideoComment } = require('../controllers/videoController');

router.use(protect);

router.get('/:videoId/comments', getVideoComments);
router.post('/:videoId/comments', createVideoComment);

module.exports = router;
