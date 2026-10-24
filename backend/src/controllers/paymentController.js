const prisma = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');
const guardianService = require('../services/guardianService');
const emailService = require('../services/emailService');
const transactionalEmailService = require('../services/transactionalEmailService');

const cleanEnvVal = (val) => {
  if (!val) return '';
  let str = val.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

const getRazorpayInstance = () => {
  const key_id = cleanEnvVal(process.env.RAZORPAY_KEY_ID);
  const key_secret = cleanEnvVal(process.env.RAZORPAY_KEY_SECRET);

  if (!key_id || !key_secret) {
    const error = new Error('Razorpay credentials are not configured.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return new Razorpay({
    key_id,
    key_secret,
  });
};

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order for an existing Payment record
 */
const createRazorpayOrder = async (req, res) => {
  const { sessionId } = req.body;
  let session = null;

  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Unauthorized. Only students can create payment orders.' });
    }

    if (!sessionId) {
      return res.status(400).json({ status: 'error', message: 'Session ID is required.' });
    }

    // Defensive lookup for student profile if not preloaded on req.user
    let studentProfile = req.user.studentProfile;
    if (!studentProfile) {
      studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: req.user.id }
      });
    }
    if (!studentProfile && req.user.role === 'STUDENT') {
      studentProfile = await prisma.studentProfile.create({
        data: { userId: req.user.id }
      });
    }
    if (!studentProfile) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found. Please complete your profile.' });
    }

    // Find the session and verify it belongs to the student
    session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: { include: { mentor: { include: { user: true } } } },
        payment: true
      }
    });

    if (!session || session.mentorship?.studentId !== studentProfile.id) {
      return res.status(404).json({ status: 'error', message: 'Session not found or does not belong to this student.' });
    }

    if (!session.payment) {
      return res.status(400).json({ status: 'error', message: 'Payment record missing for this session.' });
    }

    if (session.status === 'CANCELLED') {
      return res.status(400).json({ status: 'error', message: 'Cannot create payment order for a cancelled session.' });
    }

    if (session.payment.status === 'PAID') {
      return res.status(400).json({ status: 'error', message: 'Session is already paid.' });
    }

    // Currency check
    const currency = (session.payment.currency || 'INR').toUpperCase();
    if (currency !== 'INR') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid currency. Only INR is supported for Razorpay payments.',
        details: `Configured payment currency is ${session.payment.currency}`
      });
    }

    // Convert amount to paise (multiply by 100) and validate positive integer
    const amountInPaise = Math.round(session.payment.amount * 100);
    if (typeof amountInPaise !== 'number' || isNaN(amountInPaise) || !Number.isInteger(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment amount. Amount must be a positive integer in paise.',
        details: `Calculated amount in paise: ${amountInPaise}`
      });
    }

    if (amountInPaise < 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment amount too low. Razorpay requires a minimum amount of ₹1.00 (100 paise).',
        details: `Calculated amount is ${amountInPaise} paise`
      });
    }

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${session.id.substring(0, 30)}`,
    };

    let order;
    try {
      const razorpay = getRazorpayInstance();
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      const isConfigMissing = rzpErr.code === 'CONFIG_MISSING';
      const isAuthError = rzpErr.statusCode === 401 ||
        rzpErr?.error?.description?.toLowerCase().includes('authentication failed') ||
        (rzpErr?.error?.code === 'BAD_REQUEST_ERROR' && rzpErr?.error?.description?.toLowerCase().includes('authentication failed'));

      // Safe diagnostic logging (NEVER logs secret keys)
      console.error('[PaymentController] Razorpay order creation failed:', {
        sessionId: session.id,
        amountInPaise,
        statusCode: rzpErr.statusCode || (isConfigMissing ? 503 : 500),
        code: rzpErr?.error?.code || rzpErr.code || 'GATEWAY_ERROR',
        description: rzpErr?.error?.description || rzpErr.message,
        isConfigMissing,
        isAuthError
      });

      // Cleanup failed/orphaned unpaid session so mentor slot isn't blocked
      try {
        if (session && session.payment && session.payment.status === 'CREATED') {
          await prisma.session.delete({ where: { id: session.id } });
        }
      } catch (cleanupErr) {
        console.error('[PaymentController] Failed to cleanup orphaned session:', cleanupErr.message);
      }

      if (isConfigMissing) {
        return res.status(503).json({
          status: 'error',
          message: 'Payment gateway configuration is missing. Razorpay key ID or secret is not configured in backend environment.',
          details: 'Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env'
        });
      }

      if (isAuthError) {
        return res.status(502).json({
          status: 'error',
          message: 'Payment gateway authentication failed. Please verify your Razorpay API key ID and secret in backend configuration.',
          details: rzpErr?.error?.description || 'Authentication failed with Razorpay API'
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Failed to create order with payment gateway.',
        details: rzpErr?.error?.description || rzpErr.message || 'Razorpay order creation failed'
      });
    }

    // Save order id to payment
    try {
      await prisma.payment.update({
        where: { id: session.payment.id },
        data: {
          razorpayOrderId: order.id,
          status: 'PENDING'
        }
      });
    } catch (dbErr) {
      console.error('[PaymentController] Failed to update payment with order ID:', dbErr.message);
      try {
        await prisma.session.delete({ where: { id: session.id } });
      } catch (cleanupErr) {
        console.error('[PaymentController] Cleanup error after DB failure:', cleanupErr.message);
      }
      return res.status(500).json({
        status: 'error',
        message: 'Failed to record payment order in database.',
        details: dbErr.message
      });
    }

    return res.status(200).json({
      status: 'success',
      key: cleanEnvVal(process.env.RAZORPAY_KEY_ID),
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      paymentId: session.payment.id
    });
  } catch (err) {
    console.error('[PaymentController] Unexpected error in createRazorpayOrder:', err);
    try {
      if (sessionId) {
        const sessToCleanup = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { payment: true }
        });
        if (sessToCleanup && sessToCleanup.payment && sessToCleanup.payment.status === 'CREATED') {
          await prisma.session.delete({ where: { id: sessionId } });
        }
      }
    } catch (cleanupErr) {
      console.error('[PaymentController] Failed to cleanup orphaned session on unexpected error:', cleanupErr.message);
    }

    return res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to create order',
      details: err.message || 'Internal server error during order creation'
    });
  }
};

/**
 * POST /api/payments/verify
 * Verifies Razorpay signature
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, sessionId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !sessionId) {
      return res.status(400).json({ status: 'error', message: 'Missing parameters' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        payment: true,
        mentorship: {
          include: {
            mentor: { include: { user: true } },
            student: { include: { user: true } }
          }
        }
      }
    });

    if (!session || !session.payment) {
      return res.status(404).json({ status: 'error', message: 'Session or payment not found' });
    }

    // Verify signature
    const secret = cleanEnvVal(process.env.RAZORPAY_KEY_SECRET);
    if (!secret) {
      return res.status(500).json({ status: 'error', message: 'Payment gateway configuration is missing.' });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Dispatches Payment Failed notification without confirming session (Event 2)
      const studentUser = session.mentorship?.student?.user;
      if (studentUser) {
        transactionalEmailService.notifyPaymentFailed({
          session,
          studentUser,
          reason: 'Payment signature verification mismatch. No session was booked.',
          attemptedAmount: session.payment.amount
        }).catch(e => console.error('[PaymentController] Payment failed email error:', e.message));
      }

      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    if (session.status === 'CANCELLED') {
      // Check if slot was booked by another confirmed session in the interim
      const mentorId = session.mentorship?.mentorId;
      const conflict = mentorId ? await prisma.session.findFirst({
        where: {
          id: { not: session.id },
          mentorship: { mentorId },
          scheduledAt: session.scheduledAt,
          status: 'SCHEDULED'
        }
      }) : null;

      if (conflict) {
        // Slot is already taken. Money was captured by gateway, so protect student with automatic 100% refund
        const refundRecord = await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: session.payment.id },
            data: {
              razorpayPaymentId: razorpay_payment_id,
              razorpaySignature: razorpay_signature,
              status: 'PAID',
              paidAt: new Date()
            }
          });

          return await tx.refund.create({
            data: {
              refundReference: `ref_${crypto.randomBytes(8).toString('hex')}`,
              paymentId: session.payment.id,
              sessionId: session.id,
              amount: session.payment.amount,
              policyTier: 'BOOKING_FAILURE_100',
              initiator: 'SYSTEM',
              reason: 'Automatic 100% refund: session slot rebooked before delayed payment verification arrived.',
              status: 'REQUESTED'
            }
          });
        });

        const razorpayRefundService = require('../services/razorpayRefundService');
        await razorpayRefundService.executeGatewayRefund(refundRecord.id).catch(e => console.error(e));

        return res.status(409).json({
          status: 'error',
          code: 'SLOT_EXPIRED_REFUNDED',
          message: 'Session slot expired before verification arrived. A 100% refund has been automatically initiated to your original payment method.',
          refundReference: refundRecord.refundReference
        });
      }
      // If no conflict, slot is still free: fall through to confirm as SCHEDULED and PAID
    }

    if (session.payment.razorpayOrderId && session.payment.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ status: 'error', message: 'Razorpay order ID does not match this session.' });
    }

    if (session.payment.status === 'PAID') {
       return res.status(200).json({ status: 'success', message: 'Already paid' });
    }

    // Generate unique Jitsi room name if not exists
    const meetingLink = session.meetingLink || `mentorconnect-session-${crypto.randomBytes(8).toString('hex')}`;

    // Mark as PAID
    const [updatedPayment, updatedSession] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: session.payment.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: 'PAID',
          paidAt: new Date()
        }
      }),
      // Confirmed state
      prisma.session.update({
        where: { id: session.id },
        data: { 
          status: 'SCHEDULED',
          meetingLink: meetingLink
        },
        include: {
          mentorship: {
            include: {
              mentor: { include: { user: true } },
              student: { include: { user: true } }
            }
          }
        }
      })
    ]);

    // Send Notifications & Real Transactional Emails
    const studentUser = updatedSession.mentorship?.student?.user;
    const mentorUser = updatedSession.mentorship?.mentor?.user;
    const scheduledTime = new Date(updatedSession.scheduledAt).toLocaleString();
    
    // In-app notifications check to prevent duplicates
    const existingNotifications = await prisma.notification.findFirst({
      where: { referenceId: session.id, type: 'PAYMENT', channel: 'IN_APP' }
    });

    if (!existingNotifications) {
      // In-App: Notify Learner
      await notificationService.createNotification(
        updatedSession.mentorship.student.userId,
        'PAYMENT',
        'Session Booked',
        `Your mentoring session with ${mentorUser?.name} is confirmed for ${scheduledTime}.`,
        session.id,
        'SESSION'
      ).catch(e => console.error(e));

      // In-App: Notify Mentor
      await notificationService.createNotification(
        updatedSession.mentorship.mentor.userId,
        'PAYMENT',
        'New Session Booked',
        `A mentoring session with ${studentUser?.name} is confirmed for ${scheduledTime}.`,
        session.id,
        'SESSION'
      ).catch(e => console.error(e));
    }

    // MANDATORY TRANSACTIONAL EMAILS:
    // Event 1: Payment Successful (Student + Guardian if minor)
    await transactionalEmailService.notifyPaymentSuccess({
      payment: updatedPayment,
      session: updatedSession,
      studentUser,
      mentorUser
    }).catch(err => console.error('[PaymentController] Payment success email dispatch error:', err.message));

    // Event 3: Session Booking Confirmed (Mentor)
    await transactionalEmailService.notifyMentorBookingConfirmed({
      session: updatedSession,
      studentUser,
      mentorUser,
      payment: updatedPayment
    }).catch(err => console.error('[PaymentController] Mentor booking confirmed email dispatch error:', err.message));

    return res.status(200).json({ status: 'success', message: 'Payment verified and session scheduled' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Verification failed', details: err.message });
  }
};

module.exports = { createRazorpayOrder, verifyPayment };
