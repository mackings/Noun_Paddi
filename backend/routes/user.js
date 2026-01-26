const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updatePassword,
  deleteProfileImage,
  getUsers,
  getUserById,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { profileImageUpload } = require('../config/cloudinary');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, profileImageUpload.single('profileImage'), updateProfile);
router.put('/update-password', protect, updatePassword);
router.delete('/profile-image', protect, deleteProfileImage);
router.get('/', protect, authorize('admin'), getUsers);
router.get('/:id', protect, authorize('admin'), getUserById);

module.exports = router;
