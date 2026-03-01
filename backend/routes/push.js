const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');

router.use(protect);

router.get('/public-key', getPublicKey);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

module.exports = router;
