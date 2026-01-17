const express = require('express');
const router = express.Router();
const {
  submitForCheck,
  getUserReports,
  getReportById,
  deleteReport,
  getUserStats,
} = require('../controllers/plagiarismController');
const { protect } = require('../middleware/auth');
const { projectUpload } = require('../config/cloudinary');

// Middleware to handle file upload errors
const handleProjectUpload = (req, res, next) => {
  projectUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('=== Project Upload Error ===');
      console.error('Error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    next();
  });
};

// Submit project for plagiarism check
router.post('/check', protect, handleProjectUpload, submitForCheck);

// Get user's plagiarism reports
router.get('/reports', protect, getUserReports);

// Get user's plagiarism statistics
router.get('/stats', protect, getUserStats);

// Get specific report by ID
router.get('/reports/:id', protect, getReportById);

// Delete a report
router.delete('/reports/:id', protect, deleteReport);

module.exports = router;
