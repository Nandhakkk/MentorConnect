const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

router.get('/me', authMiddleware.requireRole('STUDENT'), studentController.getMyProfile);
router.put('/me', authMiddleware.requireRole('STUDENT'), studentController.updateMyProfile);
router.put('/onboarding', authMiddleware.requireRole('STUDENT'), studentController.completeOnboarding);
router.post('/link-guardian', authMiddleware.requireRole('STUDENT'), studentController.linkGuardian);

module.exports = router;
