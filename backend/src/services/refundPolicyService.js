/**
 * Centralized Refund Policy Service — MentorConnect
 *
 * Enforces configurable, business-rule driven refund eligibility.
 * All monetary amounts are handled defensively avoiding floating-point drift.
 */

const POLICY_CONFIG = {
  EARLY_CANCELLATION_HOURS: 24,
  STANDARD_CANCELLATION_HOURS: 6,
  EARLY_REFUND_PERCENT: 100,
  STANDARD_REFUND_PERCENT: 50,
  PLATFORM_FEE_PERCENTAGE: 10 // 10% platform fee, 90% mentor share
};

/**
 * Calculates remaining refundable amount on a payment in INR.
 * @param {Object} payment - Payment record
 * @param {Array} refunds - Existing refund records on this payment
 * @returns {number} Remaining refundable amount in INR
 */
function getRemainingRefundableAmount(payment, refunds = []) {
  if (!payment || payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
    return 0;
  }

  const capturedPaise = Math.round(payment.amount * 100);

  // Sum up all refunds that are either PROCESSED or actively in progress (REQUESTED, PENDING_GATEWAY)
  const activeRefunds = refunds.filter(r =>
    r.status === 'PROCESSED' || r.status === 'PENDING_GATEWAY' || r.status === 'REQUESTED'
  );

  const refundedPaise = activeRefunds.reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
  const remainingPaise = Math.max(0, capturedPaise - refundedPaise);

  return Math.round(remainingPaise) / 100;
}

/**
 * Evaluates student cancellation refund eligibility based on session start time.
 * @param {Object} session - Session object with scheduledAt, duration, status
 * @param {Object} payment - Associated payment record
 * @param {Array} existingRefunds - Array of previous refunds for this session/payment
 * @param {Date} [currentTime=new Date()] - Reference timestamp
 * @returns {Object} Policy determination
 */
