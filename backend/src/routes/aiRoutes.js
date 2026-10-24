const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

// Authentication
router.use(authMiddleware.authenticateToken);

router.post('/assist', authMiddleware.requireRole('STUDENT'), aiController.assist);
router.post('/mentor-recommendations', authMiddleware.requireRole('STUDENT'), aiController.recommendMentors);
router.post('/mentor-assist', authMiddleware.requireApprovedMentor, aiController.mentorAssist);

module.exports = router;
