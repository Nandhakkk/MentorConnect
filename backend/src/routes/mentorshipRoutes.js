const express = require('express');
const router = express.Router();
const mentorshipController = require('../controllers/mentorshipController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentorship routes require authentication
router.use(authMiddleware.authenticateToken);

// Student routes
router.post('/', mentorshipController.createMentorship);
router.get('/student', mentorshipController.getStudentMentorships);
router.delete('/:id', mentorshipController.cancelMentorship);

// Mentor routes
router.get('/mentor', mentorshipController.getMentorMentorships);

module.exports = router;
