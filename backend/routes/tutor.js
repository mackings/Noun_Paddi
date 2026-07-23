const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  createSessionToken,
  deleteSource,
  getTutorUploadSignature,
  listSources,
  searchSource,
  uploadSource,
} = require('../controllers/tutorController');
const { protect } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const tutorUpload = multer({
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
    return cb(new Error('Only PDF, DOC, DOCX, and TXT files are supported.'));
  },
});

const handleTutorUpload = (req, res, next) => {
  tutorUpload.single('file')(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Upload failed.',
      });
    }
    return next();
  });
};

const uploadLimiter = createRateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  keyPrefix: 'ai:tutor-upload',
  message: 'Too many tutor uploads. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}`,
});

const tokenLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyPrefix: 'ai:tutor-session',
  message: 'Too many tutor session requests. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}:${req.body?.sourceId || 'unknown-source'}`,
});

router.use(protect);

router.get('/sources', listSources);
router.post('/upload-signature', getTutorUploadSignature);
router.post('/upload', uploadLimiter, handleTutorUpload, uploadSource);
router.delete('/sources/:sourceId', deleteSource);
router.post('/sources/:sourceId/search', searchSource);
router.post('/session-token', tokenLimiter, createSessionToken);

module.exports = router;
