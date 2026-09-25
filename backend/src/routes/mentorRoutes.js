const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentor routes require authentication
router.use(authMiddleware.authenticateToken);

// Mentor's own profile routes
router.get('/me', authMiddleware.requireApprovedMentor, mentorController.getMyProfile);
router.put('/me', authMiddleware.requireApprovedMentor, mentorController.updateMyProfile);

// Availability
router.post('/me/availability', authMiddleware.requireApprovedMentor, mentorController.addAvailability);
router.delete('/me/availability/:id', authMiddleware.requireApprovedMentor, mentorController.removeAvailability);

// Mentor discovery routes (Available to all authenticated users like Students)
router.get('/', mentorController.getAvailableMentors);
router.get('/:id', mentorController.getMentorById);

module.exports = router;
