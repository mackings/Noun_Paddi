const express = require('express');
const router = express.Router();
const { getAdminStats, getStudentStats, getAPIUsageStats } = require('../controllers/statsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/admin', protect, authorize('admin'), getAdminStats);
router.get('/student', protect, getStudentStats);
router.get('/api-usage', protect, authorize('admin'), getAPIUsageStats);

module.exports = router;
