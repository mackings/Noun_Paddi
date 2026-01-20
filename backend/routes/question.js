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

router.get('/course/:courseId', getQuestionsByCourse);
router.post('/course/:courseId/ensure', protect, ensureQuestionsForCourse);
router.get('/pop-paper/:courseId', getPopPaperByCourse);
router.post('/:questionId/check', checkAnswer);
router.post('/pop-grade', protect, gradePopAnswers);
router.put('/:id', protect, authorize('admin'), updateQuestion);
router.delete('/:id', protect, authorize('admin'), deleteQuestion);

module.exports = router;
