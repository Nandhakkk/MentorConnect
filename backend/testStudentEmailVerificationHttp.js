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
  console.log('================================================================');
  console.log('   STUDENT EMAIL & GUARDIAN EMAIL HTTP API TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (testName, condition, details = '') => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  };

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

  const dispatchedMails = [];
  emailService.__setTestMockTransport({
    sendMail: async (opts) => {
      dispatchedMails.push(opts);
      return { success: true, messageId: `mock-${Date.now()}` };
    }
  });

  try {
    const minorDob = new Date();
    minorDob.setFullYear(minorDob.getFullYear() - 16);

    const minorUser = await prisma.user.create({
      data: {
        name: 'Daisy Minor',
        email: generateEmail('daisy_http'),
        password: 'hashedpassword',
        role: 'STUDENT',
        dateOfBirth: minorDob,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        studentProfile: { create: {} }
      }
    });

    const minorToken = generateToken({ id: minorUser.id, role: 'STUDENT' });
    const minorHeaders = { Authorization: `Bearer ${minorToken}` };

    // 1. Save guardian contact with email
    const guardianEmail = generateEmail('guardian_http');
    const contactRes = await makeRequest(server, {
      path: '/api/guardian/contact',
      method: 'POST',
      headers: minorHeaders
    }, {
      name: 'Daisy Parent',
      relationship: 'Parent',
      email: guardianEmail,
      phone: '+919876543210'
    });
    assert('1. POST /api/guardian/contact saves guardian contact', contactRes.status === 200 && contactRes.data.status === 'success');

    // 2. POST /api/guardian/otp/send - request Email OTP
    dispatchedMails.length = 0;
    const sendOtpRes = await makeRequest(server, {
      path: '/api/guardian/otp/send',
      method: 'POST',
      headers: minorHeaders
    }, { method: 'EMAIL' });
    assert('2. POST /api/guardian/otp/send sends email verification code', sendOtpRes.status === 200 && sendOtpRes.data.method === 'EMAIL');
    assert('2b. Verification email sent to guardian recipient', dispatchedMails.length === 1 && dispatchedMails[0].to === guardianEmail.toLowerCase());

    // 3. Extract 6-digit OTP from dispatched email
    const guardianOtpMatch = dispatchedMails[0].subject.match(/\b\d{6}\b/);
    assert('3. Real email service was invoked with 6-digit OTP', Boolean(guardianOtpMatch));
    const guardianOtp = guardianOtpMatch ? guardianOtpMatch[0] : '000000';

    // 4. POST /api/guardian/otp/verify with correct OTP
    const verifyGuardianRes = await makeRequest(server, {
      path: '/api/guardian/otp/verify',
      method: 'POST',
      headers: minorHeaders
    }, { otp: guardianOtp });
    assert('4. POST /api/guardian/otp/verify verifies guardian contact', verifyGuardianRes.status === 200 && verifyGuardianRes.data.isVerified === true);

    // 5. POST /api/guardian/notifications/preferences is blocked (403: mandatory notifications)
    const prefsRes = await makeRequest(server, {
      path: '/api/guardian/notifications/preferences',
      method: 'POST',
      headers: minorHeaders
    }, {
      emailPayments: false,
      emailSessions: true
    });
    assert('5. POST /api/guardian/notifications/preferences is blocked (403: mandatory notifications)', prefsRes.status === 403);

    // 6. GET /api/guardian/status for minor shows preferences and guardian details
    const minorStatusRes = await makeRequest(server, {
      path: '/api/guardian/status',
      method: 'GET',
      headers: minorHeaders
    });
    assert('6. GET /api/guardian/status returns minor student guardian status', minorStatusRes.status === 200 && minorStatusRes.data.data.isMinor === true && minorStatusRes.data.data.guardian !== null);

    // 7. Adult student status: hide guardian details
    const adultDob = new Date();
    adultDob.setFullYear(adultDob.getFullYear() - 25);
    const adultUser = await prisma.user.create({
      data: {
        name: 'Arthur Adult',
        email: generateEmail('arthur_http'),
        password: 'hashedpassword',
        role: 'STUDENT',
        dateOfBirth: adultDob,
        studentProfile: { create: {} }
      }
    });
    const adultToken = generateToken({ id: adultUser.id, role: 'STUDENT' });
    const adultHeaders = { Authorization: `Bearer ${adultToken}` };

    const adultStatusRes = await makeRequest(server, {
      path: '/api/guardian/status',
      method: 'GET',
      headers: adultHeaders
    });
    assert('7. GET /api/guardian/status for adult returns guardian: null', adultStatusRes.status === 200 && adultStatusRes.data.data.isMinor === false && adultStatusRes.data.data.guardian === null && adultStatusRes.data.data.hasGuardian === false);

    // 8. Adult cannot save guardian contact
    const adultSaveRes = await makeRequest(server, {
      path: '/api/guardian/contact',
      method: 'POST',
      headers: adultHeaders
    }, {
      name: 'Parent Name',
      relationship: 'Parent',
      email: 'parent@test.com'
    });
    assert('8. Adult student blocked from POST /api/guardian/contact (403)', adultSaveRes.status === 403);

    // 9. Student Email Change: POST /api/students/email/change
    const newStudentEmail = generateEmail('daisy_new_email');
    dispatchedMails.length = 0;
    const changeEmailRes = await makeRequest(server, {
      path: '/api/students/email/change',
      method: 'POST',
      headers: minorHeaders
    }, { email: newStudentEmail });
    assert('9. POST /api/students/email/change initiates verification', changeEmailRes.status === 200 && changeEmailRes.data.pendingEmail === newStudentEmail.toLowerCase());

    // 10. GET /api/students/me returns emailVerificationPending: true
    const meRes = await makeRequest(server, {
      path: '/api/students/me',
      method: 'GET',
      headers: minorHeaders
    });
    assert('10. GET /api/students/me returns pending status', meRes.status === 200 && meRes.data.profile.user.emailVerificationPending === true && meRes.data.profile.user.pendingEmail === newStudentEmail.toLowerCase());

    // 11. Extract student verification OTP from dispatched email
    const studentOtpMatch = dispatchedMails[dispatchedMails.length - 1].subject.match(/\b\d{6}\b/);
    assert('11. Dispatched email contains 6-digit verification code', Boolean(studentOtpMatch));
    const studentOtp = studentOtpMatch ? studentOtpMatch[0] : '000000';

    // 12. POST /api/students/email/verify validates code and updates email
    const verifyStudentEmailRes = await makeRequest(server, {
      path: '/api/students/email/verify',
      method: 'POST',
      headers: minorHeaders
    }, { otp: studentOtp });
    assert('12. POST /api/students/email/verify confirms email change', verifyStudentEmailRes.status === 200 && verifyStudentEmailRes.data.email === newStudentEmail.toLowerCase() && verifyStudentEmailRes.data.isEmailVerified === true);

    // 13. Verify profile now has new verified email
    const updatedMeRes = await makeRequest(server, {
      path: '/api/students/me',
      method: 'GET',
      headers: minorHeaders
    });
    assert('13. Student profile active email is updated and pending cleared', updatedMeRes.data.profile.user.email === newStudentEmail.toLowerCase() && updatedMeRes.data.profile.user.pendingEmail === null && updatedMeRes.data.profile.user.emailVerificationPending === false);

    console.log('\n================================================================');
    console.log(`HTTP TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');

    server.close();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('HTTP test error:', err);
    server.close();
    process.exit(1);
  } finally {
    emailService.__clearTestMockTransport();
  }
}

runHttpTests();
