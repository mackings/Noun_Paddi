const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Course = require('../models/Course');
const { facultyCache, departmentCache, courseCache, cacheHelper } = require('../utils/cache');

// @desc    Get all faculties
// @route   GET /api/faculties
// @access  Public
exports.getFaculties = async (req, res) => {
  try {
    const cacheKey = 'all_faculties';

    const faculties = await cacheHelper.getOrSet(facultyCache, cacheKey, async () => {
      const results = await Faculty.find({ isArchived: { $ne: true } });
      return results.map(doc => doc.toObject());
    });

    res.status(200).json({
      success: true,
      count: faculties.length,
      data: faculties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create faculty
// @route   POST /api/faculties
// @access  Private/Admin
exports.createFaculty = async (req, res) => {
  try {
    const sanitizeText = (value) => String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const payload = {
      name: sanitizeText(req.body.name),
      code: req.body.code !== undefined ? sanitizeText(req.body.code).toUpperCase() : '',
      description: req.body.description !== undefined ? sanitizeText(req.body.description) : '',
    };

    const faculty = await Faculty.create(payload);

    // Invalidate faculty cache
    cacheHelper.invalidate(facultyCache, 'all_faculties');

    res.status(201).json({
      success: true,
      data: faculty,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update faculty (admin)
// @route   PUT /api/faculties/:id
// @access  Private/Admin
exports.updateFaculty = async (req, res) => {
  try {
    const sanitizeText = (value) => String(value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = sanitizeText(req.body.name);
    }
    if (req.body.code !== undefined) {
      updates.code = sanitizeText(req.body.code).toUpperCase();
    }
    if (req.body.description !== undefined) {
      updates.description = sanitizeText(req.body.description);
    }

    const faculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found',
      });
    }

    cacheHelper.invalidate(facultyCache, 'all_faculties');
    cacheHelper.invalidatePattern(departmentCache, `faculty_${req.params.id}_*`);
    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidatePattern(courseCache, 'department_*');

    res.status(200).json({
      success: true,
      data: faculty,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Archive or unarchive faculty (admin)
// @route   PATCH /api/faculties/:id/archive
// @access  Private/Admin
exports.setFacultyArchiveStatus = async (req, res) => {
  try {
    const archived = req.body.archived !== undefined ? Boolean(req.body.archived) : true;

    const faculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isArchived: archived,
          archivedAt: archived ? new Date() : null,
        },
      },
      { new: true }
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found',
      });
    }

    const archivePayload = {
      isArchived: archived,
      archivedAt: archived ? new Date() : null,
    };

    const departmentIds = await Department.find({ facultyId: req.params.id }).distinct('_id');

    await Department.updateMany(
      { facultyId: req.params.id },
      { $set: archivePayload }
    );

    if (departmentIds.length > 0) {
      await Course.updateMany(
        { departmentId: { $in: departmentIds } },
        { $set: archivePayload }
      );
    }

    cacheHelper.invalidate(facultyCache, 'all_faculties');
    cacheHelper.invalidatePattern(departmentCache, `faculty_${req.params.id}_*`);

    res.status(200).json({
      success: true,
      data: faculty,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get departments by faculty
// @route   GET /api/faculties/:facultyId/departments
// @access  Public
exports.getDepartmentsByFaculty = async (req, res) => {
  try {
    const cacheKey = `faculty_${req.params.facultyId}_departments`;

    const departments = await cacheHelper.getOrSet(departmentCache, cacheKey, async () => {
      const results = await Department.find({ facultyId: req.params.facultyId, isArchived: { $ne: true } })
        .populate('facultyId', 'name');
      return results.map(doc => doc.toObject());
    });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
