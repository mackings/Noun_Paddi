const express = require('express');
const router = express.Router();
const {
  getFacultiesAdmin,
  getDepartmentsAdmin,
  getCoursesAdmin,
  inviteAdmin,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.get('/faculties', protect, authorize('admin'), getFacultiesAdmin);
router.get('/departments', protect, authorize('admin'), getDepartmentsAdmin);
router.get('/courses', protect, authorize('admin'), getCoursesAdmin);
router.post('/invite', protect, authorize('admin'), inviteAdmin);

module.exports = router;
