const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// PUT /api/milestones/:id
router.put('/:id', milestoneController.updateMilestone);

// DELETE /api/milestones/:id
router.delete('/:id', milestoneController.deleteMilestone);

module.exports = router;
