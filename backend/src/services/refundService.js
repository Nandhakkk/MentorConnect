/**
 * Comprehensive Refund Service — MentorConnect
 *
 * Orchestrates business logic, concurrency protection, idempotency,
 * policy evaluation, and gateway interaction for all refund workflows.
 */

const crypto = require('crypto');
const prisma = require('../config/db');
const refundPolicyService = require('./refundPolicyService');
const razorpayRefundService = require('./razorpayRefundService');
const notificationService = require('./notificationService');
const guardianService = require('./guardianService');
const transactionalEmailService = require('./transactionalEmailService');

/**
 * Helper to generate a unique refund reference
 */
function generateRefundReference() {
  return `ref_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Gets refund eligibility for a session (read-only query for UI preview).
 * @param {string} sessionId
 * @param {Object} user
 * @returns {Promise<Object>}
 */
async function getSessionRefundEligibility(sessionId, user) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      mentorship: {
        include: {
          student: { include: { user: true } },
          mentor: { include: { user: true } }
        }
      },
      payment: {
        include: {
          refunds: true
        }
      }
    }
  });

  if (!session) {
    throw new Error('Session not found.');
  }

  const payment = session.payment;
  const refunds = payment?.refunds || [];

  if (user.role === 'MENTOR') {
    return refundPolicyService.evaluateMentorCancellation(session, payment, refunds);
  }

  return refundPolicyService.evaluateStudentCancellation(session, payment, refunds);
}

/**
 * Student-initiated cancellation with policy-based refund processing.
 * @param {string} sessionId
 * @param {Object} user - Authenticated student user
 * @param {string} [studentReason] - Optional reason or exceptional notes
 * @returns {Promise<Object>} Cancellation and refund result
 */
async function handleStudentSessionCancellation(sessionId, user, studentReason = '') {
  // Use a transaction with concurrency control
  return await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: {
            student: { include: { user: true } },
            mentor: { include: { user: true } }
          }
        },
        payment: {
          include: {
            refunds: true
          }
        }
      }
    });

    if (!session) {
      const err = new Error('Session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.mentorship.student.userId !== user.id) {
      const err = new Error('Access denied. You are not the student for this session.');
      err.statusCode = 403;
      throw err;
    }

    if (session.status === 'CANCELLED') {
      const err = new Error('Session is already cancelled.');
      err.statusCode = 400;
      throw err;
    }

    const payment = session.payment;
    const isPaid = payment && (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED');

    // Case 1: Unpaid session => cancel cleanly without refund
    if (!isPaid) {
      const updatedSess = await tx.session.update({
        where: { id: sessionId },
        data: { status: 'CANCELLED' }
      });

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'CANCELLED' }
        });
      }

      return {
        session: updatedSess,
        isPaid: false,
        refund: null,
        message: 'Unpaid session cancelled successfully. Slot has been released.'
      };
    }

    // Case 2: Paid session => evaluate refund policy
    const policy = refundPolicyService.evaluateStudentCancellation(session, payment, payment.refunds);

    // Cancel the session
    const updatedSess = await tx.session.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' }
    });

    // Check if there is an existing refund created for this session
    const existingActiveRefund = payment.refunds.find(r =>
      ['REQUESTED', 'PENDING_GATEWAY', 'PROCESSED'].includes(r.status)
    );

    let refundRecord = null;

    if (policy.automaticRefund && policy.refundAmount > 0) {
      // Create refund record in REQUESTED state, then execute gateway
      refundRecord = await tx.refund.create({
        data: {
          refundReference: generateRefundReference(),
          paymentId: payment.id,
          sessionId: session.id,
          amount: policy.refundAmount,
          policyTier: policy.policyTier,
          initiator: 'STUDENT',
          reason: studentReason || policy.reasonMessage,
          studentNotes: studentReason || null,
          status: 'REQUESTED',
          requestedById: user.id
        }
      });
    } else if (policy.requiresAdminReview) {
      // Late cancellation (< 6h) or completed: create exceptional request for admin review
      refundRecord = await tx.refund.create({
        data: {
          refundReference: generateRefundReference(),
          paymentId: payment.id,
          sessionId: session.id,
          amount: policy.maxAllowedRefund || payment.amount,
          policyTier: policy.policyTier,
          initiator: 'STUDENT',
          reason: studentReason || 'Student submitted exceptional refund request (< 6 hours before session).',
          studentNotes: studentReason || null,
          status: 'REQUESTED',
          requestedById: user.id
        }
      });

      // Notify Admin
      const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await notificationService.createNotification(
          admin.id,
          'REFUND',
          'Exceptional Refund Request Submitted',
          `A student requested an exceptional refund for session #${session.id.substring(0, 8)}. Reason: ${studentReason || 'Late cancellation'}.`,
          refundRecord.id,
          'REFUND'
        ).catch(e => console.error(e));
      }
    }

    return {
      session: updatedSess,
      mentorship: session.mentorship,
      payment,
      isPaid: true,
      policy,
      refund: refundRecord,
      message: policy.automaticRefund
        ? `Session cancelled. ${policy.reasonMessage}`
        : `Session cancelled. ${policy.reasonMessage}`
    };
  }).then(async (result) => {
    // If automatic refund was created, execute through Razorpay outside the DB transaction
    if (result.refund && result.policy?.automaticRefund) {
      try {
        const executed = await razorpayRefundService.executeGatewayRefund(result.refund.id);
        result.refund = executed;
      } catch (gwErr) {
        console.error('[RefundService] Automatic gateway execution error:', gwErr.message);
      }
    }

    // Real Transactional Emails (Event 4 & Event 6)
    const studentUser = result.mentorship?.student?.user;
    const mentorUser = result.mentorship?.mentor?.user;

    if (result.isPaid) {
      if (result.refund && result.policy?.automaticRefund) {
        await transactionalEmailService.notifyStudentCancellation({
          session: result.session,
          payment: result.payment,
          refund: result.refund,
          studentUser,
          mentorUser,
          policy: result.policy,
          reason: studentReason
        }).catch(e => console.error('[RefundService] Student cancellation email error:', e.message));
      } else if (result.policy?.requiresAdminReview && result.refund) {
        // Late cancellation (< 6h)
        await transactionalEmailService.notifyRefundRequested({
          refund: result.refund,
          session: result.session,
          studentUser,
          requestType: 'EXCEPTIONAL'
        }).catch(e => console.error('[RefundService] Refund requested email error:', e.message));

        await transactionalEmailService.notifyStudentCancellation({
          session: result.session,
          payment: result.payment,
          refund: result.refund,
          studentUser,
          mentorUser,
          policy: result.policy,
          reason: studentReason
        }).catch(e => console.error('[RefundService] Cancellation notice error:', e.message));
      }
    }
    // Note: For unpaid sessions (e.g. checkout dismissed before payment), no cancellation emails
    // are sent to the mentor because the session was never confirmed/booked.

    return result;
  });
}

