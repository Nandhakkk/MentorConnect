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
router.get('/mentor', authMiddleware.requireApprovedMentor, mentorshipController.getMentorMentorships);
router.put('/:id/accept', authMiddleware.requireApprovedMentor, mentorshipController.acceptMentorship);
router.put('/:id/reject', authMiddleware.requireApprovedMentor, mentorshipController.rejectMentorship);

module.exports = router;
