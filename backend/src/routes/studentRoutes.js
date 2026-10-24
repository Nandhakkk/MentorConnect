const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware.authenticateToken);

router.get('/me', authMiddleware.requireRole('STUDENT'), studentController.getMyProfile);
router.put('/me', authMiddleware.requireRole('STUDENT'), studentController.updateMyProfile);
router.put('/onboarding', authMiddleware.requireRole('STUDENT'), studentController.completeOnboarding);
router.post('/link-guardian', authMiddleware.requireRole('STUDENT'), studentController.linkGuardian);
router.post('/me/profile-image', authMiddleware.requireRole('STUDENT'), upload.single('image'), studentController.uploadProfileImage);

// Account Email Change & Verification routes
router.post('/email/change', authMiddleware.requireRole('STUDENT'), studentController.requestEmailChange);
router.post('/email/verify', authMiddleware.requireRole('STUDENT'), studentController.verifyEmailChange);
router.post('/email/resend', authMiddleware.requireRole('STUDENT'), studentController.resendEmailChangeOtp);
router.post('/email/cancel', authMiddleware.requireRole('STUDENT'), studentController.cancelEmailChange);

module.exports = router;
