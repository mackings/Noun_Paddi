const express = require('express');
const router = express.Router();
const {
  getCourses,
  getCoursesByDepartment,
  searchCourses,
  createCourse,
  getCourseMaterials,
  getCourse,
  deleteCourse,
  updateCourse,
  setCourseArchiveStatus,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getCourses)
  .post(protect, createCourse); // Allow both students and admins to create courses

router.get('/search', searchCourses);
router.get('/department/:departmentId', getCoursesByDepartment);
router.get('/:courseId/materials', getCourseMaterials);

router.route('/:id')
  .get(getCourse)
  .put(protect, authorize('admin'), updateCourse)
  .delete(protect, authorize('admin'), deleteCourse);

router.patch('/:id/archive', protect, authorize('admin'), setCourseArchiveStatus);

module.exports = router;
