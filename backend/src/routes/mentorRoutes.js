const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentor routes require authentication
router.use(authMiddleware.authenticateToken);

// Mentor's own profile routes
router.get('/me', mentorController.getMyProfile);
router.put('/me', mentorController.updateMyProfile);

// Mentor discovery routes
router.get('/', mentorController.getAvailableMentors);
router.get('/:id', mentorController.getMentorById);

module.exports = router;
