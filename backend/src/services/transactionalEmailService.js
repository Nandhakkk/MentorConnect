/**
 * Transactional Email Notification Service — MentorConnect
 *
 * Implements branded, mobile-responsive transactional emails for all 12 payment,
 * booking, cancellation, refund, and payout events using the real SMTP emailService.
 * Enforces recipient rules, minor/guardian safeguarding, database-backed idempotency,
 * and delivery tracking without exposing sensitive financial credentials.
 */

const prisma = require('../config/db');
const emailService = require('./emailService');
const { isMinor } = require('../utils/ageHelper');
const logger = require('../utils/logger');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Format currency in Indian Rupees
 */
const formatINR = (amount) => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Standard branded HTML Email Template Wrapper
 */
const buildHtmlEmail = ({
  title,
  badgeText,
  badgeBg = '#2563eb',
  badgeColor = '#ffffff',
  greetingName = 'User',
  introMessage,
  tableRows = [],
  calloutBox = null,
  actionButton = null,
  safeguardingNotice = null,
  footerNote = null
}) => {
  const tableHtml = tableRows.length > 0 ? `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
      <tbody>
        ${tableRows.map((row, idx) => `
          <tr style="${idx < tableRows.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; width: 38%;">${row.label}</td>
            <td style="padding: 12px 16px; color: #1e293b; font-weight: ${row.bold ? '700' : '500'}; text-align: right;">${row.value}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  const calloutHtml = calloutBox ? `
    <div style="background: ${calloutBox.bg || '#eff6ff'}; border-left: 4px solid ${calloutBox.border || '#3b82f6'}; padding: 14px 16px; border-radius: 6px; margin: 20px 0; font-size: 14px; color: ${calloutBox.color || '#1e3a8a'}; line-height: 1.5;">
      ${calloutBox.title ? `<strong style="display: block; margin-bottom: 4px;">${calloutBox.title}</strong>` : ''}
      ${calloutBox.content}
    </div>
  ` : '';

  const actionButtonHtml = actionButton ? `
    <div style="text-align: center; margin: 28px 0 20px;">
      <a href="${actionButton.url}" style="background-color: ${actionButton.bg || '#2563eb'}; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
        ${actionButton.text}
      </a>
    </div>
  ` : '';

  const safeguardingHtml = safeguardingNotice ? `
    <div style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin-top: 24px; border: 1px dashed #cbd5e1; line-height: 1.5;">
      🛡️ <strong>Safeguarding &amp; Privacy Notice:</strong> ${safeguardingNotice}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="padding: 24px 28px; background: #0f172a; border-bottom: 3px solid #3b82f6;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Mentor<span style="color: #60a5fa;">Connect</span></span>
                      </td>
                      <td align="right">
                        ${badgeText ? `
                          <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                            ${badgeText}
                          </span>
                        ` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding: 28px;">
                  <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                    ${title}
                  </h2>
                  <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
                    Hello ${greetingName},
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
                    ${introMessage}
                  </p>

                  ${tableHtml}
                  ${calloutHtml}
                  ${actionButtonHtml}
                  ${safeguardingHtml}

                  ${footerNote ? `
                    <p style="font-size: 13px; color: #64748b; margin-top: 20px; line-height: 1.5;">
                      ${footerNote}
                    </p>
                  ` : ''}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="font-size: 12px; color: #64748b; margin: 0 0 6px;">
                    MentorConnect — AI-Powered Mentorship &amp; Goal-Based Learning
                  </p>
                  <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                    🔒 Security Reminder: MentorConnect staff will never ask for your UPI PIN, banking passwords, CVV, or OTPs.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Sends a transactional email with database idempotency check & audit logging.
 * Prevents duplicate emails when events or webhooks retry within 24 hours.
 */
const recordAndSendEmail = async ({
  userId,
  recipientEmail,
  subject,
  html,
  text,
  title,
  plainMessage,
  referenceId = null,
  referenceType = 'PAYMENT',
  guardianId = null,
  eventType = 'PAYMENT'
}) => {
  if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    logger.warn(`[Transactional Email] Skipped: Invalid recipient email "${recipientEmail}"`);
    return { success: false, error: 'Invalid recipient email' };
  }

  const cleanEmail = recipientEmail.trim().toLowerCase();

  // 1. Idempotency Check: Prevent duplicate email within 24 hours for same reference and title
  if (referenceId) {
    try {
      const existing = await prisma.notification.findFirst({
        where: {
          recipientEmail: cleanEmail,
          referenceId: String(referenceId),
          title,
          channel: 'EMAIL',
          deliveryStatus: 'DELIVERED',
          sentAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) }
        }
      });

      if (existing) {
        logger.info(`[Transactional Email Deduplicated] "${title}" already delivered to ${cleanEmail} for reference ${referenceId}`);
        return { success: true, deduplicated: true, messageId: existing.id };
      }
    } catch (checkErr) {
      logger.warn(`[Transactional Email] Idempotency check warning: ${checkErr.message}`);
    }
  }

  // 2. Dispatch via Nodemailer SMTP service
  let sendResult = { success: false, error: 'SMTP delivery failed' };
  try {
    sendResult = await emailService.sendMail({
      to: cleanEmail,
      subject,
      html,
      text: text || plainMessage,
      eventType,
      metadata: { referenceId, referenceType, guardianId, userId }
    });
  } catch (err) {
    logger.error(`[Transactional Email Error] To: ${cleanEmail} | Subject: ${subject} | Error: ${err.message}`);
    sendResult = { success: false, error: err.message };
  }

  // 3. Record in database Notification ledger (non-blocking)
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: eventType === 'REFUND' ? 'REFUND' : 'PAYMENT',
        title,
        message: plainMessage || title,
        referenceId: referenceId ? String(referenceId) : null,
        referenceType,
        channel: 'EMAIL',
        deliveryStatus: sendResult.success ? 'DELIVERED' : 'FAILED',
        recipientEmail: cleanEmail,
        guardianId: guardianId || null,
        sentAt: new Date(),
        errorMessage: sendResult.error || null
      }
    });
  } catch (dbErr) {
    logger.error(`[Transactional Email] Failed to record notification in database: ${dbErr.message}`);
  }

  return sendResult;
};

/**
 * Helper to fetch a minor student's active verified guardian
 */
const getVerifiedGuardianForMinor = async (studentUserId) => {
  if (!studentUserId) return null;

  try {
    const student = await prisma.user.findUnique({
      where: { id: studentUserId },
      include: {
        guardians: {
          where: { isVerified: true, isMonitoringActive: true, consentStatus: 'GRANTED' },
          take: 1
        }
      }
    });

    if (!student || !student.dateOfBirth || !isMinor(student.dateOfBirth)) {
      return null;
    }

    return student.guardians && student.guardians.length > 0 ? student.guardians[0] : null;
  } catch (err) {
    logger.error(`[Transactional Email] Guardian lookup failed: ${err.message}`);
    return null;
  }
};

// ============================================================================
// 12 TRANSACTIONAL EMAIL EVENT IMPLEMENTATIONS
// ============================================================================

/**
 * EVENT 1: Payment Successful
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyPaymentSuccess = async ({ payment, session, studentUser, mentorUser }) => {
  if (!studentUser || !studentUser.email) return;

  const kolkataDate = emailService.formatKolkataDateTime(session.scheduledAt);
  const formattedAmount = formatINR(payment.amount);

  // 1. Email to Student
  const studentHtml = buildHtmlEmail({
    title: 'Payment Confirmed — Session Scheduled',
    badgeText: 'Payment Verified',
    badgeBg: '#10b981',
    greetingName: studentUser.name,
    introMessage: `Your payment of <strong>${formattedAmount}</strong> has been successfully verified, and your mentoring session is confirmed!`,
    tableRows: [
      { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
      { label: 'Mentor', value: mentorUser?.name || 'Assigned Mentor' },
      { label: 'Scheduled Time (IST)', value: kolkataDate },
      { label: 'Duration', value: `${session.duration} minutes` },
      { label: 'Amount Paid', value: formattedAmount, bold: true },
      { label: 'Payment ID', value: payment.razorpayPaymentId || 'Recorded' },
      { label: 'Status', value: 'Confirmed & Scheduled' }
    ],
    calloutBox: {
      bg: '#f0fdf4',
      border: '#22c55e',
      color: '#166534',
      title: 'Session Preparation',
      content: 'Your meeting room will open 10 minutes prior to the scheduled start time. Please have your goals and questions ready for your mentor.'
    },
    actionButton: {
      text: 'View My Sessions',
      url: `${CLIENT_URL}/student/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Payment Confirmed for "${session.topic || 'Mentoring Session'}"`,
    html: studentHtml,
    plainMessage: `Payment of ${formattedAmount} verified for session with ${mentorUser?.name || 'mentor'} on ${kolkataDate}.`,
    title: 'Payment Confirmed & Session Scheduled',
    referenceId: session.id,
    referenceType: 'PAYMENT',
    eventType: 'PAYMENT'
  });

  // 2. Email to Verified Guardian (if student is under 18)
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Payment Confirmed for Student Mentoring Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#3b82f6',
      greetingName: guardian.name || 'Guardian',
      introMessage: `This is an authorized notice that a payment of <strong>${formattedAmount}</strong> was confirmed for <strong>${studentUser.name}</strong>'s upcoming mentoring session.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Mentor', value: mentorUser?.name || 'Assigned Mentor' },
        { label: 'Scheduled Time (IST)', value: kolkataDate },
        { label: 'Duration', value: `${session.duration} minutes` },
        { label: 'Amount Paid', value: formattedAmount, bold: true },
        { label: 'Payment ID', value: payment.razorpayPaymentId || 'Recorded' }
      ],
      safeguardingNotice: 'You receive this notification as the verified parent or guardian of a learner under 18. Mentoring sessions are conducted in accordance with platform child safety policies.',
      actionButton: {
        text: 'View Guardian Portal',
        url: `${CLIENT_URL}/guardian`,
        bg: '#0f172a'
      }
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Payment Confirmed for ${studentUser.name}'s Session`,
      html: guardianHtml,
      plainMessage: `Payment of ${formattedAmount} confirmed for ${studentUser.name}'s session with ${mentorUser?.name || 'mentor'} on ${kolkataDate}.`,
      title: 'Guardian: Payment Confirmed',
      referenceId: session.id,
      referenceType: 'PAYMENT',
      guardianId: guardian.id,
      eventType: 'PAYMENT'
    });
  }
};

