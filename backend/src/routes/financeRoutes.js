const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

// Mentor endpoints
router.get('/mentor/earnings', authMiddleware.requireApprovedMentor, financeController.getMentorEarnings);

// Admin endpoints
router.get('/admin/summary', authMiddleware.requireRole('ADMIN'), financeController.getAdminFinanceSummary);
router.get('/admin/payouts', authMiddleware.requireRole('ADMIN'), financeController.getAdminPayouts);
router.put('/admin/payouts/:id/process', authMiddleware.requireRole('ADMIN'), financeController.processPayout);
router.put('/admin/payouts/:id/complete', authMiddleware.requireRole('ADMIN'), financeController.completePayout);

module.exports = router;
