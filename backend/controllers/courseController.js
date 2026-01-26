const Course = require('../models/Course');
const Material = require('../models/Material');
const Department = require('../models/Department');
const { courseCache, materialCache, cacheHelper } = require('../utils/cache');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res) => {
  try {
    const cacheKey = 'all_courses';

    const courses = await cacheHelper.getOrSet(courseCache, cacheKey, async () => {
      const results = await Course.find({ isArchived: { $ne: true } })
        .populate('departmentId', 'name facultyId');
      // Convert to plain objects to avoid Mongoose circular reference issues
      return results.map(doc => doc.toObject());
    });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get courses by department
// @route   GET /api/courses/department/:departmentId
// @access  Public
exports.getCoursesByDepartment = async (req, res) => {
  try {
    const cacheKey = `department_${req.params.departmentId}_courses`;

    const courses = await cacheHelper.getOrSet(courseCache, cacheKey, async () => {
      const results = await Course.find({ departmentId: req.params.departmentId, isArchived: { $ne: true } })
        .populate('departmentId', 'name');
      return results.map(doc => doc.toObject());
    });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Search courses
// @route   GET /api/courses/search?query=
// @access  Public
exports.searchCourses = async (req, res) => {
  try {
    const query = req.query.query;

    const courses = await Course.find({
      isArchived: { $ne: true },
      $or: [
        { courseCode: { $regex: query, $options: 'i' } },
        { courseName: { $regex: query, $options: 'i' } },
      ],
    }).populate('departmentId', 'name facultyId');

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Admin
exports.createCourse = async (req, res) => {
  try {
    const sanitizeText = (value) => String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const rawCode = sanitizeText(req.body.courseCode);
    const rawName = sanitizeText(req.body.courseName);
    const departmentId = sanitizeText(req.body.departmentId);
    const creditUnits = Number(req.body.creditUnits || 3);

    if (!rawCode || !rawName || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Course code, course name, and department are required',
      });
    }

    const codeMatch = rawCode.match(/^([A-Za-z]{3})\s*([0-9]{3})$/);
    if (!codeMatch) {
      return res.status(400).json({
        success: false,
        message: 'Course code must be 3 letters and 3 numbers (e.g., BIO 101)',
      });
    }

    const normalizedCode = `${codeMatch[1].toUpperCase()} ${codeMatch[2]}`;

    const department = await Department.findById(departmentId);
    if (department && department.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a course under an archived department',
      });
    }

    const course = await Course.create({
      courseCode: normalizedCode,
      courseName: rawName,
      departmentId,
      creditUnits: Number.isFinite(creditUnits) ? creditUnits : 3,
    });

    // Invalidate relevant caches
    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidatePattern(courseCache, `department_${course.departmentId}_*`);

    res.status(201).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get course materials
// @route   GET /api/courses/:courseId/materials
// @access  Public
exports.getCourseMaterials = async (req, res) => {
  try {
    const cacheKey = `course_${req.params.courseId}_materials`;

    const course = await Course.findById(req.params.courseId);
    if (!course || course.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const materials = await cacheHelper.getOrSet(materialCache, cacheKey, async () => {
      const results = await Material.find({ courseId: req.params.courseId })
        .populate('uploadedBy', 'name');
      return results.map(doc => doc.toObject());
    });

    res.status(200).json({
      success: true,
      count: materials.length,
      data: materials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
exports.getCourse = async (req, res) => {
  try {
    const cacheKey = `course_${req.params.id}`;

    const course = await cacheHelper.getOrSet(courseCache, cacheKey, async () => {
      const result = await Course.findById(req.params.id)
        .populate('departmentId', 'name code');
      if (!result || result.isArchived) {
        return null;
      }
      return result ? result.toObject() : null;
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if there are materials for this course
    const materialsCount = await Material.countDocuments({ courseId: req.params.id });

    if (materialsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. It has ${materialsCount} material(s). Please delete the materials first.`,
      });
    }

    await course.deleteOne();

    // Invalidate relevant caches
    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidate(courseCache, `course_${req.params.id}`);
    cacheHelper.invalidatePattern(courseCache, `department_${course.departmentId}_*`);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update course (admin)
// @route   PUT /api/courses/:id
// @access  Private/Admin
exports.updateCourse = async (req, res) => {
  try {
    const sanitizeText = (value) => String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const updates = {};
    if (req.body.courseName !== undefined) {
      updates.courseName = sanitizeText(req.body.courseName);
    }
    if (req.body.courseCode !== undefined) {
      const rawCode = sanitizeText(req.body.courseCode);
      const codeMatch = rawCode.match(/^([A-Za-z]{3})\s*([0-9]{3})$/);
      if (!codeMatch) {
        return res.status(400).json({
          success: false,
          message: 'Course code must be 3 letters and 3 numbers (e.g., BIO 101)',
        });
      }
      updates.courseCode = `${codeMatch[1].toUpperCase()} ${codeMatch[2]}`;
    }
    if (req.body.creditUnits !== undefined) {
      const creditUnits = Number(req.body.creditUnits);
      updates.creditUnits = Number.isFinite(creditUnits) ? creditUnits : 3;
    }
    if (req.body.departmentId !== undefined) {
      const nextDepartmentId = sanitizeText(req.body.departmentId);
      const department = await Department.findById(nextDepartmentId);
      if (department && department.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move course to an archived department',
        });
      }
      updates.departmentId = nextDepartmentId;
    }
    if (req.body.description !== undefined) {
      updates.description = sanitizeText(req.body.description);
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate('departmentId', 'name facultyId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidate(courseCache, `course_${req.params.id}`);
    cacheHelper.invalidatePattern(courseCache, `department_${course.departmentId}_*`);

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Archive or unarchive course (admin)
// @route   PATCH /api/courses/:id/archive
// @access  Private/Admin
exports.setCourseArchiveStatus = async (req, res) => {
  try {
    const archived = req.body.archived !== undefined ? Boolean(req.body.archived) : true;

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isArchived: archived,
          archivedAt: archived ? new Date() : null,
        },
      },
      { new: true }
    ).populate('departmentId', 'name facultyId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidate(courseCache, `course_${req.params.id}`);
    cacheHelper.invalidatePattern(courseCache, `department_${course.departmentId}_*`);

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
