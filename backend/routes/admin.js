const express = require('express');
const router = express.Router();
const {
  getFacultiesAdmin,
  getDepartmentsAdmin,
  getCoursesAdmin,
  inviteAdmin,
  sendPushNotification,
  uploadNotificationImage,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { notificationImageUpload } = require('../config/cloudinary');

router.get('/faculties', protect, authorize('admin'), getFacultiesAdmin);
router.get('/departments', protect, authorize('admin'), getDepartmentsAdmin);
router.get('/courses', protect, authorize('admin'), getCoursesAdmin);
router.post('/invite', protect, authorize('admin'), inviteAdmin);
router.post('/notifications', protect, authorize('admin'), sendPushNotification);
router.post('/notifications/upload-image', protect, authorize('admin'), notificationImageUpload.single('image'), uploadNotificationImage);

module.exports = router;
