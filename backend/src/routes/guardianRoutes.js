const express = require('express');
const router = express.Router();
const guardianController = require('../controllers/guardianController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('GUARDIAN'));

router.get('/learners', guardianController.getLinkedLearners);
router.get('/sessions/:learnerId', guardianController.getLearnerSessions);
router.get('/progress/:learnerId', guardianController.getLearnerProgress);

module.exports = router;
