const prisma = require('./src/config/db');
const app = require('./src/app');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

let adminToken;
let mentorToken;
let studentToken;
let mentorId;
let studentId;
let adminId;
let mentorshipId;
let sessionId;
let paymentId;
let peerMentorToken;
let peerMentorId;

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

async function setupTestData() {
  // Clear old test data specifically
  await prisma.payoutRecord.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.mentorship.deleteMany({});
  
  // Create Admin
  const admin = await prisma.user.create({
    data: { name: 'Admin', email: generateEmail('admin'), password: 'password', role: 'ADMIN' }
  });
  adminId = admin.id;
  adminToken = generateToken({ id: admin.id, role: 'ADMIN' });

  // Create Professional Mentor
  const mentor = await prisma.user.create({
    data: { name: 'Prof Mentor', email: generateEmail('mentor'), password: 'password', role: 'MENTOR' }
  });
  mentorId = mentor.id;
  await prisma.mentorProfile.create({
    data: { userId: mentor.id, status: 'APPROVED', mentorType: 'PROFESSIONAL', sessionFee: 1000 }
  });
  mentorToken = generateToken({ id: mentor.id, role: 'MENTOR' });

  // Create Student
  const student = await prisma.user.create({
    data: { name: 'Student', email: generateEmail('student'), password: 'password', role: 'STUDENT' }
  });
  studentId = student.id;
  await prisma.studentProfile.create({
    data: { userId: student.id, onboardingCompleted: true }
  });
  studentToken = generateToken({ id: student.id, role: 'STUDENT' });

  // Create Peer Mentor
  const peerMentor = await prisma.user.create({
    data: { name: 'Peer Mentor', email: generateEmail('peer'), password: 'password', role: 'STUDENT' }
  });
  peerMentorId = peerMentor.id;
  await prisma.studentProfile.create({
    data: { userId: peerMentor.id, onboardingCompleted: true }
  });
  await prisma.mentorProfile.create({
    data: { userId: peerMentor.id, status: 'APPROVED', mentorType: 'PEER', sessionFee: 500 }
  });
  peerMentorToken = generateToken({ id: peerMentor.id, role: 'STUDENT' });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  const logResult = (testName, expected, actual, result) => {
    results.push({ test: testName, expected, actual, result });
    if (result === 'PASS') passed++;
    else failed++;
  };

  try {
    await setupTestData();
    
    // 1. Create a Mentorship
    const mentorship = await prisma.mentorship.create({
      data: {
        mentorId: (await prisma.mentorProfile.findUnique({ where: { userId: mentorId } })).id,
        studentId: (await prisma.studentProfile.findUnique({ where: { userId: studentId } })).id,
        status: 'ACTIVE'
      }
    });
    mentorshipId = mentorship.id;

    // 2. Create a Session and Payment
    const session = await prisma.session.create({
      data: {
        mentorshipId,
        scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
        duration: 60,
        topic: 'Test Topic',
        status: 'SCHEDULED'
      }
    });
    sessionId = session.id;

    const payment = await prisma.payment.create({
      data: {
        studentId: (await prisma.studentProfile.findUnique({ where: { userId: studentId } })).id,
        mentorId: mentorship.mentorId,
        sessionId: session.id,
        amount: 1000,
        platformFee: 100,
        mentorAmount: 900,
        status: 'PAID'
      }
    });
    paymentId = payment.id;

    // Start server
    const server = app.listen(8081);
    const baseUrl = 'http://localhost:8081';

    console.log("Starting Tests...");

    const doRequest = async (method, path, token, body = null) => {
      const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${baseUrl}${path}`, opts);
      const data = await res.json();
      return { status: res.status, body: data };
    };

    // Test: Premature completion before scheduled end time fails
    try {
      const res = await doRequest('PUT', `/api/sessions/${sessionId}/complete`, mentorToken);
      const success = res.status === 400 && res.body.message.includes('before its scheduled end time');
      logResult('Premature completion rejected (before end time)', '400', `${res.status} (${res.body.message})`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Premature completion rejected (before end time)', 'Error', String(e), 'FAIL'); }

    // Test: Unpaid session completion
    try {
      const unpaidSession = await prisma.session.create({
        data: { mentorshipId, scheduledAt: new Date(Date.now() - 7200000), duration: 30, topic: 'Unpaid', status: 'SCHEDULED' }
      });
      const unpaidPayment = await prisma.payment.create({
        data: { studentId: mentorship.studentId, mentorId: mentorship.mentorId, sessionId: unpaidSession.id, amount: 500, platformFee: 50, mentorAmount: 450, status: 'CREATED' }
      });
      
      const res = await doRequest('PUT', `/api/sessions/${unpaidSession.id}/complete`, mentorToken);
      
      logResult('Unpaid session completion fails', '400', String(res.status), res.status === 400 ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Unpaid session completion fails', 'Error', String(e), 'FAIL'); }

    // Test: Paid session completion after end time creates payout
    try {
      // Advance session scheduledAt to 2 hours ago (duration 60m => ended 1 hour ago)
      await prisma.session.update({
        where: { id: sessionId },
        data: { scheduledAt: new Date(Date.now() - 7200000) }
      });

      const res = await doRequest('PUT', `/api/sessions/${sessionId}/complete`, mentorToken);
      
      const payout = await prisma.payoutRecord.findFirst({ where: { paymentId } });
      const success = res.status === 200 && payout && payout.status === 'ELIGIBLE' && payout.netAmount === 900 && payout.platformFee === 100;
      logResult('Paid session creates correct payout', '200, ELIGIBLE, net 900', `${res.status}, ${payout?.status}, net ${payout?.netAmount}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Paid session creates correct payout', 'Success', String(e), 'FAIL'); }

    // Test: Repeated completion does not create duplicate payout
    try {
      const res = await doRequest('PUT', `/api/sessions/${sessionId}/complete`, mentorToken);
      
      const payouts = await prisma.payoutRecord.findMany({ where: { paymentId } });
      const success = res.status === 400 && payouts.length === 1;
      logResult('Repeated completion blocks/no duplicate', '400, 1 payout', `${res.status}, ${payouts.length} payout(s)`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Repeated completion blocks', 'Success', String(e), 'FAIL'); }

    // Test: Cancelled session does not create payout
    try {
      const cancelledSession = await prisma.session.create({
        data: { mentorshipId, scheduledAt: new Date(Date.now() - 7200000), duration: 30, topic: 'Cancelled', status: 'CANCELLED' }
      });
      const cancelledPayment = await prisma.payment.create({
        data: { studentId: mentorship.studentId, mentorId: mentorship.mentorId, sessionId: cancelledSession.id, amount: 500, platformFee: 50, mentorAmount: 450, status: 'PAID' }
      });
      
      const res = await doRequest('PUT', `/api/sessions/${cancelledSession.id}/complete`, mentorToken);
      
      const payout = await prisma.payoutRecord.findFirst({ where: { paymentId: cancelledPayment.id } });
      const success = res.status === 400 && !payout;
      logResult('Cancelled session block payout', '400, no payout', `${res.status}, ${payout ? 'exists' : 'no payout'}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Cancelled session block payout', 'Success', String(e), 'FAIL'); }

    // Test: Mentor can see own earnings
    try {
      const res = await doRequest('GET', `/api/finance/mentor/earnings`, mentorToken);
      
      const success = res.status === 200 && res.body.summary.eligible === 900;
      logResult('Mentor can see own earnings', '200, eligible 900', `${res.status}, eligible ${res.body.summary?.eligible}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Mentor can see own earnings', 'Success', String(e), 'FAIL'); }

    // Test: Peer Mentor can see own earnings (even though no sessions yet, should return 200)
    try {
      const res = await doRequest('GET', `/api/finance/mentor/earnings`, peerMentorToken);
      
      const success = res.status === 200 && res.body.summary.eligible === 0;
      logResult('Peer mentor can see own earnings', '200, eligible 0', `${res.status}, eligible ${res.body.summary?.eligible}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Peer mentor can see own earnings', 'Success', String(e), 'FAIL'); }

    // Test: Normal student is blocked
    try {
      const res = await doRequest('GET', `/api/finance/mentor/earnings`, studentToken);
      
      const success = res.status === 403;
      logResult('Normal student is blocked', '403', String(res.status), success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Normal student is blocked', 'Success', String(e), 'FAIL'); }

    // Test: Admin can view finance summary
    try {
      const res = await doRequest('GET', `/api/finance/admin/summary`, adminToken);
      
      const success = res.status === 200 && res.body.summary.eligibleAmount === 900;
      logResult('Admin view finance summary', '200, eligible 900', `${res.status}, eligible ${res.body.summary?.eligibleAmount}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Admin view finance summary', 'Success', String(e), 'FAIL'); }

    // Test: Admin can move ELIGIBLE -> PROCESSING
    let payoutId;
    try {
      const payout = await prisma.payoutRecord.findFirst({ where: { paymentId } });
      payoutId = payout.id;
      
      const res = await doRequest('PUT', `/api/finance/admin/payouts/${payoutId}/process`, adminToken);
      
      const success = res.status === 200 && res.body.payout.status === 'PROCESSING';
      logResult('Admin ELIGIBLE -> PROCESSING', '200, PROCESSING', `${res.status}, ${res.body.payout?.status}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Admin ELIGIBLE -> PROCESSING', 'Success', String(e), 'FAIL'); }

    // Test: Admin can move PROCESSING -> PAID
    try {
      const res = await doRequest('PUT', `/api/finance/admin/payouts/${payoutId}/complete`, adminToken, { status: 'PAID', providerId: 'BANK123' });
      
      const success = res.status === 200 && res.body.payout.status === 'PAID' && res.body.payout.providerId === 'BANK123';
      logResult('Admin PROCESSING -> PAID', '200, PAID, provider', `${res.status}, ${res.body.payout?.status}, ${res.body.payout?.providerId}`, success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Admin PROCESSING -> PAID', 'Success', String(e), 'FAIL'); }

    // Test: Invalid status transition is rejected (PAID -> PROCESSING)
    try {
      const res = await doRequest('PUT', `/api/finance/admin/payouts/${payoutId}/process`, adminToken);
      
      const success = res.status === 400;
      logResult('Invalid transition rejected', '400', String(res.status), success ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Invalid transition rejected', 'Success', String(e), 'FAIL'); }

    server.close();

  } catch (err) {
    console.error("Test setup error:", err);
  } finally {
    console.log("\n================ TEST RESULTS ================\n");
    console.table(results);
    console.log(`\nPassed: ${passed} | Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
