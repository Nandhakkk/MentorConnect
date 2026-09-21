const express = require('express');
const router = express.Router();
const mentorshipController = require('../controllers/mentorshipController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentorship routes require authentication
router.use(authMiddleware.authenticateToken);

// Student routes - students can create/view/cancel their own mentorships
router.post('/', mentorshipController.createMentorship);
router.get('/student', mentorshipController.getStudentMentorships);
router.delete('/:id', mentorshipController.cancelMentorship);

// Mentor routes - only APPROVED mentors can view their mentorships
router.get('/mentor', authMiddleware.requireApprovedMentor, mentorshipController.getMentorMentorships);

module.exports = router;
