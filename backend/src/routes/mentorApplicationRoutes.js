const express = require('express');
const router = express.Router();
const mentorApplicationController = require('../controllers/mentorApplicationController');
const authMiddleware = require('../middleware/authMiddleware');

// All mentor application routes require MENTOR role
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('MENTOR'));

router.get('/me', mentorApplicationController.getMyApplication);
router.post('/', mentorApplicationController.createApplication);
router.put('/me', mentorApplicationController.updateMyApplication);

module.exports = router;