/**
 * Mentor-initiated cancellation with 100% refund for paid sessions.
 * @param {string} sessionId
 * @param {Object} user - Authenticated mentor user
 * @param {string} reason - Cancellation reason from mentor
 * @returns {Promise<Object>}
 */
async function handleMentorSessionCancellation(sessionId, user, reason = '') {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: {
            student: { include: { user: true } },
            mentor: { include: { user: true } }
          }
        },
        payment: {
          include: {
            refunds: true
          }
        }
      }
    });

    if (!session) {
      const err = new Error('Session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.mentorship.mentor.userId !== user.id) {
      const err = new Error('Access denied. You are not the mentor for this session.');
      err.statusCode = 403;
      throw err;
    }

    if (session.status === 'CANCELLED') {
      const err = new Error('Session is already cancelled.');
      err.statusCode = 400;
      throw err;
    }

    const payment = session.payment;
    const isPaid = payment && (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED');

    // Cancel session
    const updatedSess = await tx.session.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' }
    });

    if (!isPaid) {
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'CANCELLED' }
        });
      }
      return {
        session: updatedSess,
        isPaid: false,
        refund: null,
        message: 'Session cancelled by mentor.'
      };
    }

    // Paid session cancelled by mentor => 100% refund
    const policy = refundPolicyService.evaluateMentorCancellation(session, payment, payment.refunds);

    let refundRecord = null;
    if (policy.refundAmount > 0) {
      refundRecord = await tx.refund.create({
        data: {
          refundReference: generateRefundReference(),
          paymentId: payment.id,
          sessionId: session.id,
          amount: policy.refundAmount,
          policyTier: 'MENTOR_CANCELLATION_100',
          initiator: 'MENTOR',
          reason: reason || 'Session cancelled by mentor.',
          status: 'REQUESTED',
          requestedById: user.id
        }
      });
    }

    // Cancel mentor payout if one exists
    const payout = await tx.payoutRecord.findUnique({ where: { paymentId: payment.id } });
    if (payout && (payout.status === 'ELIGIBLE' || payout.status === 'PROCESSING')) {
      await tx.payoutRecord.update({
        where: { id: payout.id },
        data: { status: 'CANCELLED' }
      });
    }

    return {
      session: updatedSess,
      mentorship: session.mentorship,
      payment,
      isPaid: true,
      policy,
      refund: refundRecord,
      message: 'Session cancelled by mentor. Student has been issued a 100% refund.'
    };
  }).then(async (result) => {
    if (result.refund) {
      try {
        const executed = await razorpayRefundService.executeGatewayRefund(result.refund.id);
        result.refund = executed;
      } catch (gwErr) {
        console.error('[RefundService] Mentor cancellation gateway refund error:', gwErr.message);
      }
    }

    // Real Transactional Email (Event 5: Mentor Cancellation)
    const studentUser = result.mentorship?.student?.user;
    const mentorUser = result.mentorship?.mentor?.user;
    await transactionalEmailService.notifyMentorCancellation({
      session: result.session,
      payment: result.payment,
      refund: result.refund,
      studentUser,
      mentorUser,
      reason
    }).catch(e => console.error('[RefundService] Mentor cancellation email error:', e.message));

    return result;
  });
}

