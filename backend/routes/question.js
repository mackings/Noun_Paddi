const express = require('express');
const router = express.Router();
const {
  getQuestionsByCourse,
  ensureQuestionsForCourse,
  checkAnswer,
  gradePopAnswers,
  getPopPaperByCourse,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const ensureQuestionsLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  keyPrefix: 'ai:ensure-questions',
  message: 'Too many question generation requests for this course. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}:${req.params?.courseId || 'unknown-course'}`,
});

router.get('/course/:courseId', getQuestionsByCourse);
router.post('/course/:courseId/ensure', protect, ensureQuestionsLimiter, ensureQuestionsForCourse);
router.get('/pop-paper/:courseId', getPopPaperByCourse);
router.post('/:questionId/check', checkAnswer);
router.post('/pop-grade', protect, gradePopAnswers);
router.put('/:id', protect, authorize('admin'), updateQuestion);
router.delete('/:id', protect, authorize('admin'), deleteQuestion);

module.exports = router;
