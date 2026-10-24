const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');
const authMiddleware = require('../middleware/authMiddleware');

// Public Webhook route (authenticated via Razorpay cryptographic signature)
router.post('/webhook', refundController.handleWebhook);

// Protected routes (JWT authentication required)
router.use(authMiddleware.authenticateToken);

// Student / Mentor routes
router.get('/eligibility/:sessionId', refundController.getRefundEligibility);
router.post('/cancel-session/:sessionId', refundController.cancelSessionWithRefund);
router.post('/report-no-show/:sessionId', refundController.reportMentorNoShow);
router.get('/my', refundController.getMyRefunds);

// Admin-only routes
router.get('/admin', authMiddleware.requireRole('ADMIN'), refundController.getAdminRefunds);
router.put('/admin/:id/decision', authMiddleware.requireRole('ADMIN'), refundController.processAdminDecision);
router.post('/admin/manual', authMiddleware.requireRole('ADMIN'), refundController.createAdminManualRefund);
router.post('/admin/:id/retry', authMiddleware.requireRole('ADMIN'), refundController.retryFailedRefund);

module.exports = router;
