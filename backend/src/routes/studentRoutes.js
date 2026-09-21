const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

router.get('/me', authMiddleware.requireRole('STUDENT'), studentController.getMyProfile);
router.put('/me', authMiddleware.requireRole('STUDENT'), studentController.updateMyProfile);

module.exports = router;
