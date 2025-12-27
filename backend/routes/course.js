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
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getCourses)
  .post(protect, authorize('admin'), createCourse);

router.get('/search', searchCourses);
router.get('/department/:departmentId', getCoursesByDepartment);
router.get('/:courseId/materials', getCourseMaterials);

router.route('/:id')
  .get(getCourse)
  .delete(protect, authorize('admin'), deleteCourse);

module.exports = router;
