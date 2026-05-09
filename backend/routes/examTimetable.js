const express = require('express');
const {
  addCourseToSchedule,
  getMyExamSchedule,
  processExamScoreRemindersCron,
  recordExamScore,
  removeCourseFromSchedule,
  searchExamTimetable,
} = require('../controllers/examTimetableController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/process-reminders/cron', processExamScoreRemindersCron);

router.use(protect);
router.use(authorize('student'));

router.get('/search', searchExamTimetable);
router.get('/my', getMyExamSchedule);
router.post('/my', addCourseToSchedule);
router.patch('/my/:id/score', recordExamScore);
router.delete('/my/:id', removeCourseFromSchedule);

module.exports = router;
