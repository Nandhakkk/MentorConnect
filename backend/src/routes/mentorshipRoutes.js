const express = require('express');
const router = express.Router();
const mentorshipController = require('../controllers/mentorshipController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentorship routes require authentication
router.use(authMiddleware.authenticateToken);

// Student routes (fixed route order — named routes before parameterized)
router.get('/student', mentorshipController.getStudentMentorships);
router.post('/', mentorshipController.createMentorship);

// Mentor routes — requireApprovedMentor allows both PROFESSIONAL and PEER
router.get('/mentor', authMiddleware.requireApprovedMentor, mentorshipController.getMentorMentorships);
router.put('/:id/accept', authMiddleware.requireApprovedMentor, mentorshipController.acceptMentorship);
router.put('/:id/reject', authMiddleware.requireApprovedMentor, mentorshipController.rejectMentorship);

// Common routes (parameterized — must come after named routes)
router.get('/:id', mentorshipController.getMentorshipById);
router.delete('/:id', mentorshipController.cancelMentorship);

module.exports = router;