/**
 * EVENT 2: Payment Failed or Verification Failed
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyPaymentFailed = async ({ session, studentUser, reason = 'Payment verification failed', attemptedAmount = null }) => {
  if (!studentUser || !studentUser.email) return;

  const kolkataDate = session ? emailService.formatKolkataDateTime(session.scheduledAt) : 'Pending';
  const formattedAmount = attemptedAmount ? formatINR(attemptedAmount) : 'N/A';

  const studentHtml = buildHtmlEmail({
    title: 'Payment Verification Notice — Session Unconfirmed',
    badgeText: 'Action Required',
    badgeBg: '#ef4444',
    greetingName: studentUser.name,
    introMessage: `Your payment could not be verified by the gateway. As a result, <strong>the mentoring session was not confirmed</strong>, and no funds were captured.`,
    tableRows: [
      { label: 'Session Topic', value: session?.topic || 'Mentoring Session' },
      { label: 'Requested Time (IST)', value: kolkataDate },
      { label: 'Attempted Amount', value: formattedAmount },
      { label: 'Failure Reason', value: reason },
      { label: 'Session Status', value: 'Unconfirmed / Not Booked', bold: true }
    ],
    calloutBox: {
      bg: '#fef2f2',
      border: '#ef4444',
      color: '#991b1b',
      title: 'What should you do?',
      content: 'If money was deducted by your bank or UPI app, it will automatically reverse back to your account within 3–5 business days as the payment was not captured. You may retry booking the session whenever you are ready.'
    },
    actionButton: {
      text: 'Retry Session Booking',
      url: `${CLIENT_URL}/student/book-session`,
      bg: '#ef4444'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: 'MentorConnect — Payment Unsuccessful (Session Not Booked)',
    html: studentHtml,
    plainMessage: `Payment verification failed for session "${session?.topic || 'Mentoring Session'}". No session was booked. Reason: ${reason}.`,
    title: 'Payment Verification Failed',
    referenceId: session?.id || session?.payment?.id || `fail_${Date.now()}`,
    referenceType: 'PAYMENT',
    eventType: 'PAYMENT'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Payment Unsuccessful for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#ef4444',
      greetingName: guardian.name || 'Guardian',
      introMessage: `An attempted payment for <strong>${studentUser.name}</strong>'s session was unsuccessful. <strong>No session was booked and no payment was accepted.</strong>`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Session Topic', value: session?.topic || 'Mentoring Session' },
        { label: 'Attempted Amount', value: formattedAmount },
        { label: 'Gateway Status', value: 'Failed / Uncaptured' }
      ],
      calloutBox: {
        bg: '#fff7ed',
        border: '#f97316',
        color: '#9a3412',
        content: 'If an amount was debited by your bank, it will reverse automatically within standard banking timelines (typically 3–5 business days).'
      }
    });

    const failureRef = session?.id || session?.payment?.id || `fail_${Date.now()}`;

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Payment Unsuccessful for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Payment attempt of ${formattedAmount} for ${studentUser.name}'s session was not successful. No session was booked.`,
      title: 'Guardian: Payment Unsuccessful',
      referenceId: failureRef,
      referenceType: 'PAYMENT',
      guardianId: guardian.id,
      eventType: 'PAYMENT'
    });
  }
};

/**
 * EVENT 3: Session Booking Confirmed (For Mentor)
 * Dispatched to Mentor
 */
