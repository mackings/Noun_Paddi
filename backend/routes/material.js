const express = require('express');
const router = express.Router();
const {
  uploadMaterial,
  generateSummary,
  generateQuestionsForMaterial,
  getMaterialSummary,
  deleteMaterial,
  getCourseMaterials,
  getAllMaterials,
  studentUploadMaterial,
  getUploadSignature,
  getStudentStats,
  getMaterialStatus,
  streamMaterialStatus,
  issueMaterialStreamToken,
} = require('../controllers/materialController');
const { protect, authorize, protectSSE } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { createRateLimit } = require('../middleware/rateLimit');

const aiUploadLimiter = createRateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  keyPrefix: 'ai:student-upload',
  message: 'Too many AI material uploads for this course. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}:${req.body?.courseId || 'unknown-course'}`,
});

const materialGenerationLimiter = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 4,
  keyPrefix: 'ai:material-generation',
  message: 'Too many AI generation requests for this material. Please wait and try again later.',
  keyBuilder: (req, ip) => `${req.user?._id || ip}:${req.params?.materialId || 'unknown-material'}`,
});

// Admin routes
router.get('/', protect, authorize('admin'), getAllMaterials);
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadMaterial);
router.post('/:materialId/summarize', protect, authorize('admin'), materialGenerationLimiter, generateSummary);
router.post('/:materialId/generate-questions', protect, authorize('admin'), materialGenerationLimiter, generateQuestionsForMaterial);
router.delete('/:id', protect, authorize('admin'), deleteMaterial);

// Middleware to handle multer/cloudinary errors
const handleUploadError = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('=== Upload Middleware Error ===');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
        error: process.env.NODE_ENV === 'development' ? err : undefined
      });
    }
    next();
  });
};

// Student routes
router.post('/student-upload', protect, aiUploadLimiter, handleUploadError, studentUploadMaterial);
router.post('/upload-signature', protect, getUploadSignature);
router.get('/my-stats', protect, getStudentStats);
router.get('/:materialId/status', protect, getMaterialStatus);
router.post('/:materialId/stream-token', protect, issueMaterialStreamToken);
router.get('/:materialId/stream', protectSSE, streamMaterialStatus);

// Public routes
router.get('/course/:courseId', getCourseMaterials);
router.get('/:materialId/summary', getMaterialSummary);

module.exports = router;
