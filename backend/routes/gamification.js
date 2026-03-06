const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  completeSummaryReading,
  getDashboardGamification,
  getGamificationLeaderboard,
} = require('../controllers/gamificationController');

router.post('/reading/complete', protect, completeSummaryReading);
router.get('/dashboard', protect, getDashboardGamification);
router.get('/leaderboard', getGamificationLeaderboard);

module.exports = router;
