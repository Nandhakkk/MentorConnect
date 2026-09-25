const express = require('express');
const router = express.Router();
const peerMentorController = require('../controllers/peerMentorController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('STUDENT'));

router.get('/apply/eligibility', peerMentorController.getEligibility);
router.post('/apply', peerMentorController.createApplication);
router.get('/application', peerMentorController.getMyApplication);
router.put('/apply', peerMentorController.updateApplication);
router.post('/apply/screen', peerMentorController.screenApplication);

module.exports = router;
