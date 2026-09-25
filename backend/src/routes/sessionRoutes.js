const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware');

// All session routes require authentication
router.use(authMiddleware.authenticateToken);

const requireApprovedMentorWhenMentor = (req, res, next) => {
  if (req.user.role !== 'MENTOR') return next();
  return authMiddleware.requireApprovedMentor(req, res, next);
};

router.get('/', requireApprovedMentorWhenMentor, sessionController.getSessions);
router.post('/', sessionController.createSession);
router.get('/:id', requireApprovedMentorWhenMentor, sessionController.getSessionById);
router.put('/:id/cancel', requireApprovedMentorWhenMentor, sessionController.cancelSession);
router.put('/:id/complete', authMiddleware.requireApprovedMentor, sessionController.completeSession);

module.exports = router;
