const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/authMiddleware');
const { validate } = require('../utils/validation');

// Validation schemas for milestones
const milestoneCreateSchema = {
  title: { required: true },
  description: { required: false },
  dueDate: { required: false, type: 'date' }
};

const milestoneUpdateSchema = {
  title: { required: false },
  description: { required: false },
  dueDate: { required: false, type: 'date' },
  status: { 
    required: false, 
    enum: ['PENDING', 'COMPLETED'] 
  }
};

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// PUT /api/milestones/:id
router.put('/:id', validate(milestoneUpdateSchema), milestoneController.updateMilestone);

// DELETE /api/milestones/:id
router.delete('/:id', milestoneController.deleteMilestone);

module.exports = router;
