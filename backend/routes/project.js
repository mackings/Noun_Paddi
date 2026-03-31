const express = require('express');
const router = express.Router();
const {
  generateTopics,
  getFeeCheckerFaculties,
  getFeeCheckerLevels,
  getFeeCheckerPrograms,
  getFeeCheckerSemesters,
  requestConsultation,
  initiateConsultationPayment,
  verifyConsultationPayment,
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');

router.post('/topics', protect, generateTopics);
router.get('/fees/faculties', protect, getFeeCheckerFaculties);
router.get('/fees/programs', protect, getFeeCheckerPrograms);
router.get('/fees/levels', protect, getFeeCheckerLevels);
router.get('/fees/semesters', protect, getFeeCheckerSemesters);
router.post('/consultations', protect, requestConsultation);
router.post('/consultations/initiate-payment', protect, initiateConsultationPayment);
router.get('/consultations/verify', protect, verifyConsultationPayment);

module.exports = router;
