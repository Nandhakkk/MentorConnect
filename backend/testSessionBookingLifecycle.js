const prisma = require('./src/config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { cleanupAbandonedSessions } = require('./src/services/schedulerService');

const API_BASE = 'http://localhost:5000/api';

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

async function runBookingLifecycleTestSuite() {
  console.log('=== STARTING SESSION BOOKING LIFECYCLE & PAYMENT CONFIRMATION TEST SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(title, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} - Details: ${details}`);
      failed++;
    }
  }

  const suffix = crypto.randomBytes(4).toString('hex');

  // Setup Student 1, Student 2, and Mentor
  const studentUser1 = await prisma.user.create({
    data: {
      name: `Student 1 ${suffix}`,
      email: `student1_${suffix}@test.com`,
      password: 'password123',
      role: 'STUDENT',
      studentProfile: { create: {} }
    },
    include: { studentProfile: true }
  });

  const studentUser2 = await prisma.user.create({
    data: {
      name: `Student 2 ${suffix}`,
      email: `student2_${suffix}@test.com`,
      password: 'password123',
      role: 'STUDENT',
      studentProfile: { create: {} }
    },
    include: { studentProfile: true }
  });

  const mentorUser = await prisma.user.create({
    data: {
      name: `Mentor ${suffix}`,
      email: `mentor_${suffix}@test.com`,
      password: 'password123',
      role: 'MENTOR',
      mentorProfile: {
        create: {
          status: 'APPROVED',
          mentorType: 'PROFESSIONAL',
          sessionFee: 600,
          isAvailable: true,
          availabilities: {
            create: [
              { dayOfWeek: 'MONDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'TUESDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'WEDNESDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'THURSDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'FRIDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'SATURDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'SUNDAY', startTime: '00:00', endTime: '23:59', isActive: true }
            ]
          }
        }
      }
    },
    include: { mentorProfile: true }
  });

  const mentorship1 = await prisma.mentorship.create({
    data: {
      studentId: studentUser1.studentProfile.id,
      mentorId: mentorUser.mentorProfile.id,
      status: 'ACTIVE'
    }
  });

  const mentorship2 = await prisma.mentorship.create({
    data: {
      studentId: studentUser2.studentProfile.id,
      mentorId: mentorUser.mentorProfile.id,
      status: 'ACTIVE'
    }
  });

  const student1Token = generateToken({ id: studentUser1.id, role: 'STUDENT' });
  const student2Token = generateToken({ id: studentUser2.id, role: 'STUDENT' });
  const mentorToken = generateToken({ id: mentorUser.id, role: 'MENTOR' });

  // Pick a slot tomorrow at 10:00 AM IST
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const targetDate1 = new Date(`${tomorrowStr}T10:00:00+05:30`);
  const targetDate2 = new Date(`${tomorrowStr}T14:00:00+05:30`);
  const targetDate3 = new Date(`${tomorrowStr}T16:00:00+05:30`);

  // =========================================================================
  // TEST 1: Clicking "Continue to Payment" creates temporary session but NOT confirmed
  // =========================================================================
  console.log('\n--- TEST 1: Initiate booking (POST /api/sessions) ---');
  const bookRes1 = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      mentorshipId: mentorship1.id,
      scheduledAt: targetDate1.toISOString(),
      duration: 60,
      topic: 'React Performance'
    })
  });
  const bookData1 = await bookRes1.json();
  assert('Temporary session slot reserved with 201', bookRes1.status === 201 && bookData1.session?.id);
  const sessionId1 = bookData1.session.id;

  // Confirm that session is NOT returned in GET /api/sessions for student or mentor
  const studentSessions1 = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${student1Token}` }
  })).json();
  const mentorSessions1 = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${mentorToken}` }
  })).json();

  assert(
    'Temporary unpaid session is NOT listed in student confirmed sessions',
    !studentSessions1.sessions?.some(s => s.id === sessionId1),
    `Found in student sessions: ${JSON.stringify(studentSessions1.sessions)}`
  );
  assert(
    'Temporary unpaid session is NOT listed in mentor confirmed sessions',
    !mentorSessions1.sessions?.some(s => s.id === sessionId1),
    `Found in mentor sessions: ${JSON.stringify(mentorSessions1.sessions)}`
  );

  // =========================================================================
  // TEST 2: Creating Razorpay order does NOT mark session as paid or confirmed
  // =========================================================================
  console.log('\n--- TEST 2: Creating Razorpay order (POST /api/payments/create-order) ---');
  const orderRes1 = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ sessionId: sessionId1 })
  });
  const orderData1 = await orderRes1.json();
  assert('Razorpay order created with 200', orderRes1.status === 200 && orderData1.orderId);

  const dbPaymentAfterOrder = await prisma.payment.findFirst({ where: { sessionId: sessionId1 } });
  assert('Payment status is PENDING (not PAID)', dbPaymentAfterOrder.status === 'PENDING');

  const studentSessionsAfterOrder = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${student1Token}` }
  })).json();
  assert(
    'Session with PENDING order is still NOT listed in confirmed sessions',
    !studentSessionsAfterOrder.sessions?.some(s => s.id === sessionId1)
  );

  // =========================================================================
  // TEST 3: Closing checkout without payment leaves session unconfirmed and cancels temporary booking
  // =========================================================================
  console.log('\n--- TEST 3: Checkout dismissed / cancelled by student ---');
  const cancelRes1 = await fetch(`${API_BASE}/sessions/${sessionId1}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` }
  });
  const cancelData1 = await cancelRes1.json();
  assert('Unpaid session cancelled upon checkout dismissal with 200', cancelRes1.status === 200 && cancelData1.session?.status === 'CANCELLED', JSON.stringify(cancelData1));

  const dbPaymentAfterDismiss = await prisma.payment.findFirst({ where: { sessionId: sessionId1 } });
  assert('Payment status transitioned to CANCELLED', dbPaymentAfterDismiss.status === 'CANCELLED');

  // Verify mentor slot is immediately released and Student 2 can now book this exact slot
  const bookResSlotReused = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student2Token}` },
    body: JSON.stringify({
      mentorshipId: mentorship2.id,
      scheduledAt: targetDate1.toISOString(),
      duration: 60,
      topic: 'Slot Reused Successfully'
    })
  });
  assert('Slot was released immediately and can be booked by another student', bookResSlotReused.status === 201);
  const reusedSessionId = (await bookResSlotReused.json()).session?.id;

  // =========================================================================
  // TEST 4: Failed payments leave session unconfirmed
  // =========================================================================
  console.log('\n--- TEST 4: Failed payment leaves session unconfirmed ---');
  // Student 2 cancels/fails payment on reusedSessionId
  await fetch(`${API_BASE}/sessions/${reusedSessionId}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student2Token}` }
  });
  const student2Sessions = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${student2Token}` }
  })).json();
  assert(
    'Cancelled/failed session is NOT listed in confirmed sessions',
    !student2Sessions.sessions?.some(s => s.id === reusedSessionId)
  );

  // =========================================================================
  // TEST 5: Successful server-verified payment confirms session exactly once (idempotent)
  // =========================================================================
  console.log('\n--- TEST 5: Server-verified payment confirms session ---');
  const bookResPaid = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      mentorshipId: mentorship1.id,
      scheduledAt: targetDate2.toISOString(),
      duration: 60,
      topic: 'Confirmed Mentoring Session'
    })
  });
  const sessionPaidId = (await bookResPaid.json()).session.id;

  const orderResPaid = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({ sessionId: sessionPaidId })
  });
  const orderPaidData = await orderResPaid.json();

  // Generate valid HMAC signature
  const secret = process.env.RAZORPAY_KEY_SECRET.replace(/^["']|["']$/g, '').trim();
  const fakePaymentId = 'pay_verified_' + crypto.randomBytes(4).toString('hex');
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderPaidData.orderId}|${fakePaymentId}`)
    .digest('hex');

  const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      razorpay_order_id: orderPaidData.orderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
      sessionId: sessionPaidId
    })
  });
  assert('Payment verified successfully with 200', verifyRes.status === 200);

  // Verify in DB that status is PAID and meetingLink generated
  const dbPaidSession = await prisma.session.findUnique({
    where: { id: sessionPaidId },
    include: { payment: true }
  });
  assert('Session payment status is PAID', dbPaidSession.payment?.status === 'PAID');
  assert('Session has meeting link generated', Boolean(dbPaidSession.meetingLink));

  // Verify it appears in GET /api/sessions for both student and mentor
  const confirmedStudentSessions = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${student1Token}` }
  })).json();
  const confirmedMentorSessions = await (await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${mentorToken}` }
  })).json();
  assert(
    'Paid session appears in student confirmed sessions',
    confirmedStudentSessions.sessions?.some(s => s.id === sessionPaidId)
  );
  assert(
    'Paid session appears in mentor confirmed sessions',
    confirmedMentorSessions.sessions?.some(s => s.id === sessionPaidId)
  );

  // Idempotency: verify duplicate verification call returns 200 success without error
  const duplicateVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      razorpay_order_id: orderPaidData.orderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
      sessionId: sessionPaidId
    })
  });
  const duplicateVerifyData = await duplicateVerifyRes.json();
  assert('Duplicate verification call is idempotent (returns 200 Already paid)', duplicateVerifyRes.status === 200 && duplicateVerifyData.message === 'Already paid');

  // =========================================================================
  // TEST 6: Invalid or forged signatures cannot confirm session
  // =========================================================================
  console.log('\n--- TEST 6: Invalid or forged signatures rejected ---');
  const bookResForged = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      mentorshipId: mentorship1.id,
      scheduledAt: targetDate3.toISOString(),
      duration: 60,
      topic: 'Forged Signature Test'
    })
  });
  const sessionForgedId = (await bookResForged.json()).session.id;

  const forgedVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student1Token}` },
    body: JSON.stringify({
      razorpay_order_id: 'order_fake_999999',
      razorpay_payment_id: 'pay_fake_999999',
      razorpay_signature: 'bad_signature_hash',
      sessionId: sessionForgedId
    })
  });
  assert('Forged signature rejected with 400', forgedVerifyRes.status === 400);

  const dbForgedSession = await prisma.session.findUnique({
    where: { id: sessionForgedId },
    include: { payment: true }
  });
  assert('Session remains unconfirmed (status not PAID)', dbForgedSession.payment?.status !== 'PAID');

  // =========================================================================
  // TEST 7: Abandoned unpaid sessions expire and release mentor availability
  // =========================================================================
  console.log('\n--- TEST 7: Abandoned unpaid session expiration via scheduler ---');
  // Backdate sessionForged createdAt to 20 minutes ago
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  await prisma.session.update({
    where: { id: sessionForgedId },
    data: { createdAt: twentyMinsAgo }
  });

  // Run cleanup job
  const cleanedCount = await cleanupAbandonedSessions(15);
  assert('Scheduler cleanup cancelled abandoned unpaid session', cleanedCount >= 1);

  const dbExpiredSession = await prisma.session.findUnique({ where: { id: sessionForgedId } });
  assert('Abandoned session status is CANCELLED', dbExpiredSession.status === 'CANCELLED');

  // Verify mentor slot at targetDate3 is now completely available for Student 2
  const bookResSlot3 = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student2Token}` },
    body: JSON.stringify({
      mentorshipId: mentorship2.id,
      scheduledAt: targetDate3.toISOString(),
      duration: 60,
      topic: 'Slot 3 Rebooked After Abandon Expiration'
    })
  });
  assert('Mentor availability slot released and can be rebooked', bookResSlot3.status === 201);
  const slot3SessionId = (await bookResSlot3.json()).session?.id;

  // =========================================================================
  // TEST 8: Confirmed paid sessions remain confirmed (never expired or cancelled by cleanup)
  // =========================================================================
  console.log('\n--- TEST 8: Paid session safety check ---');
  // Backdate sessionPaidId to 30 minutes ago
  await prisma.session.update({
    where: { id: sessionPaidId },
    data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) }
  });

  // Run cleanup job again
  await cleanupAbandonedSessions(15);

  const dbPaidCheck = await prisma.session.findUnique({
    where: { id: sessionPaidId },
    include: { payment: true }
  });
  assert('Paid session remains SCHEDULED and confirmed', dbPaidCheck.status === 'SCHEDULED' && dbPaidCheck.payment?.status === 'PAID');

  // Cleanup test data
  console.log('\n--- Cleaning up test records ---');
  const allTestSessionIds = [sessionId1, reusedSessionId, sessionPaidId, sessionForgedId, slot3SessionId].filter(Boolean);
  await prisma.payoutRecord.deleteMany({ where: { payment: { sessionId: { in: allTestSessionIds } } } });
  await prisma.payment.deleteMany({ where: { sessionId: { in: allTestSessionIds } } });
  await prisma.session.deleteMany({ where: { id: { in: allTestSessionIds } } });
  await prisma.mentorship.deleteMany({ where: { id: { in: [mentorship1.id, mentorship2.id] } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: [studentUser1.id, studentUser2.id] } } });
  await prisma.mentorProfile.deleteMany({ where: { userId: mentorUser.id } });
  await prisma.user.deleteMany({ where: { id: { in: [studentUser1.id, studentUser2.id, mentorUser.id] } } });

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runBookingLifecycleTestSuite()
  .catch(err => {
    console.error('Lifecycle test suite error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
