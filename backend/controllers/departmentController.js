const Department = require('../models/Department');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const { departmentCache, courseCache, cacheHelper } = require('../utils/cache');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Public
exports.getDepartments = async (req, res) => {
  try {
    const cacheKey = 'all_departments';

    const departments = await cacheHelper.getOrSet(departmentCache, cacheKey, async () => {
      const results = await Department.find({ isArchived: { $ne: true } })
        .populate('facultyId', 'name code');
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

// @desc    Create department
// @route   POST /api/departments
// @access  Private/Admin
exports.createDepartment = async (req, res) => {
  try {
    if (req.body.facultyId) {
      const faculty = await Faculty.findById(req.body.facultyId);
      if (faculty && faculty.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create a department under an archived faculty',
        });
      }
    }

    const department = await Department.create(req.body);

    // Invalidate relevant caches
    cacheHelper.invalidate(departmentCache, 'all_departments');
    cacheHelper.invalidatePattern(departmentCache, `faculty_${department.facultyId}_*`);
    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidatePattern(courseCache, `department_${req.params.id}_*`);
    cacheHelper.invalidate(courseCache, 'all_courses');
    cacheHelper.invalidatePattern(courseCache, `department_${req.params.id}_*`);

    res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Public
exports.getDepartment = async (req, res) => {
  try {
    const cacheKey = `department_${req.params.id}`;

    const department = await cacheHelper.getOrSet(departmentCache, cacheKey, async () => {
      const result = await Department.findById(req.params.id).populate('facultyId', 'name code');
      if (!result || result.isArchived) {
        return null;
      }
      return result ? result.toObject() : null;
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update department (admin)
// @route   PUT /api/departments/:id
// @access  Private/Admin
exports.updateDepartment = async (req, res) => {
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
    if (req.body.facultyId !== undefined) {
      const nextFacultyId = sanitizeText(req.body.facultyId);
      const faculty = await Faculty.findById(nextFacultyId);
      if (faculty && faculty.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move department to an archived faculty',
        });
      }
      updates.facultyId = nextFacultyId;
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate('facultyId', 'name code');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    cacheHelper.invalidate(departmentCache, 'all_departments');
    cacheHelper.invalidatePattern(departmentCache, `faculty_${department.facultyId}_*`);

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Archive or unarchive department (admin)
// @route   PATCH /api/departments/:id/archive
// @access  Private/Admin
exports.setDepartmentArchiveStatus = async (req, res) => {
  try {
    const archived = req.body.archived !== undefined ? Boolean(req.body.archived) : true;

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isArchived: archived,
          archivedAt: archived ? new Date() : null,
        },
      },
      { new: true }
    ).populate('facultyId', 'name code');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    await Course.updateMany(
      { departmentId: req.params.id },
      {
        $set: {
          isArchived: archived,
          archivedAt: archived ? new Date() : null,
        },
      }
    );

    cacheHelper.invalidate(departmentCache, 'all_departments');
    cacheHelper.invalidatePattern(departmentCache, `faculty_${department.facultyId}_*`);

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