/**
 * Confirmed Mentor No-Show Workflow.
 * Replaces automatic assumption of no-shows with a reviewable request.
 * @param {string} sessionId
 * @param {Object} studentUser
 * @param {string} notes
 * @returns {Promise<Object>}
 */
async function reportMentorNoShow(sessionId, studentUser, notes = '') {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: {
            student: { include: { user: true } },
            mentor: { include: { user: true } }
          }
        },
        payment: {
          include: { refunds: true }
        }
      }
    });

    if (!session) throw new Error('Session not found.');
    if (session.mentorship.student.userId !== studentUser.id) {
      throw new Error('Access denied.');
    }

    const payment = session.payment;
    if (!payment || payment.status !== 'PAID') {
      throw new Error('Only paid sessions can request a mentor no-show refund.');
    }

    const remaining = refundPolicyService.getRemainingRefundableAmount(payment, payment.refunds);
    if (remaining <= 0) {
      throw new Error('This session has already been fully refunded.');
    }

    // Create a 100% refund request under MENTOR_NO_SHOW_100 for admin review
    const refundRecord = await tx.refund.create({
      data: {
        refundReference: generateRefundReference(),
        paymentId: payment.id,
        sessionId: session.id,
        amount: remaining,
        policyTier: 'MENTOR_NO_SHOW_100',
        initiator: 'STUDENT',
        reason: notes || 'Student reported confirmed mentor no-show.',
        studentNotes: notes || null,
        status: 'REQUESTED',
        requestedById: studentUser.id
      }
    });

    // Notify Admins
    const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) {
      await notificationService.createNotification(
        admin.id,
        'REFUND',
        'Mentor No-Show Refund Review Requested',
        `Student ${studentUser.name} reported a mentor no-show for session #${session.id.substring(0, 8)}.`,
        refundRecord.id,
        'REFUND'
      ).catch(e => console.error(e));
    }

    // Real Transactional Email (Event 6: Refund Requested - No-Show)
    await transactionalEmailService.notifyRefundRequested({
      refund: refundRecord,
      session,
      studentUser,
      requestType: 'NO_SHOW'
    }).catch(e => console.error('[RefundService] No-show refund request email error:', e.message));

    return refundRecord;
  });
}

/**
 * Admin decision on a refund request (Approve full or partial, or Reject).
 * @param {string} refundId
 * @param {Object} adminUser
 * @param {Object} decisionData - { decision: 'APPROVE' | 'REJECT', amount, adminNotes }
 * @returns {Promise<Object>}
 */
