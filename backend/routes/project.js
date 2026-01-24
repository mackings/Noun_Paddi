const express = require('express');
const router = express.Router();
const {
  generateTopics,
  requestConsultation,
  initiateConsultationPayment,
  verifyConsultationPayment,
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');

router.post('/topics', protect, generateTopics);
router.post('/consultations', protect, requestConsultation);
router.post('/consultations/initiate-payment', protect, initiateConsultationPayment);
router.get('/consultations/verify', protect, verifyConsultationPayment);

module.exports = router;
