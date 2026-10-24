const prisma = require('./src/config/db');
const app = require('./src/app');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

async function runSessionCompletionValidationSuite() {
  console.log('=== STARTING SESSION COMPLETION VALIDATION SUITE ===\n');
  let passed = 0;
  let failed = 0;
  const results = [];

  const logResult = (testName, expected, actual, result) => {
    results.push({ test: testName, expected, actual, result });
    if (result === 'PASS') passed++;
    else failed++;
  };

  const server = app.listen(8082);
  const baseUrl = 'http://localhost:8082';

  const doRequest = async (method, path, token, body = null) => {
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, opts);
    const data = await res.json();
    return { status: res.status, body: data };
  };

  try {
    // 1. Create Mentor 1 (Owner)
    const mentorUser1 = await prisma.user.create({
      data: { name: 'Mentor One', email: generateEmail('mentor1'), password: 'password', role: 'MENTOR' }
    });
    const mentorProfile1 = await prisma.mentorProfile.create({
      data: { userId: mentorUser1.id, status: 'APPROVED', mentorType: 'PROFESSIONAL', sessionFee: 500 }
    });
    const mentorToken1 = generateToken({ id: mentorUser1.id, role: 'MENTOR' });

    // 2. Create Mentor 2 (Other Mentor - Not Participant)
    const mentorUser2 = await prisma.user.create({
      data: { name: 'Mentor Two', email: generateEmail('mentor2'), password: 'password', role: 'MENTOR' }
    });
    await prisma.mentorProfile.create({
      data: { userId: mentorUser2.id, status: 'APPROVED', mentorType: 'PROFESSIONAL', sessionFee: 500 }
    });
    const mentorToken2 = generateToken({ id: mentorUser2.id, role: 'MENTOR' });

    // 3. Create Student
    const studentUser = await prisma.user.create({
      data: { name: 'Student One', email: generateEmail('student1'), password: 'password', role: 'STUDENT' }
    });
    const studentProfile = await prisma.studentProfile.create({
      data: { userId: studentUser.id, onboardingCompleted: true }
    });
    const studentToken = generateToken({ id: studentUser.id, role: 'STUDENT' });

    // 4. Create Mentorship
    const mentorship = await prisma.mentorship.create({
      data: {
        mentorId: mentorProfile1.id,
        studentId: studentProfile.id,
        status: 'ACTIVE'
      }
    });

    // TEST 1: Reject completion when session is in the future (before start time)
    try {
      const futureSession = await prisma.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt: new Date(Date.now() + 24 * 3600 * 1000), // Tomorrow
          duration: 60,
          topic: 'Future Topic',
          status: 'SCHEDULED'
        }
      });
      await prisma.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentorProfile1.id,
          sessionId: futureSession.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          status: 'PAID'
        }
      });

      const res = await doRequest('PUT', `/api/sessions/${futureSession.id}/complete`, mentorToken1);
      const isRejected = res.status === 400 && res.body.message.includes('before its scheduled end time');
      logResult('Reject completion before start time', '400', `${res.status} (${res.body.message})`, isRejected ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Reject completion before start time', 'Error', String(e), 'FAIL'); }

    // TEST 2: Reject completion during session (started, but before end time)
    try {
      const ongoingSession = await prisma.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt: new Date(Date.now() - 15 * 60000), // Started 15 minutes ago
          duration: 60, // 60 mins -> ends in 45 minutes
          topic: 'Ongoing Topic',
          status: 'SCHEDULED'
        }
      });
      await prisma.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentorProfile1.id,
          sessionId: ongoingSession.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          status: 'PAID'
        }
      });

      const res = await doRequest('PUT', `/api/sessions/${ongoingSession.id}/complete`, mentorToken1);
      const isRejected = res.status === 400 && res.body.message.includes('before its scheduled end time');
      logResult('Reject completion during session (before end time)', '400', `${res.status} (${res.body.message})`, isRejected ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Reject completion during session (before end time)', 'Error', String(e), 'FAIL'); }

    // TEST 3: Reject completion of CANCELLED session even after its scheduled end time
    try {
      const cancelledSession = await prisma.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
          duration: 60, // Ended 1 hour ago
          topic: 'Cancelled Topic',
          status: 'CANCELLED'
        }
      });
      await prisma.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentorProfile1.id,
          sessionId: cancelledSession.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          status: 'PAID'
        }
      });

      const res = await doRequest('PUT', `/api/sessions/${cancelledSession.id}/complete`, mentorToken1);
      const isRejected = res.status === 400 && res.body.message.includes('Cancelled');
      logResult('Reject completion of cancelled session', '400', `${res.status} (${res.body.message})`, isRejected ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Reject completion of cancelled session', 'Error', String(e), 'FAIL'); }

    // TEST 4: Reject completion by non-participating mentor
    try {
      const pastSession = await prisma.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt: new Date(Date.now() - 2 * 3600 * 1000),
          duration: 60,
          topic: 'Past Topic',
          status: 'SCHEDULED'
        }
      });
      await prisma.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentorProfile1.id,
          sessionId: pastSession.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          status: 'PAID'
        }
      });

      const res = await doRequest('PUT', `/api/sessions/${pastSession.id}/complete`, mentorToken2);
      const isAccessDenied = res.status === 403;
      logResult('Reject completion by non-participant mentor', '403', `${res.status}`, isAccessDenied ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Reject completion by non-participant mentor', 'Error', String(e), 'FAIL'); }

    // TEST 5: Allow completion after scheduled end time for valid paid session
    let validSessionId;
    let validPaymentId;
    try {
      const validSession = await prisma.session.create({
        data: {
          mentorshipId: mentorship.id,
          scheduledAt: new Date(Date.now() - 90 * 60000), // 90 mins ago
          duration: 60, // Ended 30 mins ago
          topic: 'Completed Topic',
          status: 'SCHEDULED'
        }
      });
      validSessionId = validSession.id;

      const validPayment = await prisma.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentorProfile1.id,
          sessionId: validSession.id,
          amount: 500,
          platformFee: 50,
          mentorAmount: 450,
          status: 'PAID'
        }
      });
      validPaymentId = validPayment.id;

      const res = await doRequest('PUT', `/api/sessions/${validSession.id}/complete`, mentorToken1);
      const updatedSess = await prisma.session.findUnique({ where: { id: validSession.id } });
      const payout = await prisma.payoutRecord.findFirst({ where: { paymentId: validPayment.id } });

      const isSuccess = res.status === 200 &&
                        updatedSess.status === 'COMPLETED' &&
                        payout && payout.status === 'ELIGIBLE' &&
                        payout.netAmount === 450;

      logResult('Allow completion after end time', '200, COMPLETED, ELIGIBLE payout', `${res.status}, ${updatedSess?.status}, ${payout?.status}`, isSuccess ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Allow completion after end time', 'Error', String(e), 'FAIL'); }

    // TEST 6: Reject repeated completion
    try {
      const res = await doRequest('PUT', `/api/sessions/${validSessionId}/complete`, mentorToken1);
      const isRejected = res.status === 400 && res.body.message.includes('already completed');
      logResult('Reject repeated completion of completed session', '400', `${res.status} (${res.body.message})`, isRejected ? 'PASS' : 'FAIL');
    } catch (e) { logResult('Reject repeated completion of completed session', 'Error', String(e), 'FAIL'); }

    server.close();
  } catch (err) {
    console.error('Test suite error:', err);
    server.close();
  } finally {
    console.log('\n================ TEST RESULTS ================\n');
    console.table(results);
    console.log(`\nPassed: ${passed} | Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runSessionCompletionValidationSuite();