function evaluateStudentCancellation(session, payment, existingRefunds = [], currentTime = new Date()) {
  const isPaid = payment && (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED');

  if (!isPaid) {
    return {
      isPaid: false,
      eligibleForRefund: false,
      automaticRefund: false,
      requiresAdminReview: false,
      refundPercent: 0,
      refundAmount: 0,
      policyTier: 'STUDENT_LATE_EXCEPTIONAL',
      reasonMessage: 'Unpaid sessions are not eligible for a refund.'
    };
  }

  const remainingRefundable = getRemainingRefundableAmount(payment, existingRefunds);
  if (remainingRefundable <= 0) {
    return {
      isPaid: true,
      eligibleForRefund: false,
      automaticRefund: false,
      requiresAdminReview: false,
      refundPercent: 0,
      refundAmount: 0,
      policyTier: 'STUDENT_LATE_EXCEPTIONAL',
      reasonMessage: 'The total captured amount has already been refunded.'
    };
  }

  const scheduledTime = new Date(session.scheduledAt).getTime();
  const nowTime = new Date(currentTime).getTime();
  const diffHours = (scheduledTime - nowTime) / (1000 * 60 * 60);

  // If session is already marked completed
  if (session.status === 'COMPLETED') {
    return {
      isPaid: true,
      eligibleForRefund: false,
      automaticRefund: false,
      requiresAdminReview: true,
      refundPercent: 0,
      refundAmount: 0,
      maxAllowedRefund: remainingRefundable,
      policyTier: 'STUDENT_LATE_EXCEPTIONAL',
      reasonMessage: 'Completed sessions are not eligible for an automatic refund. You may submit an exceptional request for Admin Review.'
    };
  }

  // Tier 1: > 24 hours => 100% automatic refund
  if (diffHours >= POLICY_CONFIG.EARLY_CANCELLATION_HOURS) {
    const refundAmount = Math.min(payment.amount, remainingRefundable);
    return {
      isPaid: true,
      eligibleForRefund: true,
      automaticRefund: true,
      requiresAdminReview: false,
      refundPercent: POLICY_CONFIG.EARLY_REFUND_PERCENT,
      refundAmount,
      remainingRefundable,
      policyTier: 'STUDENT_EARLY_100',
      reasonMessage: 'Cancelled more than 24 hours prior to session start. Eligible for a 100% refund.'
    };
  }

  // Tier 2: 6 - 24 hours => 50% automatic refund
  if (diffHours >= POLICY_CONFIG.STANDARD_CANCELLATION_HOURS) {
    const calculated50 = Math.round(payment.amount * (POLICY_CONFIG.STANDARD_REFUND_PERCENT / 100) * 100) / 100;
    const refundAmount = Math.min(calculated50, remainingRefundable);
    return {
      isPaid: true,
      eligibleForRefund: true,
      automaticRefund: true,
      requiresAdminReview: false,
      refundPercent: POLICY_CONFIG.STANDARD_REFUND_PERCENT,
      refundAmount,
      remainingRefundable,
      policyTier: 'STUDENT_STANDARD_50',
      reasonMessage: 'Cancelled between 6 and 24 hours prior to session start. Eligible for a 50% refund.'
    };
  }

  // Tier 3: < 6 hours => No automatic refund; student can submit an exceptional request for admin review
  return {
    isPaid: true,
    eligibleForRefund: false,
    automaticRefund: false,
    requiresAdminReview: true,
    refundPercent: 0,
    refundAmount: 0,
    maxAllowedRefund: remainingRefundable,
    policyTier: 'STUDENT_LATE_EXCEPTIONAL',
    reasonMessage: 'Cancelled less than 6 hours prior to session start. Automatic refund is not available; you may submit an exceptional refund request for Admin Review.'
  };
}

/**
 * Evaluates mentor cancellation refund eligibility.
 * Mentors cancelling a paid session trigger a 100% refund for the student.
 * @param {Object} session
 * @param {Object} payment
 * @param {Array} existingRefunds
 * @returns {Object} Policy determination
 */
function evaluateMentorCancellation(session, payment, existingRefunds = []) {
  const isPaid = payment && (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED');

  if (!isPaid) {
    return {
      isPaid: false,
      eligibleForRefund: false,
      automaticRefund: false,
      refundPercent: 0,
      refundAmount: 0,
      policyTier: 'MENTOR_CANCELLATION_100',
      reasonMessage: 'Unpaid session. No refund required.'
    };
  }

  const remainingRefundable = getRemainingRefundableAmount(payment, existingRefunds);
  const refundAmount = Math.min(payment.amount, remainingRefundable);

  return {
    isPaid: true,
    eligibleForRefund: refundAmount > 0,
    automaticRefund: refundAmount > 0,
    requiresAdminReview: false,
    refundPercent: 100,
    refundAmount,
    remainingRefundable,
    policyTier: 'MENTOR_CANCELLATION_100',
    reasonMessage: 'Session cancelled by mentor. Student is eligible for a 100% refund.'
  };
}

/**
 * Calculates financial ledger split for retained funds.
 * @param {number} originalAmount
 * @param {number} refundAmount
 * @returns {Object} { retainedAmount, retainedPlatformFee, retainedMentorPayout }
 */
function calculateRetainedFinancials(originalAmount, refundAmount) {
  const origPaise = Math.round(originalAmount * 100);
  const refPaise = Math.round(refundAmount * 100);
  const retainedPaise = Math.max(0, origPaise - refPaise);

  const retainedPlatformFeePaise = Math.round(retainedPaise * (POLICY_CONFIG.PLATFORM_FEE_PERCENTAGE / 100));
  const retainedMentorPayoutPaise = retainedPaise - retainedPlatformFeePaise;

  return {
    retainedAmount: retainedPaise / 100,
    retainedPlatformFee: retainedPlatformFeePaise / 100,
    retainedMentorPayout: retainedMentorPayoutPaise / 100
  };
}

module.exports = {
  POLICY_CONFIG,
  getRemainingRefundableAmount,
  evaluateStudentCancellation,
  evaluateMentorCancellation,
  calculateRetainedFinancials
};
