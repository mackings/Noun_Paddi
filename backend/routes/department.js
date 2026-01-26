const express = require('express');
const router = express.Router();
const {
  getDepartments,
  createDepartment,
  getDepartment,
  updateDepartment,
  setDepartmentArchiveStatus,
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getDepartments)
  .post(protect, createDepartment); // Allow both students and admins to create departments

router.route('/:id')
  .get(getDepartment)
  .put(protect, authorize('admin'), updateDepartment);

router.patch('/:id/archive', protect, authorize('admin'), setDepartmentArchiveStatus);

module.exports = router;
