const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  answerTmaQuestion,
  backfillTmaEmbeddings,
  deleteTmaSource,
  listTmaSources,
  uploadTmaSource,
} = require('../controllers/tmaController');
const { protect, authorize } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const tmaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]);
    if (allowedTypes.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Only PDF, DOC, DOCX, and TXT sources are supported.'));
  },
});

const tmaAnswerLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyPrefix: 'ai:tma-answer',
  message: 'Too many TMA answer requests. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}:${req.body?.courseId || 'any-course'}`,
});

router.use(protect, authorize('admin'));

const handleTmaUpload = (req, res, next) => {
  tmaUpload.single('file')(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'TMA source upload failed.',
      });
    }
    return next();
  });
};

router.get('/sources', listTmaSources);
router.post('/sources/upload', handleTmaUpload, uploadTmaSource);
router.post('/sources/backfill-embeddings', backfillTmaEmbeddings);
router.delete('/sources/:sourceId', deleteTmaSource);
router.post('/answer', tmaAnswerLimiter, answerTmaQuestion);

module.exports = router;
