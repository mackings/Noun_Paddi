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
} = require('../controllers/materialController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/', protect, authorize('admin'), getAllMaterials);
router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadMaterial);
router.post('/:materialId/summarize', protect, authorize('admin'), generateSummary);
router.post('/:materialId/generate-questions', protect, authorize('admin'), generateQuestionsForMaterial);
router.get('/course/:courseId', getCourseMaterials);
router.get('/:materialId/summary', getMaterialSummary);
router.delete('/:id', protect, authorize('admin'), deleteMaterial);

module.exports = router;
