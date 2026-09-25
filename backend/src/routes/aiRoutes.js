const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

// Authentication + STUDENT-only guard
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('STUDENT'));

router.post('/assist', aiController.assist);
router.post('/mentor-recommendations', aiController.recommendMentors);

module.exports = router;
