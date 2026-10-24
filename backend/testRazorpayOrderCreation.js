const prisma = require('./src/config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const API_BASE = 'http://localhost:5000/api';

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

async function runTests() {
  console.log('--- Starting Comprehensive Razorpay Order Creation Tests ---');
  let passedCount = 0;
  let failedCount = 0;

  function assert(title, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${title} - Details: ${details}`);
      failedCount++;
    }
  }

  // 1. Setup test student, mentor, mentorship
  const emailSuffix = crypto.randomBytes(4).toString('hex');
  const studentUser = await prisma.user.create({
    data: {
      name: `Test Student ${emailSuffix}`,
      email: `test_student_${emailSuffix}@test.com`,
      password: 'password123',
      role: 'STUDENT',
      studentProfile: { create: {} }
    },
    include: { studentProfile: true }
  });

  const mentorUser = await prisma.user.create({
    data: {
      name: `Test Mentor ${emailSuffix}`,
      email: `test_mentor_${emailSuffix}@test.com`,
      password: 'password123',
      role: 'MENTOR',
      mentorProfile: {
        create: {
          status: 'APPROVED',
          mentorType: 'PROFESSIONAL',
          sessionFee: 500,
          isAvailable: true,
          availabilities: {
            create: [
              { dayOfWeek: 'MONDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'TUESDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'WEDNESDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'THURSDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'FRIDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'SATURDAY', startTime: '00:00', endTime: '23:59', isActive: true },
              { dayOfWeek: 'SUNDAY', startTime: '00:00', endTime: '23:59', isActive: true },
            ]
          }
        }
      }
    },
    include: { mentorProfile: true }
  });

  const mentorship = await prisma.mentorship.create({
    data: {
      studentId: studentUser.studentProfile.id,
      mentorId: mentorUser.mentorProfile.id,
      status: 'ACTIVE'
    }
  });

  const studentToken = generateToken({ id: studentUser.id, role: 'STUDENT' });

  // TEST 1: Booking a session via POST /api/sessions
  // Pick tomorrow at 10:00 AM IST (which is 04:30 UTC)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const scheduledDate = new Date(`${tomorrowDateStr}T10:00:00+05:30`);

  const bookRes = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      mentorshipId: mentorship.id,
      scheduledAt: scheduledDate.toISOString(),
      duration: 60,
      topic: 'Architecture Review'
    })
  });

  const bookData = await bookRes.json();
  assert('Student can book session', bookRes.status === 201 && bookData.session?.id, `Status: ${bookRes.status}, data: ${JSON.stringify(bookData)}`);

  const sessionId = bookData.session?.id;
  assert('Session has CREATED payment record', bookData.session?.payment?.status === 'CREATED', `Payment status: ${bookData.session?.payment?.status}`);
  assert('Payment amount is calculated correctly (fee 500)', bookData.session?.payment?.amount === 500, `Amount: ${bookData.session?.payment?.amount}`);

  // TEST 2: Calling POST /api/payments/create-order with invalid/fake credentials currently in .env
  console.log('\n--- Testing create-order with current backend credentials ---');
  const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ sessionId })
  });

  const orderData = await orderRes.json();
  console.log('create-order response status:', orderRes.status);
  console.log('create-order response body:', orderData);

  // Since backend/.env has fake secret, it should safely return 502 with payment authentication error
  assert(
    'Handles invalid gateway credentials with clear 502 error',
    orderRes.status === 502 && orderData.message.includes('authentication failed'),
    `Status: ${orderRes.status}, message: ${orderData.message}`
  );

  // TEST 3: Verify cleanup of failed booking (so slot is not left blocked and no orphaned unusable session remains)
  const cleanedUpSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { payment: true }
  });
  assert('Orphaned session and payment were cleaned up after order creation failed', cleanedUpSession === null, `Cleaned up session: ${JSON.stringify(cleanedUpSession)}`);

  // TEST 4: Student user without studentProfile preloaded in token
  console.log('\n--- Testing student profile auto-resolution ---');
  const userNoProfile = await prisma.user.create({
    data: {
      name: `NoProfile ${emailSuffix}`,
      email: `noprofile_${emailSuffix}@test.com`,
      password: 'password123',
      role: 'STUDENT'
      // No studentProfile created intentionally
    }
  });

  const mentorship2 = await prisma.mentorship.create({
    data: {
      studentId: (await prisma.studentProfile.create({ data: { userId: userNoProfile.id } })).id,
      mentorId: mentorUser.mentorProfile.id,
      status: 'ACTIVE'
    }
  });

  const tokenNoProfile = generateToken({ id: userNoProfile.id, role: 'STUDENT' });
  const bookRes2 = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenNoProfile}`
    },
    body: JSON.stringify({
      mentorshipId: mentorship2.id,
      scheduledAt: new Date(`${tomorrowDateStr}T14:00:00+05:30`).toISOString(),
      duration: 60,
      topic: 'Defensive Profile Test'
    })
  });
  const bookData2 = await bookRes2.json();
  assert('Student without preloaded profile books successfully', bookRes2.status === 201 && bookData2.session?.id, `Status: ${bookRes2.status}`);

  // TEST 5: Amount and Currency validation
  console.log('\n--- Testing Amount and Currency Validation ---');
  // Create dummy session with 0 amount
  const zeroSession = await prisma.session.create({
    data: {
      mentorshipId: mentorship.id,
      scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      duration: 60,
      topic: 'Zero Amount Test',
      payment: {
        create: {
          studentId: studentUser.studentProfile.id,
          mentorId: mentorUser.mentorProfile.id,
          amount: 0,
          platformFee: 0,
          mentorAmount: 0,
          currency: 'INR',
          status: 'CREATED'
        }
      }
    }
  });

  const zeroOrderRes = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ sessionId: zeroSession.id })
  });
  const zeroOrderData = await zeroOrderRes.json();
  assert('Zero amount rejected with 400', zeroOrderRes.status === 400 && zeroOrderData.message.includes('Invalid payment amount'), `Status: ${zeroOrderRes.status}, data: ${JSON.stringify(zeroOrderData)}`);

  // Cleanup zeroSession
  await prisma.session.delete({ where: { id: zeroSession.id } }).catch(() => {});

  // TEST 6: Unauthorized user role
  const mentorToken = generateToken({ id: mentorUser.id, role: 'MENTOR' });
  const unauthorizedRes = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mentorToken}`
    },
    body: JSON.stringify({ sessionId: bookData2.session?.id })
  });
  assert('Mentor cannot create student payment order (403)', unauthorizedRes.status === 403, `Status: ${unauthorizedRes.status}`);

  // TEST 7: Payment verification requires valid signature and does not bypass
  console.log('\n--- Testing Signature Verification Security ---');
  const fakeVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      razorpay_order_id: 'order_fake_123',
      razorpay_payment_id: 'pay_fake_123',
      razorpay_signature: 'invalid_fake_signature',
      sessionId: bookData2.session?.id
    })
  });
  assert('Fake signature rejected with 400', fakeVerifyRes.status === 400, `Status: ${fakeVerifyRes.status}`);

  // TEST 8: Missing Razorpay configuration (503) and cleanup
  console.log('\n--- Testing Missing Configuration (503) ---');
  const paymentController = require('./src/controllers/paymentController');
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;

  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;

  const missingConfigSession = await prisma.session.create({
    data: {
      mentorshipId: mentorship.id,
      scheduledAt: new Date(Date.now() + 96 * 60 * 60 * 1000),
      duration: 60,
      topic: 'Missing Config Test',
      payment: {
        create: {
          studentId: studentUser.studentProfile.id,
          mentorId: mentorUser.mentorProfile.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          currency: 'INR',
          status: 'CREATED'
        }
      }
    }
  });

  let mockStatus = 0;
  let mockBody = null;
  const mockReq = {
    user: { id: studentUser.id, role: 'STUDENT', studentProfile: studentUser.studentProfile },
    body: { sessionId: missingConfigSession.id }
  };
  const mockRes = {
    status: (code) => { mockStatus = code; return mockRes; },
    json: (data) => { mockBody = data; return mockRes; }
  };

  await paymentController.createRazorpayOrder(mockReq, mockRes);
  assert('Missing Razorpay config returns 503', mockStatus === 503 && mockBody?.message?.includes('configuration is missing'), `Status: ${mockStatus}, Body: ${JSON.stringify(mockBody)}`);

  const missingConfigCleaned = await prisma.session.findUnique({ where: { id: missingConfigSession.id } });
  assert('Orphaned session cleaned up when config is missing', missingConfigCleaned === null, `Cleaned session: ${JSON.stringify(missingConfigCleaned)}`);

  // Restore env
  process.env.RAZORPAY_KEY_ID = originalKeyId;
  process.env.RAZORPAY_KEY_SECRET = originalSecret;

  // Clean up test data
  console.log('\n--- Cleaning up test records ---');
  if (bookData2.session?.id) {
    await prisma.session.delete({ where: { id: bookData2.session.id } }).catch(() => {});
  }
  await prisma.mentorship.deleteMany({ where: { id: { in: [mentorship.id, mentorship2.id] } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: [studentUser.id, userNoProfile.id] } } });
  await prisma.mentorProfile.deleteMany({ where: { userId: mentorUser.id } });
  await prisma.user.deleteMany({ where: { id: { in: [studentUser.id, mentorUser.id, userNoProfile.id] } } });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
  console.log(`========================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
