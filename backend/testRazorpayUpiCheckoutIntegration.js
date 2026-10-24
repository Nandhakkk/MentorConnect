const prisma = require('./src/config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');

const API_BASE = 'http://localhost:5000/api';

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

async function runPaymentSuite() {
  console.log('=== STARTING RAZORPAY UPI & CHECKOUT INTEGRATION TEST SUITE ===');
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

  // 1. Verify frontend BookSession.jsx configuration
  console.log('\n--- 1. Inspecting Frontend Razorpay Options in BookSession.jsx ---');
  const bookSessionContent = fs.readFileSync('c:/MCA/SEM 3/Mini project/original/MentorConnect/frontend/src/pages/student/BookSession.jsx', 'utf8');

  assert(
    'BookSession contains config.display.blocks',
    bookSessionContent.includes('blocks:') && bookSessionContent.includes('upi:') && bookSessionContent.includes('other:'),
    'Missing custom display blocks'
  );

  assert(
    'BookSession specifies UPI instrument with supported qr and intent flows (without deprecated collect)',
    bookSessionContent.includes('method: "upi"') &&
    bookSessionContent.includes('"qr"') &&
    bookSessionContent.includes('"intent"') &&
    !bookSessionContent.includes('"collect"'),
    'Missing UPI instrument or still contains deprecated collect flow'
  );

  assert(
    'BookSession preserves Cards, Netbanking, and Wallets in custom and default blocks',
    bookSessionContent.includes('method: "card"') &&
    bookSessionContent.includes('method: "netbanking"') &&
    bookSessionContent.includes('method: "wallet"') &&
    bookSessionContent.includes('show_default_blocks: true'),
    'Cards, Netbanking, Wallets or show_default_blocks missing'
  );

  assert(
    'BookSession prefill makes contact strictly optional and validates digit length',
    bookSessionContent.includes('contact: user.phone.trim()') &&
    bookSessionContent.includes('length >= 10'),
    'Missing safe contact validation in prefill'
  );

  // 2. Setup DB entities for live API test
  console.log('\n--- 2. Setting Up Test Student, Mentor & Session in Database ---');
  const suffix = crypto.randomBytes(4).toString('hex');
  const studentUser = await prisma.user.create({
    data: {
      name: `UPI Test Student ${suffix}`,
      email: `upistudent_${suffix}@test.com`,
      phone: '9876543210',
      password: 'hashedpassword',
      role: 'STUDENT',
      studentProfile: { create: {} }
    },
    include: { studentProfile: true }
  });

  const mentorUser = await prisma.user.create({
    data: {
      name: `UPI Test Mentor ${suffix}`,
      email: `upimentor_${suffix}@test.com`,
      password: 'hashedpassword',
      role: 'MENTOR',
      mentorProfile: {
        create: {
          status: 'APPROVED',
          mentorType: 'PROFESSIONAL',
          sessionFee: 750,
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

  // 3. Book a session
  console.log('\n--- 3. Testing Session Booking API (POST /api/sessions) ---');
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const bookRes = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      mentorshipId: mentorship.id,
      scheduledAt: futureDate.toISOString(),
      duration: 60,
      topic: 'UPI Payment Architecture'
    })
  });

  const bookData = await bookRes.json();
  assert('Session slot booked with status 201', bookRes.status === 201 && bookData.session?.id, `Status: ${bookRes.status}`);
  const sessionId = bookData.session?.id;

  // 4. Create Razorpay Order
  console.log('\n--- 4. Testing Order Creation with Real Razorpay Test API (POST /api/payments/create-order) ---');
  const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ sessionId })
  });

  const orderData = await orderRes.json();
  assert('Order creation returns status 200', orderRes.status === 200, `Status: ${orderRes.status}, Body: ${JSON.stringify(orderData)}`);
  assert('Order has razorpay order_id', orderData.orderId && orderData.orderId.startsWith('order_'), `OrderId: ${orderData.orderId}`);
  assert('Order amount is 75000 paise (₹750.00)', orderData.amount === 75000, `Amount: ${orderData.amount}`);
  assert('Currency is INR', orderData.currency === 'INR', `Currency: ${orderData.currency}`);
  assert('Key ID matches test key rzp_test_...', orderData.key && orderData.key.startsWith('rzp_test_'), `Key: ${orderData.key}`);

  // 5. Signature verification security tests
  console.log('\n--- 5. Testing Payment Signature Verification Security (POST /api/payments/verify) ---');
  // Attempt with forged signature
  const fakeVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: 'pay_simulated_fake_123',
      razorpay_signature: 'forged_fake_signature_hash',
      sessionId
    })
  });
  const fakeVerifyData = await fakeVerifyRes.json();
  assert('Forged payment signature rejected with 400', fakeVerifyRes.status === 400, `Status: ${fakeVerifyRes.status}, message: ${fakeVerifyData.message}`);

  // Ensure session in DB remains not paid
  const sessionAfterFake = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { payment: true }
  });
  assert('Session remains unconfirmed and payment status is PENDING/CREATED', sessionAfterFake.payment?.status !== 'PAID', `Status: ${sessionAfterFake.payment?.status}`);

  // Attempt with missing fields
  const missingVerifyRes = await fetch(`${API_BASE}/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      razorpay_order_id: orderData.orderId
    })
  });
  assert('Incomplete payment verification payload rejected with 400', missingVerifyRes.status === 400, `Status: ${missingVerifyRes.status}`);

  // Cleanup test data
  console.log('\n--- 6. Cleaning Up Test Data ---');
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  await prisma.mentorship.delete({ where: { id: mentorship.id } }).catch(() => {});
  await prisma.studentProfile.deleteMany({ where: { userId: studentUser.id } }).catch(() => {});
  await prisma.mentorProfile.deleteMany({ where: { userId: mentorUser.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [studentUser.id, mentorUser.id] } } }).catch(() => {});

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runPaymentSuite()
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
