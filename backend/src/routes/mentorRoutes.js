const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All mentor routes require authentication
router.use(authMiddleware.authenticateToken);

// Mentor's own profile routes
router.get('/me', authMiddleware.requireApprovedMentor, mentorController.getMyProfile);
router.get('/me/profile', authMiddleware.requireApprovedMentor, mentorController.getMyProfile);
router.put('/me', authMiddleware.requireApprovedMentor, mentorController.updateMyProfile);
router.put('/me/profile', authMiddleware.requireApprovedMentor, mentorController.updateMyProfile);
router.post('/me/profile-image', upload.single('image'), mentorController.uploadProfileImage);
router.get('/me/portfolio', authMiddleware.requireApprovedMentor, mentorController.getMyPortfolio);

// Availability
router.post('/me/availability', authMiddleware.requireApprovedMentor, mentorController.addAvailability);
router.delete('/me/availability/:id', authMiddleware.requireApprovedMentor, mentorController.removeAvailability);

// Verification Requests (For post-approval changes)
router.get('/me/verification-requests', authMiddleware.requireApprovedMentor, mentorController.getVerificationRequests);
router.post('/me/verification-requests', authMiddleware.requireApprovedMentor, upload.array('evidenceFiles', 5), mentorController.createVerificationRequest);

// Mentor discovery routes (Available to all authenticated users like Students)
router.get('/', mentorController.getAvailableMentors);
router.get('/:id', mentorController.getMentorById);

module.exports = router;
