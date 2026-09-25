const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

const requireApprovedMentorWhenMentor = (req, res, next) => {
  if (req.user.role !== 'MENTOR') return next();
  return authMiddleware.requireApprovedMentor(req, res, next);
};

router.get('/:mentorshipId', requireApprovedMentorWhenMentor, messageController.getMessages);
router.post('/:mentorshipId', requireApprovedMentorWhenMentor, messageController.sendMessage);

module.exports = router;
