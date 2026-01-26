const crypto = require('crypto');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Course = require('../models/Course');
const User = require('../models/User');
const { sendAdminInviteEmail } = require('../utils/emailService');

const sanitizeText = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const buildArchiveFilter = (includeArchived) => {
  if (includeArchived) {
    return {};
  }
  return { isArchived: { $ne: true } };
};

// @desc    Get faculties (admin)
// @route   GET /api/admin/faculties
// @access  Private/Admin
exports.getFacultiesAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const faculties = await Faculty.find(buildArchiveFilter(includeArchived)).sort({ name: 1 });

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

// @desc    Get departments (admin)
// @route   GET /api/admin/departments
// @access  Private/Admin
exports.getDepartmentsAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const departments = await Department.find(buildArchiveFilter(includeArchived))
      .populate('facultyId', 'name code')
      .sort({ name: 1 });

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

// @desc    Get courses (admin)
// @route   GET /api/admin/courses
// @access  Private/Admin
exports.getCoursesAdmin = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const courses = await Course.find(buildArchiveFilter(includeArchived))
      .populate('departmentId', 'name facultyId')
      .sort({ courseCode: 1 });

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

// @desc    Invite admin (admin)
// @route   POST /api/admin/invite
// @access  Private/Admin
exports.inviteAdmin = async (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    const email = sanitizeText(req.body.email).toLowerCase();

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    const rawPassword = crypto.randomBytes(10).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);

    const adminUser = await User.create({
      name,
      email,
      password: rawPassword,
      role: 'admin',
    });

    await sendAdminInviteEmail({
      email,
      userName: name,
      tempPassword: rawPassword,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