const notifyMentorBookingConfirmed = async ({ session, studentUser, mentorUser, payment }) => {
  if (!mentorUser || !mentorUser.email) return;

  const kolkataDate = emailService.formatKolkataDateTime(session.scheduledAt);
  const formattedAmount = payment ? formatINR(payment.mentorAmount || (payment.amount * 0.9)) : 'Complimentary';

  const mentorHtml = buildHtmlEmail({
    title: 'New Mentoring Session Confirmed',
    badgeText: 'Session Confirmed',
    badgeBg: '#10b981',
    greetingName: mentorUser.name,
    introMessage: `A new mentoring session has been booked and confirmed with student <strong>${studentUser?.name || 'a student'}</strong>.`,
    tableRows: [
      { label: 'Student', value: studentUser?.name || 'Enrolled Student' },
      { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
      { label: 'Date & Time (IST)', value: kolkataDate },
      { label: 'Duration', value: `${session.duration} minutes` },
      { label: 'Net Earnings', value: formattedAmount, bold: true }
    ],
    calloutBox: {
      bg: '#f8fafc',
      border: '#3b82f6',
      color: '#1e3a8a',
      title: 'Mentor Guidelines',
      content: 'Please arrive in the video room 5 minutes prior to the session start. If you need to reschedule or cancel, please provide at least 24 hours advance notice.'
    },
    actionButton: {
      text: 'View Mentor Sessions',
      url: `${CLIENT_URL}/mentor/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: mentorUser.id,
    recipientEmail: mentorUser.email,
    subject: `MentorConnect — New Session Confirmed with ${studentUser?.name || 'Student'} on ${kolkataDate}`,
    html: mentorHtml,
    plainMessage: `New mentoring session with ${studentUser?.name} confirmed for ${kolkataDate}. Net earnings: ${formattedAmount}.`,
    title: 'New Session Booked',
    referenceId: session.id,
    referenceType: 'SESSION',
    eventType: 'GENERAL'
  });
};

/**
 * EVENT 4: Student Cancellation
 * Dispatched to Student (+ Guardian if minor) & Mentor
 */
const notifyStudentCancellation = async ({ session, payment, refund, studentUser, mentorUser, policy, reason = '' }) => {
  const kolkataDate = emailService.formatKolkataDateTime(session.scheduledAt);
  const refundAmount = refund ? formatINR(refund.amount) : '₹0.00';
  const refundPercent = policy?.refundPercent ?? (refund ? Math.round((refund.amount / (payment?.amount || 1)) * 100) : 0);

  // 1. Student Email
  if (studentUser && studentUser.email) {
    const isLateReview = policy?.requiresAdminReview;
    const studentHtml = buildHtmlEmail({
      title: 'Session Cancellation & Refund Summary',
      badgeText: 'Session Cancelled',
      badgeBg: '#ef4444',
      greetingName: studentUser.name,
      introMessage: `Your session scheduled for <strong>${kolkataDate}</strong> has been cancelled.`,
      tableRows: [
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Mentor', value: mentorUser?.name || 'Assigned Mentor' },
        { label: 'Original Fee', value: payment ? formatINR(payment.amount) : '₹0.00' },
        { label: 'Cancellation Policy', value: `${refundPercent}% Refund Tier` },
        { label: 'Refund Amount', value: refundAmount, bold: true },
        { label: 'Refund Status', value: isLateReview ? 'Awaiting Admin Review' : 'Refund Initiated' },
        { label: 'Refund Reference', value: refund?.refundReference || 'N/A' }
      ],
      calloutBox: isLateReview ? {
        bg: '#fffbeb',
        border: '#f59e0b',
        color: '#92400e',
        title: 'Admin Review Required',
        content: 'Your cancellation occurred less than 6 hours prior to the session start. Our moderation team will review your exceptional cancellation request within 24–48 hours.'
      } : {
        bg: '#eff6ff',
        border: '#3b82f6',
        color: '#1e3a8a',
        title: 'Banking Processing Timeline',
        content: 'Your refund has been initiated back to your original payment method. Depending on your bank or UPI PSP, it typically takes 5–7 business days to reflect on your statement.'
      },
      actionButton: {
        text: 'View Session History',
        url: `${CLIENT_URL}/student/sessions`,
        bg: '#2563eb'
      }
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: studentUser.email,
      subject: 'MentorConnect — Session Cancelled & Refund Information',
      html: studentHtml,
      plainMessage: `Your session on ${kolkataDate} was cancelled. Refund amount: ${refundAmount} (${refundPercent}% tier).`,
      title: 'Session Cancelled by Student',
      referenceId: session.id,
      referenceType: 'SESSION',
      eventType: refund ? 'REFUND' : 'GENERAL'
    });
  }

  // 2. Guardian Email (if minor)
  const guardian = await getVerifiedGuardianForMinor(studentUser?.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Student Mentoring Session Cancelled',
      badgeText: 'Guardian Notice',
      badgeBg: '#64748b',
      greetingName: guardian.name || 'Guardian',
      introMessage: `Authorized notice: <strong>${studentUser.name}</strong> has cancelled their scheduled mentoring session.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Scheduled Time (IST)', value: kolkataDate },
        { label: 'Refund Amount', value: refundAmount, bold: true },
        { label: 'Refund Status', value: refund ? refund.status : 'No Refund' }
      ],
      calloutBox: {
        bg: '#f8fafc',
        border: '#94a3b8',
        color: '#334155',
        content: 'Refunds return strictly to the original funding account. Bank posting timelines typically take 5–7 business days.'
      }
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Session Cancelled for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Session cancelled for ${studentUser.name}. Refund amount: ${refundAmount}.`,
      title: 'Guardian: Student Cancelled Session',
      referenceId: session.id,
      referenceType: 'SESSION',
      guardianId: guardian.id,
      eventType: refund ? 'REFUND' : 'GENERAL'
    });
  }

  // 3. Mentor Email
  if (mentorUser && mentorUser.email) {
    const mentorHtml = buildHtmlEmail({
      title: 'Mentoring Session Cancelled by Student',
      badgeText: 'Slot Released',
      badgeBg: '#f59e0b',
      greetingName: mentorUser.name,
      introMessage: `Student <strong>${studentUser?.name || 'A student'}</strong> has cancelled the mentoring session scheduled for <strong>${kolkataDate}</strong>. Your availability slot has been reopened.`,
      tableRows: [
        { label: 'Student', value: studentUser?.name || 'Student' },
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Scheduled Time (IST)', value: kolkataDate },
        { label: 'Status', value: 'Slot Released' }
      ],
      actionButton: {
        text: 'View Availability & Schedule',
        url: `${CLIENT_URL}/mentor/sessions`,
        bg: '#2563eb'
      }
    });

    await recordAndSendEmail({
      userId: mentorUser.id,
      recipientEmail: mentorUser.email,
      subject: `MentorConnect — Session Cancelled by ${studentUser?.name || 'Student'} (${kolkataDate})`,
      html: mentorHtml,
      plainMessage: `Session on ${kolkataDate} cancelled by student ${studentUser?.name}. Slot released.`,
      title: 'Session Cancelled by Student',
      referenceId: session.id,
      referenceType: 'SESSION',
      eventType: 'GENERAL'
    });
  }
};

/**
 * EVENT 5: Mentor Cancellation
 * Dispatched to Student (+ Guardian if minor) & Mentor
 */
const notifyMentorCancellation = async ({ session, payment, refund, studentUser, mentorUser, reason = '' }) => {
  const kolkataDate = emailService.formatKolkataDateTime(session.scheduledAt);
  const refundAmount = refund ? formatINR(refund.amount) : (payment ? formatINR(payment.amount) : '₹0.00');

  // 1. Student Email
  if (studentUser && studentUser.email) {
    const studentHtml = buildHtmlEmail({
      title: 'Session Cancelled by Mentor — 100% Refund Issued',
      badgeText: '100% Refund',
      badgeBg: '#10b981',
      greetingName: studentUser.name,
      introMessage: `Your mentor, <strong>${mentorUser?.name || 'Mentor'}</strong>, was unable to attend and cancelled your session on <strong>${kolkataDate}</strong>.`,
      tableRows: [
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Mentor', value: mentorUser?.name || 'Mentor' },
        { label: 'Reason', value: reason || 'Mentor requested cancellation' },
        { label: 'Refund Amount', value: refundAmount, bold: true },
        { label: 'Policy Applied', value: '100% Mentor Cancellation Refund' },
        { label: 'Refund Reference', value: refund?.refundReference || 'In Progress' }
      ],
      calloutBox: {
        bg: '#f0fdf4',
        border: '#22c55e',
        color: '#166534',
        title: 'Full Refund Initiated',
        content: 'A 100% refund has been initiated to your original payment method. The funds typically reflect in your account within 5–7 business days depending on your bank.'
      },
      actionButton: {
        text: 'Book with Another Mentor',
        url: `${CLIENT_URL}/student/find-mentors`,
        bg: '#2563eb'
      }
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: studentUser.email,
      subject: 'MentorConnect — Mentor Cancelled Session (100% Refund Issued)',
      html: studentHtml,
      plainMessage: `Session on ${kolkataDate} cancelled by mentor. 100% refund of ${refundAmount} initiated.`,
      title: 'Mentor Cancelled Session',
      referenceId: session.id,
      referenceType: 'SESSION',
      eventType: 'REFUND'
    });
  }

  // 2. Guardian Email (if minor)
  const guardian = await getVerifiedGuardianForMinor(studentUser?.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Mentor Cancelled Session — 100% Refund Issued',
      badgeText: 'Guardian Notice',
      badgeBg: '#10b981',
      greetingName: guardian.name || 'Guardian',
      introMessage: `The mentor for <strong>${studentUser.name}</strong> has cancelled the session scheduled for ${kolkataDate}. A full 100% refund has been initiated.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Mentor', value: mentorUser?.name || 'Mentor' },
        { label: 'Refund Amount', value: refundAmount, bold: true },
        { label: 'Refund Reference', value: refund?.refundReference || 'In Progress' }
      ],
      safeguardingNotice: 'Refunds are automatically credited to the original payment source. Mentors with repeated cancellations are subject to administrative review.'
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Session Cancelled for ${studentUser.name} (100% Refund)`,
      html: guardianHtml,
      plainMessage: `Mentor cancelled session on ${kolkataDate} for ${studentUser.name}. 100% refund of ${refundAmount} initiated.`,
      title: 'Guardian: Mentor Cancelled Session',
      referenceId: session.id,
      referenceType: 'SESSION',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }

  // 3. Mentor Email
  if (mentorUser && mentorUser.email) {
    const mentorHtml = buildHtmlEmail({
      title: 'Session Cancellation Confirmation',
      badgeText: 'Session Cancelled',
      badgeBg: '#64748b',
      greetingName: mentorUser.name,
      introMessage: `Your mentoring session on <strong>${kolkataDate}</strong> has been cancelled per your request. The student has received a 100% refund.`,
      tableRows: [
        { label: 'Student', value: studentUser?.name || 'Student' },
        { label: 'Session Topic', value: session.topic || 'Mentoring Session' },
        { label: 'Refund Policy', value: '100% Refund Issued to Student' }
      ]
    });

    await recordAndSendEmail({
      userId: mentorUser.id,
      recipientEmail: mentorUser.email,
      subject: `MentorConnect — Cancellation Confirmed for ${kolkataDate}`,
      html: mentorHtml,
      plainMessage: `Session on ${kolkataDate} cancelled per your request. Student refunded.`,
      title: 'Mentor Cancellation Confirmed',
      referenceId: session.id,
      referenceType: 'SESSION',
      eventType: 'GENERAL'
    });
  }
};

/**
 * EVENT 6: Refund Requested & Awaiting Review
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyRefundRequested = async ({ refund, session, studentUser, requestType = 'EXCEPTIONAL' }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);
  const typeLabel = requestType === 'NO_SHOW' ? 'Confirmed Mentor No-Show' : 'Exceptional Late Cancellation';

  const studentHtml = buildHtmlEmail({
    title: 'Refund Request Received — Under Review',
    badgeText: 'Under Moderation Review',
    badgeBg: '#f59e0b',
    badgeColor: '#000000',
    greetingName: studentUser.name,
    introMessage: `Your refund request for <strong>${formattedAmount}</strong> has been received and is currently under review by our moderation team.`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Request Type', value: typeLabel },
      { label: 'Amount Requested', value: formattedAmount },
      { label: 'Submission Date', value: emailService.formatKolkataDateTime(refund.requestedAt || new Date()) },
      { label: 'Current Status', value: 'Pending Admin Review' }
    ],
    calloutBox: {
      bg: '#fffbeb',
      border: '#f59e0b',
      color: '#92400e',
      title: 'What happens next?',
      content: 'Our support and moderation team investigates refund requests against session logs and platform activity within 24–48 hours. You will receive an email confirmation once a decision is made.'
    },
    actionButton: {
      text: 'View Refund Status',
      url: `${CLIENT_URL}/student/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Refund Request Received (Ref: ${refund.refundReference})`,
    html: studentHtml,
    plainMessage: `Refund request of ${formattedAmount} for ${typeLabel} received. Reference: ${refund.refundReference}. Awaiting moderation review.`,
    title: 'Refund Request Awaiting Review',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Refund Request Submitted for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#f59e0b',
      badgeColor: '#000000',
      greetingName: guardian.name || 'Guardian',
      introMessage: `A refund request of <strong>${formattedAmount}</strong> has been submitted regarding <strong>${studentUser.name}</strong>'s mentoring session.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Amount Requested', value: formattedAmount },
        { label: 'Status', value: 'Under Moderation Review' }
      ]
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Refund Request Submitted for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Refund request for ${formattedAmount} regarding ${studentUser.name}'s session is under review. Reference: ${refund.refundReference}.`,
      title: 'Guardian: Refund Request Submitted',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 7: Refund Approved / Submitted to Gateway (Refund Initiated)
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyRefundInitiated = async ({ refund, session, studentUser, gatewayRefund = null }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);
  const gatewayRefundId = gatewayRefund?.id || refund.razorpayRefundId || 'Submitted to Gateway';

  const studentHtml = buildHtmlEmail({
    title: 'Refund Initiated to Original Payment Method',
    badgeText: 'Refund Initiated',
    badgeBg: '#3b82f6',
    greetingName: studentUser.name,
    introMessage: `Your refund of <strong>${formattedAmount}</strong> has been successfully submitted to the payment gateway (Razorpay).`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Gateway Refund ID', value: gatewayRefundId },
      { label: 'Amount', value: formattedAmount, bold: true },
      { label: 'Payment Method', value: 'Original Method (UPI/Card/Netbanking)' },
      { label: 'Status', value: 'Initiated — Pending Bank Settlement' }
    ],
    calloutBox: {
      bg: '#eff6ff',
      border: '#3b82f6',
      color: '#1e3a8a',
      title: 'Expected Crediting Timeline',
      content: 'The payment gateway has accepted the refund request. Funds are returned directly to the account or card used during checkout. Depending on your bank or UPI provider, it typically takes <strong>5 to 7 business days</strong> for the credit to reflect.'
    },
    actionButton: {
      text: 'Check Session Status',
      url: `${CLIENT_URL}/student/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Refund Initiated (Ref: ${refund.refundReference})`,
    html: studentHtml,
    plainMessage: `Refund of ${formattedAmount} initiated to original payment method. Gateway ID: ${gatewayRefundId}. Typically reflects in 5-7 business days.`,
    title: 'Refund Initiated',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Refund Initiated for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#3b82f6',
      greetingName: guardian.name || 'Guardian',
      introMessage: `A refund of <strong>${formattedAmount}</strong> has been submitted to the gateway for <strong>${studentUser.name}</strong>'s session.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Amount', value: formattedAmount },
        { label: 'Status', value: 'Initiated (5–7 business days bank processing)' }
      ]
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Refund Initiated for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Refund of ${formattedAmount} initiated for ${studentUser.name}'s session. Reference: ${refund.refundReference}.`,
      title: 'Guardian: Refund Initiated',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 8: Refund Successfully Processed
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyRefundProcessed = async ({ refund, session, studentUser, gatewayRefund = null }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);
  const gatewayRefundId = gatewayRefund?.id || refund.razorpayRefundId || 'Processed';

  const studentHtml = buildHtmlEmail({
    title: 'Refund Successfully Processed',
    badgeText: 'Completed',
    badgeBg: '#10b981',
    greetingName: studentUser.name,
    introMessage: `Your refund of <strong>${formattedAmount}</strong> has been confirmed as <strong>PROCESSED</strong> by the payment gateway.`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Razorpay Refund ID', value: gatewayRefundId },
      { label: 'Amount Credited', value: formattedAmount, bold: true },
      { label: 'Settlement Status', value: 'PROCESSED' },
      { label: 'Processed At', value: emailService.formatKolkataDateTime(refund.processedAt || new Date()) }
    ],
    calloutBox: {
      bg: '#f0fdf4',
      border: '#22c55e',
      color: '#166534',
      title: 'Credit Confirmation',
      content: 'The transaction has been cleared by the gateway and credited back to your issuing bank or UPI account. If you do not see the credit entry in your statement, please share the Razorpay Refund ID with your bank.'
    },
    actionButton: {
      text: 'View Payment History',
      url: `${CLIENT_URL}/student/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Refund Processed Successfully (${formattedAmount})`,
    html: studentHtml,
    plainMessage: `Your refund of ${formattedAmount} has been processed by the gateway. Ref: ${refund.refundReference}, Gateway ID: ${gatewayRefundId}.`,
    title: 'Refund Processed',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Refund Processed for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#10b981',
      greetingName: guardian.name || 'Guardian',
      introMessage: `Authorized notice: The refund of <strong>${formattedAmount}</strong> for <strong>${studentUser.name}</strong>'s session has been successfully processed by the payment gateway.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Amount Credited', value: formattedAmount },
        { label: 'Status', value: 'PROCESSED' }
      ]
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Refund Processed for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Refund of ${formattedAmount} for ${studentUser.name} has been processed by the gateway. Ref: ${refund.refundReference}.`,
      title: 'Guardian: Refund Processed',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 9: Refund Failed
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyRefundFailed = async ({ refund, session, studentUser, failureReason = '' }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);

  const studentHtml = buildHtmlEmail({
    title: 'Refund Processing Delay Notice',
    badgeText: 'Support Alert',
    badgeBg: '#ef4444',
    greetingName: studentUser.name,
    introMessage: `There was a technical issue attempting to automatically process your refund of <strong>${formattedAmount}</strong>.`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Amount', value: formattedAmount },
      { label: 'Status', value: 'Gateway Error — Escalated to Finance' }
    ],
    calloutBox: {
      bg: '#fef2f2',
      border: '#ef4444',
      color: '#991b1b',
      title: 'Our Finance Team Has Been Notified',
      content: 'Do not worry — your eligibility for this refund is preserved. Our finance administrators have been alerted and will manually reconcile or re-issue the refund via Razorpay.'
    },
    actionButton: {
      text: 'Contact Support',
      url: `${CLIENT_URL}/support`,
      bg: '#ef4444'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Refund Processing Notice (Ref: ${refund.refundReference})`,
    html: studentHtml,
    plainMessage: `There was a delay processing your refund of ${formattedAmount} (Ref: ${refund.refundReference}). Our finance team has been notified.`,
    title: 'Refund Failed',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Refund Processing Delay for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#ef4444',
      greetingName: guardian.name || 'Guardian',
      introMessage: `An automated refund attempt for <strong>${studentUser.name}</strong> encountered a gateway issue and has been escalated to administration.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Amount', value: formattedAmount },
        { label: 'Status', value: 'Escalated to Finance Support' }
      ]
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Refund Processing Delay for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Refund of ${formattedAmount} for ${studentUser.name} has been escalated to admin finance support.`,
      title: 'Guardian: Refund Failed',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 10: Refund Rejected or Cancelled
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyRefundRejected = async ({ refund, session, studentUser, adminNotes = '' }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);

  const studentHtml = buildHtmlEmail({
    title: 'Refund Request Decision: Declined',
    badgeText: 'Review Concluded',
    badgeBg: '#64748b',
    greetingName: studentUser.name,
    introMessage: `Following administrative review of your refund request (Ref: <strong>${refund.refundReference}</strong>), the request could not be approved.`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Requested Amount', value: formattedAmount },
      { label: 'Decision', value: 'Declined' },
      { label: 'Review Notes', value: adminNotes || 'Does not meet eligibility criteria under cancellation policy' }
    ],
    calloutBox: {
      bg: '#f8fafc',
      border: '#94a3b8',
      color: '#334155',
      title: 'Policy Guidelines',
      content: 'Standard cancellations occurring less than 6 hours prior to session start or after session conclusion require demonstrated mentor absence or technical failure to qualify for exceptional refunds.'
    },
    actionButton: {
      text: 'View Help & Support',
      url: `${CLIENT_URL}/support`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — Refund Request Decision (Ref: ${refund.refundReference})`,
    html: studentHtml,
    plainMessage: `Refund request ${refund.refundReference} was declined. Notes: ${adminNotes || 'Not eligible'}.`,
    title: 'Refund Request Declined',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Refund Request Concluded for Student Session',
      badgeText: 'Guardian Notice',
      badgeBg: '#64748b',
      greetingName: guardian.name || 'Guardian',
      introMessage: `Administrative review has concluded for the refund request filed regarding <strong>${studentUser.name}</strong>'s session.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Decision', value: 'Declined' }
      ]
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Refund Request Update for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Refund request ${refund.refundReference} for ${studentUser.name} was declined after review.`,
      title: 'Guardian: Refund Request Declined',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 11: Admin-Approved No-Show or Complaint Refund Decisions
 * Dispatched to Student (+ Guardian if minor)
 */
const notifyComplaintRefundDecision = async ({ refund, session, studentUser, decisionTitle, resolutionNotes = '' }) => {
  if (!studentUser || !studentUser.email) return;

  const formattedAmount = formatINR(refund.amount);

  const studentHtml = buildHtmlEmail({
    title: decisionTitle || 'Refund Approved Following Investigation',
    badgeText: 'Resolution Upheld',
    badgeBg: '#10b981',
    greetingName: studentUser.name,
    introMessage: `Your inquiry has been reviewed and resolved by our administration team. An approved refund of <strong>${formattedAmount}</strong> has been issued.`,
    tableRows: [
      { label: 'Refund Reference', value: refund.refundReference, bold: true },
      { label: 'Approved Amount', value: formattedAmount, bold: true },
      { label: 'Resolution Summary', value: resolutionNotes || 'Inquiry upheld and refund authorized by moderation.' },
      { label: 'Status', value: 'Approved & Submitted to Gateway' }
    ],
    calloutBox: {
      bg: '#f0fdf4',
      border: '#22c55e',
      color: '#166534',
      title: 'Refund Credit Information',
      content: 'The authorized refund has been routed through Razorpay to your original payment method. Funds typically reflect within 5–7 business days depending on your banking provider.'
    },
    actionButton: {
      text: 'View Sessions & Receipts',
      url: `${CLIENT_URL}/student/sessions`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: studentUser.id,
    recipientEmail: studentUser.email,
    subject: `MentorConnect — ${decisionTitle || 'Refund Approved Following Investigation'}`,
    html: studentHtml,
    plainMessage: `Inquiry resolved and refund of ${formattedAmount} approved. Reference: ${refund.refundReference}.`,
    title: 'Complaint/No-Show Refund Approved',
    referenceId: refund.id,
    referenceType: 'REFUND',
    eventType: 'REFUND'
  });

  // Guardian notice if minor
  const guardian = await getVerifiedGuardianForMinor(studentUser.id);
  if (guardian && guardian.email) {
    const guardianHtml = buildHtmlEmail({
      title: 'Notice: Inquiry Resolved & Refund Approved for Student',
      badgeText: 'Guardian Notice',
      badgeBg: '#10b981',
      greetingName: guardian.name || 'Guardian',
      introMessage: `A support investigation regarding <strong>${studentUser.name}</strong> has been completed with an approved refund of <strong>${formattedAmount}</strong>.`,
      tableRows: [
        { label: 'Student', value: studentUser.name },
        { label: 'Refund Reference', value: refund.refundReference },
        { label: 'Approved Amount', value: formattedAmount },
        { label: 'Status', value: 'Approved — Routed to Payment Source' }
      ],
      safeguardingNotice: 'Private communication transcripts and moderation deliberative details are strictly confidential and omitted.'
    });

    await recordAndSendEmail({
      userId: studentUser.id,
      recipientEmail: guardian.email,
      subject: `MentorConnect — Support Inquiry Resolved for ${studentUser.name}`,
      html: guardianHtml,
      plainMessage: `Inquiry for ${studentUser.name} resolved with approved refund of ${formattedAmount}. Ref: ${refund.refundReference}.`,
      title: 'Guardian: Inquiry Refund Approved',
      referenceId: refund.id,
      referenceType: 'REFUND',
      guardianId: guardian.id,
      eventType: 'REFUND'
    });
  }
};

/**
 * EVENT 12: Mentor Payout Processed
 * Dispatched to Mentor
 */
const notifyMentorPayoutProcessed = async ({ payout, mentorUser, status = 'PAID' }) => {
  if (!mentorUser || !mentorUser.email) return;

  const isPaid = status === 'PAID';
  const netAmount = formatINR(payout.netAmount);
  const grossAmount = formatINR(payout.grossAmount);
  const fee = formatINR(payout.platformFee);

  const mentorHtml = buildHtmlEmail({
    title: isPaid ? 'Mentor Payout Processed Successfully' : 'Mentor Payout Processing Alert',
    badgeText: isPaid ? 'Payout Paid' : 'Payout Failed',
    badgeBg: isPaid ? '#10b981' : '#ef4444',
    greetingName: mentorUser.name,
    introMessage: isPaid
      ? `Your session payout of <strong>${netAmount}</strong> has been successfully processed and transferred.`
      : `There was an issue processing your payout of <strong>${netAmount}</strong>. Our finance team is reviewing your payment profile.`,
    tableRows: [
      { label: 'Payout ID', value: payout.id, bold: true },
      { label: 'Gross Session Amount', value: grossAmount },
      { label: 'Platform Fee (10%)', value: fee },
      { label: 'Net Disbursed Amount', value: netAmount, bold: true },
      { label: 'Status', value: isPaid ? 'PAID' : 'FAILED' },
      { label: 'Transfer Reference', value: payout.providerId || (isPaid ? 'Direct Bank Transfer' : 'Under Investigation') }
    ],
    actionButton: {
      text: 'View Earnings Ledger',
      url: `${CLIENT_URL}/mentor/earnings`,
      bg: isPaid ? '#2563eb' : '#ef4444'
    }
  });

  await recordAndSendEmail({
    userId: mentorUser.id,
    recipientEmail: mentorUser.email,
    subject: `MentorConnect — Payout ${isPaid ? 'Processed' : 'Update'} (${netAmount})`,
    html: mentorHtml,
    plainMessage: `Payout of ${netAmount} is marked ${status}. Reference: ${payout.providerId || payout.id}.`,
    title: isPaid ? 'Mentor Payout Processed' : 'Mentor Payout Failed',
    referenceId: payout.id,
    referenceType: 'PAYOUT',
    eventType: 'PAYMENT'
  });
};

/**
 * EVENT 13: Mentor Application Auto-Rejected (Ineligible on Objective Criteria)
 * Dispatched to Applicant
 */
const notifyMentorApplicationAutoRejected = async ({ user, application, isPeer = false, failedCriteria = [], appealPath = null }) => {
  if (!user || !user.email) return;

  const kolkataDate = emailService.formatKolkataDateTime(application.reviewedAt || new Date());
  const formattedCriteria = failedCriteria.length > 0
    ? `<ul style="margin: 8px 0 0 18px; padding: 0;">${failedCriteria.map(c => `<li style="margin-bottom: 6px;"><strong>${c.category || 'Mandatory Criterion'}:</strong> ${c.message}</li>`).join('')}</ul>`
    : 'One or more mandatory objective eligibility criteria were not met.';

  const actionUrl = isPeer ? `${CLIENT_URL}/peer-mentor/apply` : `${CLIENT_URL}/mentor/application`;

  const html = buildHtmlEmail({
    title: 'Mentor Application Eligibility Notice',
    badgeText: 'Eligibility Incomplete',
    badgeBg: '#ef4444',
    badgeColor: '#ffffff',
    greetingName: user.name,
    introMessage: `Thank you for your interest in becoming a ${isPeer ? 'Peer' : 'Professional'} Mentor on MentorConnect. During our automated preliminary eligibility screening, our system identified that your application does not currently meet one or more mandatory, objective requirements.`,
    tableRows: [
      { label: 'Applicant Name', value: user.name },
      { label: 'Mentor Category', value: isPeer ? 'Peer Mentor (Student)' : 'Professional Mentor' },
      { label: 'Evaluation Date', value: kolkataDate },
      { label: 'Screening Outcome', value: 'Auto-Rejected (Objective Criteria Unmet)', bold: true },
      { label: 'Rule Standard', value: 'MentorConnect Published Eligibility Rules v1.0' }
    ],
    calloutBox: {
      bg: '#fef2f2',
      border: '#ef4444',
      color: '#991b1b',
      title: 'Unmet Requirement(s)',
      content: formattedCriteria
    },
    actionButton: {
      text: 'Update Details & Reapply',
      url: actionUrl,
      bg: '#2563eb'
    },
    safeguardingNotice: 'MentorConnect automated pre-screening verifies objective requirements only. If you believe this evaluation was made in error, you may contact administrative support to request a manual review.',
    footerNote: 'Applications that fail objective criteria are kept in administrative audit records and may be reconsidered or re-evaluated upon request.'
  });

  await recordAndSendEmail({
    userId: user.id,
    recipientEmail: user.email,
    subject: `MentorConnect — Mentor Application Update: Eligibility Notice`,
    html,
    plainMessage: `Your ${isPeer ? 'peer' : 'professional'} mentor application could not be approved due to unmet objective criteria: ${failedCriteria.map(c => c.message).join('; ')}.`,
    title: 'Mentor Application Auto-Rejected',
    referenceId: application.id,
    referenceType: 'MENTOR_APPLICATION',
    eventType: 'GENERAL'
  });
};

/**
 * EVENT 14: Mentor Application Eligible (Pre-Screening Passed)
 * Dispatched to Applicant
 */
const notifyMentorApplicationEligible = async ({ user, application, isPeer = false }) => {
  if (!user || !user.email) return;

  const kolkataDate = emailService.formatKolkataDateTime(application.submittedAt || new Date());
  const actionUrl = isPeer ? `${CLIENT_URL}/student/dashboard` : `${CLIENT_URL}/mentor/dashboard`;

  const html = buildHtmlEmail({
    title: 'Mentor Application Pre-Screening Passed',
    badgeText: 'Pre-Screening Passed',
    badgeBg: '#10b981',
    badgeColor: '#ffffff',
    greetingName: user.name,
    introMessage: `Great news! Your ${isPeer ? 'Peer' : 'Professional'} Mentor application has successfully satisfied all preliminary eligibility criteria and has been forwarded to the administrative review team for final approval.`,
    tableRows: [
      { label: 'Applicant Name', value: user.name },
      { label: 'Category', value: isPeer ? 'Peer Mentor' : 'Professional Mentor' },
      { label: 'Screening Date', value: kolkataDate },
      { label: 'Queue Status', value: 'Ready for Final Admin Approval', bold: true }
    ],
    calloutBox: {
      bg: '#f0fdf4',
      border: '#22c55e',
      color: '#166534',
      title: 'What Happens Next?',
      content: 'An administrator will review your verified profile. You will receive an immediate notification as soon as your mentor profile is activated.'
    },
    actionButton: {
      text: 'View Application Status',
      url: actionUrl,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: user.id,
    recipientEmail: user.email,
    subject: `MentorConnect — Mentor Application Pre-Screening Passed`,
    html,
    plainMessage: `Your mentor application has passed pre-screening and is in the queue for final admin approval.`,
    title: 'Mentor Application Pre-Screening Passed',
    referenceId: application.id,
    referenceType: 'MENTOR_APPLICATION',
    eventType: 'GENERAL'
  });
};

/**
 * EVENT 15: Mentor Application Reopened / Reconsidered
 * Dispatched to Applicant
 */
const notifyMentorApplicationReconsidered = async ({ user, application, isPeer = false, adminNotes = '' }) => {
  if (!user || !user.email) return;

  const html = buildHtmlEmail({
    title: 'Mentor Application Under Reconsideration',
    badgeText: 'Reopened for Review',
    badgeBg: '#3b82f6',
    badgeColor: '#ffffff',
    greetingName: user.name,
    introMessage: `An administrator has reopened your ${isPeer ? 'Peer' : 'Professional'} Mentor application for reconsideration and detailed manual review.`,
    tableRows: [
      { label: 'Applicant Name', value: user.name },
      { label: 'Application Status', value: 'Under Manual Administrative Review', bold: true },
      { label: 'Admin Note', value: adminNotes || 'Reopened for review by system administrator.' }
    ],
    actionButton: {
      text: 'Check Application Workspace',
      url: `${CLIENT_URL}/mentor/application`,
      bg: '#2563eb'
    }
  });

  await recordAndSendEmail({
    userId: user.id,
    recipientEmail: user.email,
    subject: `MentorConnect — Application Reopened for Reconsideration`,
    html,
    plainMessage: `Your mentor application has been reopened for manual review by an administrator.`,
    title: 'Mentor Application Reopened',
    referenceId: application.id,
    referenceType: 'MENTOR_APPLICATION',
    eventType: 'GENERAL'
  });
};

module.exports = {
  buildHtmlEmail,
  recordAndSendEmail,
  getVerifiedGuardianForMinor,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyMentorBookingConfirmed,
  notifyStudentCancellation,
  notifyMentorCancellation,
  notifyRefundRequested,
  notifyRefundInitiated,
  notifyRefundProcessed,
  notifyRefundFailed,
  notifyRefundRejected,
  notifyComplaintRefundDecision,
  notifyMentorPayoutProcessed,
  notifyMentorApplicationAutoRejected,
  notifyMentorApplicationEligible,
  notifyMentorApplicationReconsidered
};
