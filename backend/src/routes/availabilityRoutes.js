const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../utils/validation');

// Validation schema for availability
const availabilitySchema = {
  dayOfWeek: { 
    required: true,
    custom: (value) => {
      const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
      if (!value || !days.includes(String(value).toUpperCase())) {
        return `dayOfWeek must be one of: ${days.join(', ')}.`;
      }
      return null;
    }
  },
  startTime: { required: true, type: 'time' },
  endTime: { required: true, type: 'time' },
  isActive: { required: false }
};

// All availability routes require authentication AND approved mentor status
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireApprovedMentor);

router.get('/', availabilityController.getAvailability);
router.post('/', validate(availabilitySchema), availabilityController.createAvailability);
router.put('/:id', validate(availabilitySchema), availabilityController.updateAvailability);
router.delete('/:id', availabilityController.deleteAvailability);

module.exports = router;
