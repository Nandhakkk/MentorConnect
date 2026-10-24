/**
 * Refund Controller — MentorConnect
 * Handles HTTP requests for refund eligibility, student/mentor cancellations,
 * admin review and processing, manual refunds, retries, and Razorpay webhooks.
 */

const prisma = require('../config/db');
const refundService = require('../services/refundService');
const razorpayRefundService = require('../services/razorpayRefundService');

/**
 * GET /api/refunds/eligibility/:sessionId
 * Checks refund policy eligibility for a session.
 */
const getRefundEligibility = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const eligibility = await refundService.getSessionRefundEligibility(sessionId, req.user);
    return res.status(200).json({ status: 'success', data: eligibility });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to check refund eligibility.'
    });
  }
};

/**
 * POST /api/refunds/cancel-session/:sessionId
 * Cancels a session and initiates policy-compliant refund (Student or Mentor).
 */
const cancelSessionWithRefund = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    const user = req.user;

    let result;
    if (user.role === 'MENTOR') {
      result = await refundService.handleMentorSessionCancellation(sessionId, user, reason);
    } else {
      result = await refundService.handleStudentSessionCancellation(sessionId, user, reason);
    }

    return res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to cancel session.'
    });
  }
};

/**
 * POST /api/refunds/report-no-show/:sessionId
 * Student reports confirmed mentor no-show for admin review.
 */
const reportMentorNoShow = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    const refund = await refundService.reportMentorNoShow(sessionId, req.user, notes);
    return res.status(201).json({
      status: 'success',
      message: 'Mentor no-show refund request submitted for admin review.',
      data: refund
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message || 'Failed to report mentor no-show.'
    });
  }
};

/**
 * GET /api/refunds/my
 * Fetches refunds requested by or associated with the logged-in student.
 */
const getMyRefunds = async (req, res) => {
  try {
    const refunds = await prisma.refund.findMany({
      where: {
        payment: {
          student: { userId: req.user.id }
        }
      },
      include: {
        session: { select: { id: true, scheduledAt: true, topic: true } },
        payment: { select: { amount: true, currency: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: refunds });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/refunds/admin
 * Admin list of all refunds with optional status filtering.
 */
const getAdminRefunds = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        payment: {
          include: {
            student: { include: { user: { select: { id: true, name: true, email: true } } } },
            session: {
              include: {
                mentorship: {
                  include: {
                    mentor: { include: { user: { select: { id: true, name: true, email: true } } } }
                  }
                }
              }
            }
          }
        },
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', data: refunds });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * PUT /api/refunds/admin/:id/decision
 * Admin approves or rejects an exceptional refund request.
 */
const processAdminDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, amount, adminNotes } = req.body;

    if (!decision || !['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ status: 'error', message: 'Decision must be APPROVE or REJECT.' });
    }

    const updated = await refundService.processAdminRefundDecision(id, req.user, {
      decision,
      amount,
      adminNotes
    });

    return res.status(200).json({
      status: 'success',
      message: `Refund request ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/refunds/admin/manual
 * Admin initiates a manual full or partial refund.
 */
const createAdminManualRefund = async (req, res) => {
  try {
    const { paymentId, amount, reason, adminNotes } = req.body;
    if (!paymentId || !amount) {
      return res.status(400).json({ status: 'error', message: 'paymentId and amount are required.' });
    }

    const refund = await refundService.createAdminManualRefund(req.user, {
      paymentId,
      amount,
      reason,
      adminNotes
    });

    return res.status(201).json({ status: 'success', message: 'Manual refund created.', data: refund });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/refunds/admin/:id/retry
 * Safely reconciles with gateway and retries a failed refund.
 */
const retryFailedRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const reconciled = await razorpayRefundService.reconcileAndRetryRefund(id);
    return res.status(200).json({
      status: 'success',
      message: 'Refund reconciled and re-executed.',
      data: reconciled
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/refunds/webhook
 * Public Razorpay webhook handler for refund events.
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const result = await razorpayRefundService.handleRazorpayWebhook(rawBody, signature, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[RefundWebhook] Error:', err.message);
    return res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  getRefundEligibility,
  cancelSessionWithRefund,
  reportMentorNoShow,
  getMyRefunds,
  getAdminRefunds,
  processAdminDecision,
  createAdminManualRefund,
  retryFailedRefund,
  handleWebhook
};
