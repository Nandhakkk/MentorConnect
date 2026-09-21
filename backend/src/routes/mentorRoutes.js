const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../utils/validation');

// Validation schema for mentor profile update
const mentorProfileSchema = {
  bio: { required: false },
  expertise: { required: false },
  experience: { required: false, type: 'nonNegativeNumber' },
  hourlyRate: { required: false, type: 'nonNegativeNumber' },
  isAvailable: { required: false }
};

// All mentor routes require authentication
router.use(authMiddleware.authenticateToken);

// Mentor's own profile routes - require approved status for full access
// But allow PENDING mentors to view and update their own profile (to complete application)
router.get('/me', mentorController.getMyProfile);
router.put('/me', validate(mentorProfileSchema), mentorController.updateMyProfile);

// Mentor discovery routes - these are public to authenticated users
// The controller already filters by isAvailable, we'll add status filter there
router.get('/', mentorController.getAvailableMentors);
router.get('/:id', mentorController.getMentorById);

module.exports = router;
