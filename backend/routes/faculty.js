const express = require('express');
const router = express.Router();
const {
  getFaculties,
  createFaculty,
  getDepartmentsByFaculty,
  updateFaculty,
  setFacultyArchiveStatus,
} = require('../controllers/facultyController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getFaculties)
  .post(protect, createFaculty); // Allow both students and admins to create faculties

router.get('/:facultyId/departments', getDepartmentsByFaculty);

router.put('/:id', protect, authorize('admin'), updateFaculty);
router.patch('/:id/archive', protect, authorize('admin'), setFacultyArchiveStatus);

module.exports = router;
