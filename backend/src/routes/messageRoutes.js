const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

router.get('/:mentorshipId', messageController.getMessages);
router.post('/:mentorshipId', messageController.sendMessage);

module.exports = router;
