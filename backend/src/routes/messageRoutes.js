const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

// Messages are accessible to any authenticated user who is a participant in the mentorship.
// The controller verifies mentorship access using user ID (student or mentor side).
// This supports peer mentors (role=STUDENT with approved MentorProfile) automatically
// because verifyMentorshipAccess checks by userId, not by role.
router.get('/:mentorshipId', messageController.getMessages);
router.post('/:mentorshipId', messageController.sendMessage);

module.exports = router;
