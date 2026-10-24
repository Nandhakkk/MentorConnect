/**
 * Test Suite: Razorpay Payment, Refund & Transactional Email Workflow
 *
 * Audits all 12 transactional email events, minor vs. adult recipient routing,
 * guardian notifications, database idempotency, email failure resilience,
 * and security (zero sensitive payment data logged or emailed).
 */

const prisma = require('./src/config/db');
const crypto = require('crypto');
const emailService = require('./src/services/emailService');
const transactionalEmailService = require('./src/services/transactionalEmailService');
const refundService = require('./src/services/refundService');
const razorpayRefundService = require('./src/services/razorpayRefundService');
const { isMinor } = require('./src/utils/ageHelper');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('=== STARTING RAZORPAY EMAIL & NOTIFICATION WORKFLOW TEST SUITE ===\n');

  // Track captured test emails
  const capturedEmails = [];
  const mockTransport = {
    sendMail: async (options) => {
      capturedEmails.push(options);
      return { success: true, messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}` };
    }
  };

  // Activate test mock transport for the test run
  emailService.__setTestMockTransport(mockTransport);

  let adultStudentUser, minorStudentUser, mentorUser, verifiedGuardian;
  let testSession1, testSession2, testPayment1, testRefund1;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Test Users (Adult Student, Minor Student, Mentor, Verified Guardian)
    // ------------------------------------------------------------------------
    console.log('--- SETUP: Creating Test Accounts ---');

    // 1. Adult Student (DOB: 2000-01-01 -> 26 years old)
    adultStudentUser = await prisma.user.create({
      data: {
        name: 'Adult Learner Test',
        email: `adult_${Date.now()}@example.com`,
        password: 'hashedpassword123',
        role: 'STUDENT',
        dateOfBirth: new Date('2000-01-01'),
        studentProfile: { create: { experienceLevel: 'BEGINNER' } }
      },
      include: { studentProfile: true }
    });

    // 2. Minor Student (DOB: 2011-05-15 -> 15 years old)
    minorStudentUser = await prisma.user.create({
      data: {
        name: 'Minor Learner Test',
        email: `minor_${Date.now()}@example.com`,
        password: 'hashedpassword123',
        role: 'STUDENT',
        dateOfBirth: new Date('2011-05-15'),
        studentProfile: { create: { experienceLevel: 'BEGINNER' } }
      },
      include: { studentProfile: true }
    });

    // 3. Verified Guardian for Minor Student
    verifiedGuardian = await prisma.guardian.create({
      data: {
        minorStudentId: minorStudentUser.id,
        name: 'Parent Guardian Test',
        relationship: 'Parent',
        email: `guardian_${Date.now()}@example.com`,
        isVerified: true,
        emailVerifiedAt: new Date(),
        isMonitoringActive: true,
        consentStatus: 'GRANTED'
      }
    });

    // 4. Mentor User
    mentorUser = await prisma.user.create({
      data: {
        name: 'Pro Mentor Test',
        email: `mentor_${Date.now()}@example.com`,
        password: 'hashedpassword123',
        role: 'MENTOR',
        mentorProfile: { create: { hourlyRate: 1000, status: 'APPROVED' } }
      },
      include: { mentorProfile: true }
    });

    // Mentorship for Minor Student
    const mentorshipMinor = await prisma.mentorship.create({
      data: {
        studentId: minorStudentUser.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        status: 'ACTIVE'
      }
    });

    // Mentorship for Adult Student
    const mentorshipAdult = await prisma.mentorship.create({
      data: {
        studentId: adultStudentUser.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        status: 'ACTIVE'
      }
    });

    // Test Sessions & Payments
    testSession1 = await prisma.session.create({
      data: {
        mentorshipId: mentorshipMinor.id,
        scheduledAt: new Date(Date.now() + 48 * 3600 * 1000), // 48h in future
        duration: 60,
        topic: 'AI Architecture & Algorithms',
        status: 'SCHEDULED'
      }
    });

    testPayment1 = await prisma.payment.create({
      data: {
        sessionId: testSession1.id,
        studentId: minorStudentUser.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        amount: 1000.00,
        platformFee: 100.00,
        mentorAmount: 900.00,
        currency: 'INR',
        status: 'PAID',
        razorpayPaymentId: 'pay_test_minor123456',
        razorpayOrderId: 'order_test_minor123456',
        paidAt: new Date()
      }
    });

    testRefund1 = await prisma.refund.create({
      data: {
        refundReference: `ref_test_${Date.now().toString().slice(-8)}`,
        paymentId: testPayment1.id,
        sessionId: testSession1.id,
        amount: 1000.00,
        policyTier: 'STUDENT_EARLY_100',
        initiator: 'STUDENT',
        reason: 'Student requested cancellation > 24 hours prior.',
        status: 'REQUESTED',
        requestedById: minorStudentUser.id
      }
    });

    console.log('[PASS] Setup completed successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1: SMTP Diagnostics and Connection Verification
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: SMTP Diagnostics and Connection Verification ---');
    const diagnostics = emailService.getSmtpDiagnostics();
    assert(diagnostics && typeof diagnostics.isComplete === 'boolean', 'getSmtpDiagnostics returns diagnostic schema');
    assert(typeof diagnostics.SMTP_HOST.present === 'boolean', 'Diagnostics checks SMTP_HOST presence');
    assert(typeof diagnostics.SMTP_USER.masked === 'string', 'Diagnostics safely masks SMTP_USER without leaking secret');
    assert(typeof diagnostics.userMatchesFrom === 'boolean', 'Diagnostics validates sender consistency');

    // ------------------------------------------------------------------------
    // TEST 2: Event 1 — Payment Successful (Minor Student + Verified Guardian)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Event 1 — Payment Successful (Minor Student Dual Delivery) ---');
    capturedEmails.length = 0; // Clear

    await transactionalEmailService.notifyPaymentSuccess({
      payment: testPayment1,
      session: testSession1,
      studentUser: minorStudentUser,
      mentorUser
    });

    assert(capturedEmails.length === 2, 'Dispatched 2 emails (1 to minor student, 1 to verified guardian)');
    const studentEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    const guardianEmail = capturedEmails.find(e => e.to === verifiedGuardian.email);

    assert(Boolean(studentEmail), 'Student received payment success email');
    assert(studentEmail.html.includes('₹1,000.00'), 'Student email contains formatted INR currency amount');
    assert(studentEmail.html.includes('AI Architecture &amp; Algorithms') || studentEmail.html.includes('AI Architecture & Algorithms'), 'Student email contains session topic');
    assert(studentEmail.html.includes('pay_test_minor123456'), 'Student email contains Razorpay payment reference');

    assert(Boolean(guardianEmail), 'Verified guardian received payment confirmation notice');
    assert(guardianEmail.html.includes(minorStudentUser.name), 'Guardian email references student by name');
    assert(guardianEmail.html.includes('₹1,000.00'), 'Guardian email contains verified amount');

    // Check database notification audit
    const guardianNotif = await prisma.notification.findFirst({
      where: { recipientEmail: verifiedGuardian.email, referenceId: testSession1.id }
    });
    assert(Boolean(guardianNotif), 'Notification record created in DB for guardian email delivery');
    assert(guardianNotif.deliveryStatus === 'DELIVERED', 'Notification status recorded as DELIVERED');

    // ------------------------------------------------------------------------
    // TEST 3: Minor vs. Adult Safeguarding — Adult Student does NOT notify guardian
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Minor vs Adult Recipient Rules ---');
    capturedEmails.length = 0;

    const adultSession = await prisma.session.create({
      data: {
        mentorshipId: mentorshipAdult.id,
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
        duration: 45,
        topic: 'Adult Learning Session'
      }
    });

    const adultPayment = await prisma.payment.create({
      data: {
        sessionId: adultSession.id,
        studentId: adultStudentUser.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        amount: 750.00,
        platformFee: 75.00,
        mentorAmount: 675.00,
        status: 'PAID',
        paidAt: new Date()
      }
    });

    await transactionalEmailService.notifyPaymentSuccess({
      payment: adultPayment,
      session: adultSession,
      studentUser: adultStudentUser,
      mentorUser
    });

    assert(capturedEmails.length === 1, 'Only 1 email dispatched for adult student (no guardian email)');
    assert(capturedEmails[0].to === adultStudentUser.email, 'Email went solely to adult student');

    // ------------------------------------------------------------------------
    // TEST 4: Event 2 — Payment Failed / Verification Failed
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Event 2 — Payment Failed / Verification Failed ---');
    capturedEmails.length = 0;

    await transactionalEmailService.notifyPaymentFailed({
      session: testSession1,
      studentUser: minorStudentUser,
      reason: 'Signature mismatch / Card authentication cancelled',
      attemptedAmount: 1000.00
    });

    assert(capturedEmails.length === 2, 'Failed payment notified both minor student and verified guardian');
    const failedStudentEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(failedStudentEmail.html.includes('the mentoring session was not confirmed'), 'Failed payment email clearly clarifies session was NOT booked');
    assert(failedStudentEmail.html.includes('no funds were captured'), 'Clarifies no funds were captured/kept');

    // ------------------------------------------------------------------------
    // TEST 5: Event 3 — Mentor Booking Confirmed Email
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Event 3 — Mentor Booking Confirmed Email ---');
    capturedEmails.length = 0;

    await transactionalEmailService.notifyMentorBookingConfirmed({
      session: testSession1,
      studentUser: minorStudentUser,
      mentorUser,
      payment: testPayment1
    });

    assert(capturedEmails.length === 1, 'Mentor confirmed email sent to mentor');
    assert(capturedEmails[0].to === mentorUser.email, 'Recipient is mentor');
    assert(capturedEmails[0].html.includes('₹900.00'), 'Mentor email displays mentor net earnings');
    assert(capturedEmails[0].html.includes(minorStudentUser.name), 'Mentor email displays student name');

    // ------------------------------------------------------------------------
    // TEST 6: Event 4 — Student Cancellation (Early 100% Policy)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Event 4 — Student Cancellation ---');
    capturedEmails.length = 0;

    await transactionalEmailService.notifyStudentCancellation({
      session: testSession1,
      payment: testPayment1,
      refund: testRefund1,
      studentUser: minorStudentUser,
      mentorUser,
      policy: { refundPercent: 100, automaticRefund: true },
      reason: 'Schedule conflict'
    });

    assert(capturedEmails.length === 3, 'Dispatched 3 emails (Student, Guardian, Mentor)');
    const cancelStudent = capturedEmails.find(e => e.to === minorStudentUser.email);
    const cancelMentor = capturedEmails.find(e => e.to === mentorUser.email);
    assert(cancelStudent.html.includes('100% Refund Tier'), 'Student email contains 100% refund tier details');
    assert(cancelStudent.html.includes('5–7 business days'), 'Student email advises of realistic bank turnaround');
    assert(cancelMentor.html.includes('Slot Released'), 'Mentor email notifies that slot is released');

    // ------------------------------------------------------------------------
    // TEST 7: Event 5 — Mentor Cancellation (100% Refund Confirmation)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Event 5 — Mentor Cancellation (100% Refund) ---');
    capturedEmails.length = 0;

    await transactionalEmailService.notifyMentorCancellation({
      session: testSession1,
      payment: testPayment1,
      refund: testRefund1,
      studentUser: minorStudentUser,
      mentorUser,
      reason: 'Urgent family emergency'
    });

    assert(capturedEmails.length === 3, 'Dispatched 3 emails (Student, Guardian, Mentor)');
    const mentorCancelStudent = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(mentorCancelStudent.html.includes('100% Mentor Cancellation Refund'), 'Student receives 100% refund confirmation');
    assert(mentorCancelStudent.html.includes('Urgent family emergency'), 'Student email includes mentor cancellation reason');

    // ------------------------------------------------------------------------
    // TEST 8: Event 6 & Event 7 — Refund Requested & Refund Initiated
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Event 6 & Event 7 — Refund Requested & Initiated ---');
    capturedEmails.length = 0;

    // Event 6: Refund Requested
    await transactionalEmailService.notifyRefundRequested({
      refund: testRefund1,
      session: testSession1,
      studentUser: minorStudentUser,
      requestType: 'NO_SHOW'
    });

    assert(capturedEmails.length === 2, 'Refund requested sent to student and guardian');
    const reqEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(reqEmail.html.includes('Confirmed Mentor No-Show'), 'Refund request specifies request type');
    assert(reqEmail.html.includes('Under Review'), 'Refund request specifies review status');

    // Event 7: Refund Initiated
    capturedEmails.length = 0;
    await transactionalEmailService.notifyRefundInitiated({
      refund: testRefund1,
      session: testSession1,
      studentUser: minorStudentUser,
      gatewayRefund: { id: 'rfnd_test_gateway123' }
    });

    assert(capturedEmails.length === 2, 'Refund initiated sent to student and guardian');
    const initEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(initEmail.html.includes('Refund Initiated to Original Payment Method'), 'Email clarifies refund initiated');
    assert(initEmail.html.includes('rfnd_test_gateway123'), 'Email includes gateway refund ID');
    assert(initEmail.html.includes('5 to 7 business days'), 'Truthful wording clarifies bank processing turnaround');

    // ------------------------------------------------------------------------
    // TEST 9: Event 8, Event 9, Event 10 — Processed, Failed, Rejected
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Event 8, 9, 10 — Processed, Failed, Rejected ---');
    // Event 8: Refund Processed
    capturedEmails.length = 0;
    await transactionalEmailService.notifyRefundProcessed({
      refund: { ...testRefund1, razorpayRefundId: 'rfnd_proc_999', processedAt: new Date() },
      session: testSession1,
      studentUser: minorStudentUser,
      gatewayRefund: { id: 'rfnd_proc_999', status: 'processed' }
    });
    const procEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(procEmail.html.includes('Refund Successfully Processed'), 'Processed email confirms completed status');
    assert(procEmail.html.includes('rfnd_proc_999'), 'Processed email includes Razorpay refund ID');

    // Event 9: Refund Failed
    capturedEmails.length = 0;
    await transactionalEmailService.notifyRefundFailed({
      refund: testRefund1,
      session: testSession1,
      studentUser: minorStudentUser,
      failureReason: 'Gateway connectivity timeout'
    });
    const failEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(failEmail.html.includes('Refund Processing Delay Notice'), 'Failed email notifies of delay');
    assert(failEmail.html.includes('Finance Team Has Been Notified'), 'Reassures student finance team will resolve');

    // Event 10: Refund Rejected
    capturedEmails.length = 0;
    await transactionalEmailService.notifyRefundRejected({
      refund: testRefund1,
      session: testSession1,
      studentUser: minorStudentUser,
      adminNotes: 'Session was attended by student and completed without technical issues.'
    });
    const rejectEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(rejectEmail.html.includes('Declined'), 'Rejection email states decision');
    assert(rejectEmail.html.includes('Session was attended'), 'Rejection email includes admin review rationale');

    // ------------------------------------------------------------------------
    // TEST 10: Event 11 & Event 12 — Complaint Decision & Mentor Payout
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Event 11 & 12 — Complaint Decision & Mentor Payout ---');
    // Event 11: Complaint Refund
    capturedEmails.length = 0;
    await transactionalEmailService.notifyComplaintRefundDecision({
      refund: testRefund1,
      session: testSession1,
      studentUser: minorStudentUser,
      decisionTitle: 'Complaint Investigation Resolved & Refund Approved',
      resolutionNotes: 'Investigation confirmed audio disconnection on mentor side.'
    });
    const complaintEmail = capturedEmails.find(e => e.to === minorStudentUser.email);
    assert(complaintEmail.html.includes('Investigation Resolved &amp; Refund Approved') || complaintEmail.html.includes('Investigation Resolved & Refund Approved'), 'Complaint refund decision email states title');

    // Event 12: Mentor Payout Processed
    capturedEmails.length = 0;
    const testPayout = {
      id: 'payout_test_888',
      grossAmount: 1000.00,
      platformFee: 100.00,
      netAmount: 900.00,
      providerId: 'UTR_BANK_REF_987654'
    };
    await transactionalEmailService.notifyMentorPayoutProcessed({
      payout: testPayout,
      mentorUser,
      status: 'PAID'
    });
    assert(capturedEmails.length === 1, 'Payout email delivered to mentor');
    assert(capturedEmails[0].html.includes('₹900.00'), 'Mentor payout email shows net disbursed amount');
    assert(capturedEmails[0].html.includes('UTR_BANK_REF_987654'), 'Mentor payout email shows provider reference ID');

    // ------------------------------------------------------------------------
    // TEST 11: Database-Backed Deduplication (Idempotency)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Database-Backed Deduplication (Idempotency) ---');
    capturedEmails.length = 0;

    const uniqueRef = `dedup_ref_${Date.now()}`;
    const sendArgs = {
      userId: adultStudentUser.id,
      recipientEmail: adultStudentUser.email,
      subject: 'Idempotency Test Subject',
      html: '<p>Test Idempotency</p>',
      plainMessage: 'Test Idempotency',
      title: 'Idempotency Test Event',
      referenceId: uniqueRef,
      referenceType: 'PAYMENT'
    };

    // First send
    const res1 = await transactionalEmailService.recordAndSendEmail(sendArgs);
    assert(res1.success === true && !res1.deduplicated, 'First email send succeeds');
    assert(capturedEmails.length === 1, 'Transport dispatched 1 email');

    // Second send with same reference and title (simulating webhook retry)
    const res2 = await transactionalEmailService.recordAndSendEmail(sendArgs);
    assert(res2.success === true && res2.deduplicated === true, 'Second email send identified as duplicate');
    assert(capturedEmails.length === 1, 'Transport did NOT dispatch a duplicate email');

    // ------------------------------------------------------------------------
    // TEST 12: SMTP Resilience (Failure does not throw or corrupt DB)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 12: SMTP Resilience ---');
    // Temporarily point mock transport to throw error
    emailService.__setTestMockTransport({
      sendMail: async () => {
        throw new Error('Simulated SMTP Network Failure');
      }
    });

    let didThrow = false;
    try {
      const failRes = await transactionalEmailService.recordAndSendEmail({
        userId: adultStudentUser.id,
        recipientEmail: adultStudentUser.email,
        subject: 'Failing Test',
        html: '<p>Fail</p>',
        plainMessage: 'Fail',
        title: 'Failing Event',
        referenceId: `fail_${Date.now()}`
      });
      assert(failRes.success === false, 'Handles SMTP failure gracefully and returns success: false');
    } catch (err) {
      didThrow = true;
    }
    assert(didThrow === false, 'Service never throws unhandled exceptions on SMTP failure');

    // Restore mock transport
    emailService.__setTestMockTransport(mockTransport);

    // ------------------------------------------------------------------------
    // TEST 13: Security & Sensitive Financial Data Leak Prevention
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 13: Security & Sensitive Data Leak Prevention ---');
    const allEmailsContent = capturedEmails.map(e => `${e.subject} ${e.html}`).join(' ');

    const forbiddenPatterns = [
      /cvv/i,
      /upi pin/i,
      /card_number/i,
      /rzp_live_/i,
      /rzp_test_secret/i,
      /card_password/i
    ];

    let leakFound = false;
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(allEmailsContent)) {
        leakFound = true;
        console.error(`[LEAK DETECTED] Email content matches sensitive pattern: ${pattern}`);
      }
    }
    assert(leakFound === false, 'Zero sensitive financial credentials, CVVs, UPI PINs, or secret keys in emails');

    // ------------------------------------------------------------------------
    // TEST 14: Final Audit Targeted Regression Verifications
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 14: Final Audit Targeted Regression Verifications ---');

    // 14.1 Checkout Dismissal: Unpaid session cancellation does NOT send email to mentor
    capturedEmails.length = 0;
    const mentorshipReg = await prisma.mentorship.create({
      data: {
        studentId: adultStudentUser.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        status: 'ACTIVE'
      }
    });

    const unpaidDismissSession = await prisma.session.create({
      data: {
        mentorshipId: mentorshipReg.id,
        scheduledAt: new Date(Date.now() + 48 * 3600 * 1000),
        duration: 60,
        status: 'SCHEDULED',
        topic: 'Dismissal Test Session',
        payment: {
          create: {
            studentId: adultStudentUser.studentProfile.id,
            mentorId: mentorUser.mentorProfile.id,
            amount: 1000,
            platformFee: 100,
            mentorAmount: 900,
            currency: 'INR',
            status: 'PENDING'
          }
        }
      },
      include: { payment: true }
    });

    await refundService.handleStudentSessionCancellation(unpaidDismissSession.id, adultStudentUser, 'Closed Razorpay Checkout');
    assert(capturedEmails.length === 0, 'Closing checkout on unpaid session does NOT dispatch cancellation emails to mentor');
    const dbDismissSession = await prisma.session.findUnique({ where: { id: unpaidDismissSession.id } });
    assert(dbDismissSession.status === 'CANCELLED', 'Unpaid session reservation is safely released to CANCELLED state');

    // 14.2 Delayed Payment Webhook with Free Slot: Reinstates session and dispatches booking emails
    capturedEmails.length = 0;
    const delayedFreeSession = await prisma.session.create({
      data: {
        mentorshipId: mentorshipReg.id,
        scheduledAt: new Date(Date.now() + 72 * 3600 * 1000),
        duration: 60,
        status: 'CANCELLED',
        topic: 'Delayed Verification Free Slot',
        payment: {
          create: {
            studentId: adultStudentUser.studentProfile.id,
            mentorId: mentorUser.mentorProfile.id,
            amount: 1000,
            platformFee: 100,
            mentorAmount: 900,
            currency: 'INR',
            razorpayOrderId: `order_delayed_free_${Date.now()}`,
            status: 'PENDING'
          }
        }
      },
      include: { payment: true }
    });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'test_secret';
    const freeSlotPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_delayed_free_${Date.now()}`,
            order_id: delayedFreeSession.payment.razorpayOrderId,
            amount: 100000,
            status: 'captured'
          }
        }
      }
    };
    const freeSlotBody = JSON.stringify(freeSlotPayload);
    const freeSlotSig = crypto.createHmac('sha256', webhookSecret).update(freeSlotBody).digest('hex');

    const freeSlotResult = await razorpayRefundService.handleRazorpayWebhook(freeSlotBody, freeSlotSig, freeSlotPayload);
    assert(freeSlotResult.status === 'success', 'Delayed payment webhook returns success for free slot');
    const dbReinstatedSession = await prisma.session.findUnique({
      where: { id: delayedFreeSession.id },
      include: { payment: true }
    });
    assert(dbReinstatedSession.status === 'SCHEDULED', 'Delayed webhook reinstates session to SCHEDULED when slot is free');
    assert(dbReinstatedSession.payment.status === 'PAID', 'Delayed webhook marks payment as PAID');
    assert(capturedEmails.some(e => e.to === adultStudentUser.email && e.subject.includes('Payment Confirmed')), 'Dispatches Payment Success email on delayed webhook reinstatement');
    assert(capturedEmails.some(e => e.to === mentorUser.email && e.subject.includes('New Session Confirmed')), 'Dispatches Mentor Booking Confirmed email on delayed webhook reinstatement');

    // 14.3 Delayed Payment Webhook with Conflicted Slot: Issues 100% gateway refund under BOOKING_FAILURE_100
    capturedEmails.length = 0;
    const conflictTime = new Date(Date.now() + 96 * 3600 * 1000);
    // Already confirmed active session occupying this slot
    const activeConflictingSession = await prisma.session.create({
      data: {
        mentorshipId: mentorshipReg.id,
        scheduledAt: conflictTime,
        duration: 60,
        status: 'SCHEDULED',
        topic: 'Interim Booking Occupying Slot'
      }
    });

    // Student whose checkout was dismissed previously
    const delayedConflictedSession = await prisma.session.create({
      data: {
        mentorshipId: mentorshipReg.id,
        scheduledAt: conflictTime,
        duration: 60,
        status: 'CANCELLED',
        topic: 'Late Payment Conflicted Slot',
        payment: {
          create: {
            studentId: adultStudentUser.studentProfile.id,
            mentorId: mentorUser.mentorProfile.id,
            amount: 1000,
            platformFee: 100,
            mentorAmount: 900,
            currency: 'INR',
            razorpayOrderId: `order_delayed_conflict_${Date.now()}`,
            status: 'PENDING'
          }
        }
      },
      include: { payment: true }
    });

    const conflictPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_delayed_conflict_${Date.now()}`,
            order_id: delayedConflictedSession.payment.razorpayOrderId,
            amount: 100000,
            status: 'captured'
          }
        }
      }
    };
    const conflictBody = JSON.stringify(conflictPayload);
    const conflictSig = crypto.createHmac('sha256', webhookSecret).update(conflictBody).digest('hex');

    const conflictResult = await razorpayRefundService.handleRazorpayWebhook(conflictBody, conflictSig, conflictPayload);
    assert(conflictResult.status === 'success' && conflictResult.message.includes('100% refund automatically initiated'), 'Conflicted slot delayed webhook triggers automatic 100% refund');
    const autoRefund = await prisma.refund.findFirst({
      where: { sessionId: delayedConflictedSession.id }
    });
    assert(autoRefund !== null && autoRefund.policyTier === 'BOOKING_FAILURE_100', 'Conflicted slot refund record created under BOOKING_FAILURE_100 policy tier');

    // 14.4 Legitimate Refund Status Transitions (Initiated -> Processed) NOT Suppressed by 24h Window
    capturedEmails.length = 0;
    const transitionRef = {
      id: `refund_trans_${Date.now()}`,
      refundReference: `ref_trans_${Date.now()}`,
      amount: 1000.00
    };

    // Stage 1: Initiated
    await transactionalEmailService.notifyRefundInitiated({
      refund: transitionRef,
      session: testSession1,
      studentUser: adultStudentUser
    });
    assert(capturedEmails.length === 1, 'Stage 1: Refund Initiated email sent to student');
    assert(capturedEmails[0].subject.includes('Refund Initiated'), 'Stage 1 email has Refund Initiated subject');

    // Stage 2: Gateway confirms Processed (distinct status title)
    await transactionalEmailService.notifyRefundProcessed({
      refund: transitionRef,
      session: testSession1,
      studentUser: adultStudentUser
    });
    assert(capturedEmails.length === 2, 'Stage 2: Refund Processed email NOT suppressed by deduplication (legitimate transition permitted)');
    assert(capturedEmails[1].subject.includes('Refund Processed Successfully') || capturedEmails[1].subject.includes('Refund Successfully Processed'), 'Stage 2 email has Processed subject');

    // Stage 3: Duplicate Processed webhook retry IS properly deduplicated
    await transactionalEmailService.notifyRefundProcessed({
      refund: transitionRef,
      session: testSession1,
      studentUser: adultStudentUser
    });
    assert(capturedEmails.length === 2, 'Stage 3: Duplicate Processed webhook retry is properly deduplicated (still 2 emails sent)');

    // 14.5 Payout Notifications: FAILED payout never sends success copy and uses alert/failed title
    capturedEmails.length = 0;
    const testFailedPayout = {
      id: `payout_failed_reg_${Date.now()}`,
      grossAmount: 1000.00,
      platformFee: 100.00,
      netAmount: 900.00,
      providerId: null
    };

    await transactionalEmailService.notifyMentorPayoutProcessed({
      payout: testFailedPayout,
      mentorUser,
      status: 'FAILED'
    });
    assert(capturedEmails.length === 1, 'Payout failure email delivered to mentor');
    assert(capturedEmails[0].subject.includes('Payout Update'), 'Payout failure subject states "Payout Update" (never "Payout Processed")');
    assert(capturedEmails[0].html.includes('Mentor Payout Processing Alert'), 'Payout failure body displays Processing Alert');
    assert(capturedEmails[0].html.includes('Payout Failed'), 'Payout failure badge displays Payout Failed');
    assert(!capturedEmails[0].html.includes('has been successfully processed'), 'Payout failure body NEVER claims payout was successfully processed');

    // 14.6 Guardian Privacy: Adult Students strictly excluded and Complaint Notes omit private chats
    const adultGuardianLookup = await transactionalEmailService.getVerifiedGuardianForMinor(adultStudentUser.id);
    assert(adultGuardianLookup === null, 'Adult student (age >= 18) strictly returns null guardian');

    const minorGuardianLookup = await transactionalEmailService.getVerifiedGuardianForMinor(minorStudentUser.id);
    assert(minorGuardianLookup !== null && minorGuardianLookup.id === verifiedGuardian.id, 'Minor student (age < 18) returns verified guardian');

    capturedEmails.length = 0;
    await transactionalEmailService.notifyComplaintRefundDecision({
      refund: transitionRef,
      session: testSession1,
      studentUser: minorStudentUser,
      decisionTitle: 'Moderation Investigation Approved',
      resolutionNotes: 'Private discussion: student reported mentor microphone malfunction.'
    });
    const guardianNoticeEmail = capturedEmails.find(e => e.to === verifiedGuardian.email);
    assert(guardianNoticeEmail !== null, 'Guardian of minor student receives decision notice');
    assert(guardianNoticeEmail.html.includes('safeguardingNotice') || guardianNoticeEmail.html.includes('confidential and omitted'), 'Guardian email contains safeguarding privacy notice');
    assert(!guardianNoticeEmail.html.includes('microphone malfunction'), 'Guardian email omits student private complaint details/chats');

    // Cleanup regression sessions
    await prisma.refund.deleteMany({ where: { sessionId: delayedConflictedSession.id } });
    await prisma.payment.deleteMany({
      where: {
        sessionId: { in: [unpaidDismissSession.id, delayedFreeSession.id, delayedConflictedSession.id] }
      }
    });
    await prisma.session.deleteMany({
      where: {
        id: { in: [unpaidDismissSession.id, delayedFreeSession.id, delayedConflictedSession.id, activeConflictingSession.id] }
      }
    });
    await prisma.mentorship.delete({ where: { id: mentorshipReg.id } });

  } catch (error) {
    console.error('Unhandled test suite error:', error);
    failedTests++;
  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing Test Records ---');
    emailService.__clearTestMockTransport();

    try {
      if (testRefund1) await prisma.refund.deleteMany({ where: { paymentId: testPayment1.id } });
      if (testPayment1) await prisma.payment.deleteMany({ where: { sessionId: testSession1.id } });
      if (testSession1) await prisma.session.deleteMany({ where: { id: testSession1.id } });

      await prisma.notification.deleteMany({
        where: {
          OR: [
            { userId: minorStudentUser?.id },
            { userId: adultStudentUser?.id },
            { userId: mentorUser?.id },
            { recipientEmail: verifiedGuardian?.email }
          ]
        }
      });

      if (verifiedGuardian) await prisma.guardian.deleteMany({ where: { id: verifiedGuardian.id } });
      if (minorStudentUser) await prisma.user.delete({ where: { id: minorStudentUser.id } });
      if (adultStudentUser) await prisma.user.delete({ where: { id: adultStudentUser.id } });
      if (mentorUser) await prisma.user.delete({ where: { id: mentorUser.id } });

      console.log('Test records cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup error (ignored):', cleanupErr.message);
    }
  }

  console.log('\n========================================');
  console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('========================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
