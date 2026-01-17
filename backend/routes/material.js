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
  getStudentStats,
} = require('../controllers/materialController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Admin routes
router.get('/', protect, authorize('admin'), getAllMaterials);
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadMaterial);
router.post('/:materialId/summarize', protect, authorize('admin'), generateSummary);
router.post('/:materialId/generate-questions', protect, authorize('admin'), generateQuestionsForMaterial);
router.delete('/:id', protect, authorize('admin'), deleteMaterial);

// Middleware to handle multer/cloudinary errors
const handleUploadError = (req, res, next) => {
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
router.post('/student-upload', protect, handleUploadError, studentUploadMaterial);
router.get('/my-stats', protect, getStudentStats);

// Public routes
router.get('/course/:courseId', getCourseMaterials);
router.get('/:materialId/summary', getMaterialSummary);

module.exports = router;
