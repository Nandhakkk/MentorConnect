const prisma = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order for an existing Payment record
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (req.user.role !== 'STUDENT') return res.status(403).json({ status: 'error', message: 'Unauthorized' });

    const studentProfile = req.user.studentProfile;
    if (!sessionId) return res.status(400).json({ status: 'error', message: 'Session ID required' });

    // Find the session and verify it belongs to the student
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: { include: { mentor: { include: { user: true } } } },
        payment: true
      }
    });

    if (!session || session.mentorship.studentId !== studentProfile.id) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    if (session.payment?.status === 'PAID') {
      return res.status(400).json({ status: 'error', message: 'Session is already paid.' });
    }

    if (!session.payment) {
      return res.status(400).json({ status: 'error', message: 'Payment record missing.' });
    }

    // Convert amount to paise (multiply by 100)
    const amountInPaise = Math.round(session.payment.amount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${session.id.substring(0, 30)}`,
    };

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create(options);

    // Save order id to payment
    await prisma.payment.update({
      where: { id: session.payment.id },
      data: {
        razorpayOrderId: order.id,
        status: 'PENDING'
      }
    });

    return res.status(200).json({
      status: 'success',
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: amountInPaise,
      currency: "INR",
      paymentId: session.payment.id
    });
  } catch (err) {
    try {
      if (req.body.sessionId) {
        const sessToCleanup = await prisma.session.findUnique({
          where: { id: req.body.sessionId },
          include: { payment: true }
        });
        if (sessToCleanup && sessToCleanup.payment && sessToCleanup.payment.status === 'CREATED') {
          await prisma.session.delete({ where: { id: req.body.sessionId } });
        }
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup orphaned session:', cleanupErr);
    }
    
    console.error('Razorpay Error:', err?.error || err);
    return res.status(500).json({ status: 'error', message: 'Failed to create order', details: err.message || 'Razorpay order creation failed' });
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
      include: { payment: true }
    });

    if (!session || !session.payment) {
      return res.status(404).json({ status: 'error', message: 'Session or payment not found' });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
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
      // Assuming SCHEDULED is the confirmed state
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

    // Send Notifications
    const scheduledTime = new Date(updatedSession.scheduledAt).toLocaleString();
    
    // Check if notification already exists to prevent duplicate (in case of retry)
    const existingNotifications = await prisma.notification.findFirst({
      where: { referenceId: session.id, type: 'PAYMENT' }
    });

    if (!existingNotifications) {
      // Notify Learner
      await notificationService.createNotification(
        updatedSession.mentorship.student.userId,
        'PAYMENT',
        'Session Booked',
        `Your mentoring session with ${updatedSession.mentorship.mentor.user.name} is confirmed for ${scheduledTime}.`,
        session.id,
        'SESSION'
      );

      // Notify Mentor
      await notificationService.createNotification(
        updatedSession.mentorship.mentor.userId,
        'PAYMENT',
        'New Session Booked',
        `A mentoring session with ${updatedSession.mentorship.student.user.name} is confirmed for ${scheduledTime}.`,
        session.id,
        'SESSION'
      );
    }

    return res.status(200).json({ status: 'success', message: 'Payment verified and session scheduled' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Verification failed', details: err.message });
  }
};

module.exports = { createRazorpayOrder, verifyPayment };
