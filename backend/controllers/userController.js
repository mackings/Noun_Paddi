const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const { validateStrongPassword } = require('../utils/securityValidation');
const { auditLog } = require('../utils/securityAudit');
const { generateUniqueReferralSlug } = require('../utils/referralHelper');
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        faculty: user.faculty,
        department: user.department,
        studyCenter: user.studyCenter,
        matricNumber: user.matricNumber,
        profileImage: user.profileImage,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields
    const { name, bio, faculty, department, studyCenter, matricNumber } = req.body;

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (faculty !== undefined) user.faculty = faculty;
    if (department !== undefined) user.department = department;
    if (studyCenter !== undefined) user.studyCenter = studyCenter;
    if (matricNumber !== undefined) user.matricNumber = matricNumber;

    // Handle profile image upload if provided
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (user.profileImage) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = user.profileImage.split('/');
          const publicIdWithExt = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExt.split('.')[0];
          const folder = 'nounpaddi-profile-images';
          await cloudinary.uploader.destroy(`${folder}/${publicId}`);
        } catch (error) {
          console.error('Error deleting old profile image:', error);
        }
      }

      // Upload new image
      user.profileImage = req.file.path;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        faculty: user.faculty,
        department: user.department,
        studyCenter: user.studyCenter,
        matricNumber: user.matricNumber,
        profileImage: user.profileImage,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update password
// @route   PUT /api/users/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password',
      });
    }

    const passwordCheck = validateStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      await auditLog({
        eventType: 'auth.update_password',
        req,
        userId: req.user?.id,
        success: false,
        message: passwordCheck.message,
      });
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      await auditLog({
        eventType: 'auth.update_password',
        req,
        userId: user._id,
        success: false,
        message: 'Current password incorrect',
      });
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();
    await auditLog({
      eventType: 'auth.update_password',
      req,
      userId: user._id,
      success: true,
      message: 'Password updated',
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete profile image
// @route   DELETE /api/users/profile-image
// @access  Private
exports.deleteProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'No profile image to delete',
      });
    }

    // Delete from Cloudinary
    try {
      // Extract public_id from Cloudinary URL
      const urlParts = user.profileImage.split('/');
      const publicIdWithExt = urlParts[urlParts.length - 1];
      const publicId = publicIdWithExt.split('.')[0];
      const folder = 'nounpaddi-profile-images';
      await cloudinary.uploader.destroy(`${folder}/${publicId}`);
    } catch (error) {
      console.error('Error deleting profile image from Cloudinary:', error);
    }

    user.profileImage = '';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search) {
      const safeSearch = String(search).trim();
      if (safeSearch) {
        const escapedSearch = escapeRegex(safeSearch);
        query.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { faculty: { $regex: escapedSearch, $options: 'i' } },
          { department: { $regex: escapedSearch, $options: 'i' } },
          { studyCenter: { $regex: escapedSearch, $options: 'i' } },
          { matricNumber: { $regex: escapedSearch, $options: 'i' } },
        ];
      }
    }

    const users = await User.find(query)
      .select('name email role faculty department studyCenter matricNumber profileImage bio createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Resolve a referral slug to the inviter's display name (used to show a
//          "You were invited by X" hint on the signup page, e.g. /register/macs)
// @route   GET /api/users/referral-preview/:slug
// @access  Public
exports.getReferralPreview = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase().trim().slice(0, 40);
    if (!slug) {
      return res.status(404).json({ success: false, message: 'Referral link not found' });
    }

    const referrer = await User.findOne({ referralSlug: slug }).select('name');
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Referral link not found' });
    }

    res.status(200).json({
      success: true,
      data: { name: referrer.name },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get the logged-in user's own referral link + who they've referred
// @route   GET /api/users/referrals
// @access  Private
exports.getReferrals = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Backfill a slug for accounts created before this feature existed — every other
    // path (signup) already sets one, so this only ever runs once per older account.
    if (!user.referralSlug) {
      user.referralSlug = await generateUniqueReferralSlug(User, user.name);
      await user.save({ validateBeforeSave: false });
    }

    const referrals = await User.find({ referredBy: user._id })
      .select('name createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        slug: user.referralSlug,
        count: referrals.length,
        referrals: referrals.map((referred) => ({
          name: referred.name,
          createdAt: referred.createdAt,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get user profile by id (admin)
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email role faculty department studyCenter matricNumber profileImage bio createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
