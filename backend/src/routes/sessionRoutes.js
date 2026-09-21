const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware');

// All session routes require authentication
router.use(authMiddleware.authenticateToken);

// Session read operations - available to both students and mentors
router.get('/', sessionController.getSessions);
router.get('/:id', sessionController.getSessionById);

// Booking sessions - only students can book (controller enforces this)
router.post('/', sessionController.createSession);

// Canceling - both can cancel their own sessions (controller enforces ownership)
router.put('/:id/cancel', sessionController.cancelSession);

// Completing - only APPROVED mentors can complete sessions
router.put('/:id/complete', authMiddleware.requireApprovedMentor, sessionController.completeSession);

module.exports = router;
