const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../utils/validation');

// Validation schema for student profile update
const studentProfileSchema = {
  bio: { required: false },
  education: { required: false },
  skills: { required: false },
  interests: { required: false },
  careerGoal: { required: false }
};

router.use(authMiddleware.authenticateToken);

router.get('/me', authMiddleware.requireRole('STUDENT'), studentController.getMyProfile);
router.put('/me', authMiddleware.requireRole('STUDENT'), validate(studentProfileSchema), studentController.updateMyProfile);

module.exports = router;
