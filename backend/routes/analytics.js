const express = require('express');
const router = express.Router();
const { trackFeatureVisit, getFeatureStats } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.post('/feature-visit', trackFeatureVisit);
router.get('/feature-stats', protect, authorize('admin'), getFeatureStats);

module.exports = router;
