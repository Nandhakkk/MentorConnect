const guardianService = require('../services/guardianService');
const prisma = require('../config/db');
const { isMinor } = require('../utils/ageHelper');

/**
 * POST /api/guardian/contact
 * Save or update guardian contact details for the authenticated student.
 */
const saveContact = async (req, res) => {
  try {
    if (req.user.dateOfBirth && !isMinor(req.user.dateOfBirth)) {
      return res.status(403).json({ status: 'error', message: 'Guardian setup is not available for adult learners (18+).' });
    }
    const studentUserId = req.user.id;
    const { name, relationship, email, phone } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.saveOrUpdateContact(
      studentUserId,
      { name, relationship, email, phone },
      clientIp
    );

    return res.status(200).json({
      status: 'success',
      message: result.message,
      guardian: result.guardian,
      requiresVerification: result.requiresVerification
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/consent
 * Record student consent for guardian updates.
 */
const recordConsent = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const { consentGranted, policyVersion } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    if (consentGranted === undefined) {
      return res.status(400).json({ status: 'error', message: 'consentGranted (boolean) is required.' });
    }

    const result = await guardianService.recordConsent(
      studentUserId,
      { consentGranted: Boolean(consentGranted), policyVersion },
      clientIp
    );

    return res.status(200).json({
      status: 'success',
      message: consentGranted ? 'Guardian consent recorded successfully.' : 'Guardian consent revoked.',
      consent: result
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/otp/send
 * Dispatch OTP verification code to guardian contact (Email or Phone).
 */
const sendOtp = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const { method } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.sendGuardianOtp(studentUserId, { method }, clientIp);

    return res.status(200).json({
      status: 'success',
      message: result.message,
      method: result.method,
      recipient: result.recipient,
      expiresAt: result.expiresAt,
      cooldownSeconds: result.cooldownSeconds
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/otp/verify
 * Validate Guardian OTP and mark contact verified.
 */
const verifyOtp = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const { otp, method } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    if (!otp) {
      return res.status(400).json({ status: 'error', message: 'Verification code is required.' });
    }

    const result = await guardianService.verifyGuardianOtp(studentUserId, { otp, method }, clientIp);

    return res.status(200).json({
      status: 'success',
      message: result.message,
      isVerified: result.isVerified,
      isMonitoringActive: result.isMonitoringActive,
      consentStatus: result.consentStatus,
      verificationMethod: result.verificationMethod
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/verify/send
 * Dispatch verification email to guardian contact.
 */
const sendVerification = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.sendVerificationEmail(studentUserId, clientIp);

    return res.status(200).json({
      status: 'success',
      message: `Verification link sent to ${result.sentTo}.`,
      expiresAt: result.expiresAt
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/verify/confirm
 * Verify contact via token.
 */
const confirmVerification = async (req, res) => {
  try {
    const { token } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Verification token is required.' });
    }

    const result = await guardianService.confirmVerification(token, clientIp);

    return res.status(200).json({
      status: 'success',
      message: result.message,
      studentName: result.studentName,
      guardianName: result.guardianName
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/guardian/verify/:token
 * Verify contact via GET request (e.g. directly from email link).
 */
const verifyTokenFromLink = async (req, res) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.confirmVerification(token, clientIp);

    return res.status(200).json({
      status: 'success',
      message: result.message,
      studentName: result.studentName,
      guardianName: result.guardianName
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/guardian/status
 * Get the current student's guardian setup status.
 */
const getStatus = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const status = await guardianService.getGuardianStatus(studentUserId);

    return res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/guardian/summary-link
 * Generate a cryptographically secure, expiring 24-hour summary link.
 */
const generateSummaryLink = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.createSummaryLink(studentUserId, clientIp);

    return res.status(200).json({
      status: 'success',
      summaryUrl: result.summaryUrl,
      token: result.token,
      expiresAt: result.expiresAt,
      expiresInHours: result.expiresInHours
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/guardian/summary/:token
 * Public endpoint to fetch read-only allowlisted summary using valid token.
 */
const getSummaryByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const summary = await guardianService.getSummaryByToken(token, clientIp);

    // Set Cache-Control to prevent caching of sensitive pupil data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    return res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (err) {
    const statusCode = err.status || 400;
    return res.status(statusCode).json({
      status: 'error',
      code: err.code || 'ACCESS_DENIED',
      message: err.message
    });
  }
};

/**
 * POST /api/guardian/notifications/preferences
 * Guardian notifications are mandatory under platform policy; modification is disallowed.
 */
const updatePreferences = async (req, res) => {
  return res.status(403).json({
    status: 'error',
    message: 'Guardian notifications are mandatory for minor safeguarding under platform policy and cannot be customized or disabled.'
  });
};

/**
 * POST /api/guardian/access/revoke
 * Revoke guardian monitoring or summary access.
 */
const revokeAccess = async (req, res) => {
  try {
    const studentUserId = req.user.id;
    const { reason } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.revokeGuardianAccess(studentUserId, reason, clientIp);

    return res.status(200).json({
      status: 'success',
      message: result.message
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

// ── Legacy Compatibility Handlers (for backward compatibility if needed) ──
const getLinkedLearners = async (req, res) => {
  try {
    const guardianId = req.user.id;
    const relations = await prisma.guardian.findMany({
      where: { userId: guardianId, isMonitoringActive: true },
      include: {
        learner: {
          select: {
            id: true,
            name: true,
            email: true,
            dateOfBirth: true
          }
        }
      }
    });

    return res.status(200).json({
      status: 'success',
      learners: relations.map(r => ({ ...r.learner, relationship: r.relationship }))
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch linked learners.', details: err.message });
  }
};

const getLearnerSessions = async (req, res) => {
  return res.status(200).json({ status: 'success', sessions: [] });
};

const getLearnerProgress = async (req, res) => {
  return res.status(200).json({ status: 'success', progress: { goals: [], assignments: [] } });
};

module.exports = {
  saveContact,
  recordConsent,
  sendOtp,
  verifyOtp,
  sendVerification,
  confirmVerification,
  verifyTokenFromLink,
  getStatus,
  generateSummaryLink,
  getSummaryByToken,
  updatePreferences,
  revokeAccess,
  getLinkedLearners,
  getLearnerSessions,
  getLearnerProgress
};