async function processAdminRefundDecision(refundId, adminUser, decisionData) {
  const { decision, amount, adminNotes } = decisionData;

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: {
        include: {
          refunds: true,
          session: {
            include: {
              mentorship: {
                include: {
                  student: { include: { user: true } },
                  mentor: { include: { user: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!refund) throw new Error('Refund not found.');
  if (refund.status !== 'REQUESTED') {
    throw new Error(`Refund cannot be reviewed in status: ${refund.status}`);
  }

  const payment = refund.payment;
  if (!payment) throw new Error('Payment not found.');

  if (decision === 'REJECT') {
    const updated = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: 'REJECTED',
        adminNotes: adminNotes || 'Refund request rejected by admin.',
        reviewedById: adminUser.id,
        reviewedAt: new Date()
      }
    });

    // Notify Student
    if (refund.requestedById) {
      await notificationService.createNotification(
        refund.requestedById,
        'REFUND',
        'Refund Request Declined',
        `Your refund request (Ref: ${refund.refundReference}) was reviewed and declined. Notes: ${adminNotes || 'Not eligible'}.`,
        refund.id,
        'REFUND'
      ).catch(e => console.error(e));
    }

    // Real Transactional Email (Event 10: Refund Rejected)
    const studentUser = refund.payment?.session?.mentorship?.student?.user || (refund.requestedById ? await prisma.user.findUnique({ where: { id: refund.requestedById } }) : null);
    if (studentUser) {
      await transactionalEmailService.notifyRefundRejected({
        refund: updated,
        session: refund.payment?.session,
        studentUser,
        adminNotes: adminNotes || 'Refund request rejected by admin.'
      }).catch(e => console.error('[RefundService] Refund rejected email error:', e.message));
    }

    return updated;
  }

  if (decision === 'APPROVE') {
    // Validate approved amount
    const otherRefunds = payment.refunds.filter(r => r.id !== refund.id);
    const maxRefundable = refundPolicyService.getRemainingRefundableAmount(payment, otherRefunds);

    const approvedAmount = amount ? Math.min(Number(amount), maxRefundable) : Math.min(refund.amount, maxRefundable);

    if (approvedAmount <= 0) {
      throw new Error('Approved amount must be greater than zero and within the remaining refundable limit.');
    }

    // Update refund amount and admin details
    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        amount: approvedAmount,
        adminNotes: adminNotes || 'Approved by admin.',
        reviewedById: adminUser.id,
        reviewedAt: new Date()
      }
    });

    // Execute gateway refund
    const gatewayResult = await razorpayRefundService.executeGatewayRefund(refund.id);

    // If this was a mentor no-show approval, dispatch decision email (Event 11)
    if (refund.policyTier === 'MENTOR_NO_SHOW_100') {
      const studentUser = refund.payment?.session?.mentorship?.student?.user || (refund.requestedById ? await prisma.user.findUnique({ where: { id: refund.requestedById } }) : null);
      if (studentUser) {
        await transactionalEmailService.notifyComplaintRefundDecision({
          refund: gatewayResult,
          session: refund.payment?.session,
          studentUser,
          decisionTitle: 'Mentor No-Show Refund Approved',
          resolutionNotes: adminNotes || 'Admin approved 100% refund for confirmed mentor absence.'
        }).catch(e => console.error('[RefundService] No-show approved email error:', e.message));
      }
    }

    return gatewayResult;
  }

  throw new Error('Invalid decision. Must be APPROVE or REJECT.');
}

/**
 * Admin creates manual refund directly.
 * @param {Object} adminUser
 * @param {Object} data - { paymentId, amount, reason, adminNotes }
 * @returns {Promise<Object>}
 */
async function createAdminManualRefund(adminUser, data) {
  const { paymentId, amount, reason, adminNotes } = data;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: true, session: true }
  });

  if (!payment) throw new Error('Payment record not found.');
  if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
    throw new Error('Cannot issue refund on an unpaid payment.');
  }

  const maxRefundable = refundPolicyService.getRemainingRefundableAmount(payment, payment.refunds);
  const refundAmount = Number(amount);

  if (refundAmount <= 0 || refundAmount > maxRefundable) {
    throw new Error(`Refund amount must be between ₹1 and remaining ₹${maxRefundable}.`);
  }

  const refund = await prisma.refund.create({
    data: {
      refundReference: generateRefundReference(),
      paymentId: payment.id,
      sessionId: payment.sessionId,
      amount: refundAmount,
      policyTier: 'ADMIN_MANUAL',
      initiator: 'ADMIN',
      reason: reason || 'Manual refund initiated by admin.',
      adminNotes: adminNotes || null,
      status: 'REQUESTED',
      reviewedById: adminUser.id,
      reviewedAt: new Date()
    }
  });

  return await razorpayRefundService.executeGatewayRefund(refund.id);
}

module.exports = {
  generateRefundReference,
  getSessionRefundEligibility,
  handleStudentSessionCancellation,
  handleMentorSessionCancellation,
  reportMentorNoShow,
  processAdminRefundDecision,
  createAdminManualRefund
};
