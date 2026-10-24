const express = require('express');
const router = express.Router();
const guardianController = require('../controllers/guardianController');
const authMiddleware = require('../middleware/authMiddleware');

// ── Public Endpoints (Accessible by Guardian without login) ──

// Read-only allowlisted summary via cryptographically secure expiring token
router.get('/summary/:token', guardianController.getSummaryByToken);

// Contact verification via token link
router.get('/verify/:token', guardianController.verifyTokenFromLink);
router.post('/verify/confirm', guardianController.confirmVerification);

// ── Student-Authenticated Endpoints (Guarded by JWT and STUDENT role) ──

router.use(authMiddleware.authenticateToken);

// Student guardian status
router.get('/status', authMiddleware.requireRole('STUDENT'), guardianController.getStatus);

// Setup & contact details
router.post('/contact', authMiddleware.requireRole('STUDENT'), guardianController.saveContact);

// Record consent
router.post('/consent', authMiddleware.requireRole('STUDENT'), guardianController.recordConsent);

// Request verification email (magic link)
router.post('/verify/send', authMiddleware.requireRole('STUDENT'), guardianController.sendVerification);

// Request OTP verification code (Email or SMS)
router.post('/otp/send', authMiddleware.requireRole('STUDENT'), guardianController.sendOtp);

// Verify OTP verification code
router.post('/otp/verify', authMiddleware.requireRole('STUDENT'), guardianController.verifyOtp);

// Generate 24-hour summary link
router.post('/summary-link', authMiddleware.requireRole('STUDENT'), guardianController.generateSummaryLink);

// Notification preferences
router.post('/notifications/preferences', authMiddleware.requireRole('STUDENT'), guardianController.updatePreferences);

// Revoke guardian monitoring or summary access
router.post('/access/revoke', authMiddleware.requireRole('STUDENT'), guardianController.revokeAccess);

// ── Legacy Compatibility (Role-guarded if previous GUARDIAN role is used) ──
router.get('/learners', authMiddleware.requireRole('GUARDIAN'), guardianController.getLinkedLearners);
router.get('/sessions/:learnerId', authMiddleware.requireRole('GUARDIAN'), guardianController.getLearnerSessions);
router.get('/progress/:learnerId', authMiddleware.requireRole('GUARDIAN'), guardianController.getLearnerProgress);

module.exports = router;
