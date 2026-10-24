const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const prisma = require('./src/config/db');
const emailService = require('./src/services/emailService');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

function makeRequest(server, options, requestBody = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (requestBody) {
      req.write(typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody));
    }
    req.end();
  });
}

async function runHttpTests() {
  console.log('====================================================');
  console.log('   MENTORCONNECT GUARDIAN HTTP API ENDPOINTS TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (testName, condition, details = '') => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    emailService.clearOutbox();

    const now = new Date();
    const minorDob = new Date(now.getFullYear() - 15, now.getMonth(), now.getDate());

    const student = await prisma.user.create({
      data: {
        name: 'Daisy Minor',
        email: generateEmail('minor_daisy'),
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: minorDob,
        studentProfile: { create: { onboardingCompleted: true } }
      },
      include: { studentProfile: true }
    });

    const studentToken = generateToken({ id: student.id, role: 'STUDENT' });
    const authHeaders = { Authorization: `Bearer ${studentToken}` };

    // ── 1. GET /api/guardian/status (Initial) ──
    const resStatus1 = await makeRequest(server, { path: '/api/guardian/status', method: 'GET', headers: authHeaders });
    assert(
      '1. GET /api/guardian/status returns minor student status',
      resStatus1.status === 200 && resStatus1.data.data.isMinor === true && resStatus1.data.data.hasGuardian === false
    );

    // ── 2. POST /api/guardian/contact ──
    const guardianEmail = generateEmail('guardian_daisy');
    const resContact = await makeRequest(server, {
      path: '/api/guardian/contact',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'Thomas Minor-Guardian',
      relationship: 'Parent',
      email: guardianEmail,
      phone: '+91 9988776655'
    });
    assert(
      '2. POST /api/guardian/contact saves guardian details',
      resContact.status === 200 && resContact.data.guardian.email === guardianEmail && resContact.data.requiresVerification === true
    );

    // ── 3. POST /api/guardian/consent ──
    const resConsent = await makeRequest(server, {
      path: '/api/guardian/consent',
      method: 'POST',
      headers: authHeaders
    }, {
      consentGranted: true,
      policyVersion: '1.0'
    });
    assert(
      '3. POST /api/guardian/consent records student consent',
      resConsent.status === 200 && resConsent.data.consent.consentStatus === 'GRANTED'
    );

    // ── 4. POST /api/guardian/verify/send ──
    const resVerifySend = await makeRequest(server, {
      path: '/api/guardian/verify/send',
      method: 'POST',
      headers: authHeaders
    });
    assert(
      '4. POST /api/guardian/verify/send sends verification email',
      resVerifySend.status === 200 && resVerifySend.data.message.includes(guardianEmail)
    );

    // ── 5. GET & POST /api/guardian/verify/confirm ──
    // Get verification hash from DB
    const gRecord = await prisma.guardian.findFirst({ where: { minorStudentId: student.id } });
    const testRawToken = 'http_test_token_' + crypto.randomBytes(8).toString('hex');
    const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    await prisma.guardian.update({
      where: { id: gRecord.id },
      data: {
        verificationTokenHash: testTokenHash,
        verificationTokenExpiry: new Date(Date.now() + 3600 * 1000)
      }
    });

    // Test GET /api/guardian/verify/:token (Public)
    const resVerifyGet = await makeRequest(server, {
      path: `/api/guardian/verify/${testRawToken}`,
      method: 'GET'
    });
    assert(
      '5. GET /api/guardian/verify/:token activates contact via public link',
      resVerifyGet.status === 200 && resVerifyGet.data.studentName === 'Daisy Minor'
    );

    // ── 6. POST /api/guardian/summary-link ──
    const resSummaryLink = await makeRequest(server, {
      path: '/api/guardian/summary-link',
      method: 'POST',
      headers: authHeaders
    });
    assert(
      '6. POST /api/guardian/summary-link generates 24-hour unguessable link',
      resSummaryLink.status === 200 && resSummaryLink.data.token && resSummaryLink.data.summaryUrl.includes('/guardian/summary/')
    );

    // ── 7. GET /api/guardian/summary/:token (Public) ──
    const resSummary = await makeRequest(server, {
      path: `/api/guardian/summary/${resSummaryLink.data.token}`,
      method: 'GET'
    });
    assert(
      '7. GET /api/guardian/summary/:token returns allowlisted summary without login',
      resSummary.status === 200 &&
      resSummary.data.data.student.name === 'Daisy Minor' &&
      resSummary.data.data.guardian.email === guardianEmail &&
      resSummary.headers['cache-control'] && resSummary.headers['cache-control'].includes('no-store') &&
      resSummary.headers['x-robots-tag'] && resSummary.headers['x-robots-tag'].includes('noindex')
    );

    // ── 8. POST /api/guardian/notifications/preferences is blocked (403: mandatory notifications) ──
    const resPrefs = await makeRequest(server, {
      path: '/api/guardian/notifications/preferences',
      method: 'POST',
      headers: authHeaders
    }, {
      emailPayments: true,
      emailSessions: true
    });
    assert(
      '8. POST /api/guardian/notifications/preferences is blocked (403: mandatory notifications)',
      resPrefs.status === 403
    );

    // ── 9. POST /api/guardian/access/revoke ──
    const resRevoke = await makeRequest(server, {
      path: '/api/guardian/access/revoke',
      method: 'POST',
      headers: authHeaders
    }, {
      reason: 'Learner request'
    });
    assert(
      '9. POST /api/guardian/access/revoke revokes guardian monitoring',
      resRevoke.status === 200 && resRevoke.data.message.includes('revoked')
    );

    // ── 10. Accessing summary link after revocation fails ──
    const resSummaryRevoked = await makeRequest(server, {
      path: `/api/guardian/summary/${resSummaryLink.data.token}`,
      method: 'GET'
    });
    assert(
      '10. GET /api/guardian/summary/:token rejects revoked link',
      resSummaryRevoked.status === 410 || resSummaryRevoked.status === 403
    );

    // ── 11. Unauthenticated access to student setup endpoints is blocked ──
    const resUnauth = await makeRequest(server, {
      path: '/api/guardian/contact',
      method: 'POST'
    }, { name: 'Hack' });
    assert(
      '11. Unauthenticated request to /api/guardian/contact is blocked (401)',
      resUnauth.status === 401
    );

    // Clean up
    await prisma.guardianAccessToken.deleteMany({ where: { guardianId: gRecord.id } });
    await prisma.guardian.deleteMany({ where: { minorStudentId: student.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: student.id } });
    await prisma.notification.deleteMany({ where: { userId: student.id } });
    await prisma.user.deleteMany({ where: { id: student.id } });

    console.log('\n====================================================');
    console.log(`HTTP TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    server.close();
    if (failed === 0) process.exit(0);
    else process.exit(1);
  } catch (err) {
    console.error('HTTP Test Fatal Error:', err);
    server.close();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runHttpTests();
