const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.authenticateToken);

// --- Goal Routes ---
// GET /api/goals
router.get('/', goalController.getGoals);

// GET /api/goals/:id
router.get('/:id', goalController.getGoalById);

// POST /api/goals
router.post('/', goalController.createGoal);

// PUT /api/goals/:id
router.put('/:id', goalController.updateGoal);

// DELETE /api/goals/:id
router.delete('/:id', goalController.deleteGoal);

// --- Milestone Routes ---
// Note: We mount the create route under goals so the goalId is part of the path
// POST /api/goals/:goalId/milestones
router.post('/:goalId/milestones', milestoneController.createMilestone);

// PUT and DELETE milestones directly by ID
// These could theoretically be mounted at /api/milestones in index.js,
// but mounting them here under /api/goals for simplicity is also fine if we adjust the base path slightly.
// Wait, the requirement says:
// PUT /api/milestones/:id
// DELETE /api/milestones/:id
// Let's create a separate router for milestones in index.js, or just export a milestone router.
module.exports = router;
