const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  requireParticipant,
  getCurrentQuiz,
  joinQuiz,
  getQuizState,
  submitQuizAnswer,
  markQuestionMissed,
  getQuizLeaderboard,
  adminListQuizzes,
  adminImportRootPdf,
  adminImportUploadedPdf,
  adminSetQuizStatus,
  adminGetQuizDetail,
  adminModerateAnswer,
} = require('../controllers/liveQuizController');
const { protect, authorize } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const quizUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Only PDF files are supported.'));
  },
});

const joinLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: 'live-quiz:join',
});

const answerLimiter = createRateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyPrefix: 'live-quiz:answer',
  keyBuilder: (req, ip) => `${req.headers['x-quiz-participant'] || ip}`,
});

router.get('/current', getCurrentQuiz);
router.get('/:quizId/leaderboard', getQuizLeaderboard);
router.post('/:quizId/join', joinLimiter, joinQuiz);
router.get('/participant/state', requireParticipant, getQuizState);
router.post('/participant/questions/:questionId/answer', answerLimiter, requireParticipant, submitQuizAnswer);
router.post('/participant/questions/:questionId/miss', answerLimiter, requireParticipant, markQuestionMissed);

router.use('/admin', protect, authorize('admin'));
router.get('/admin/quizzes', adminListQuizzes);
router.post('/admin/import-root-nou107', adminImportRootPdf);
router.post('/admin/import-pdf', quizUpload.single('file'), adminImportUploadedPdf);
router.patch('/admin/quizzes/:quizId/status', adminSetQuizStatus);
router.get('/admin/quizzes/:quizId', adminGetQuizDetail);
router.patch('/admin/answers/:answerId', adminModerateAnswer);

module.exports = router;
