const prisma = require('./src/config/db');
const smsService = require('./src/services/smsService');
const emailService = require('./src/services/emailService');
const guardianService = require('./src/services/guardianService');

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('====================================================');
  console.log(' Guardian Phone OTP Verification Workflow Fix Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const minorEmail = `minor_phone_${timestamp}@student.edu`;
  const guardianEmail = `parent_phone_${timestamp}@family.com`;
  const validGuardianPhone = `+9198765${String(timestamp).slice(-5)}`;
  const invalidPhone = '12345'; // Too short / invalid format

  try {
    // 1. Check SMS environment status
    console.log('--- 1. Testing SMS Provider Detection ---');
    const isConfigured = smsService.isSmsConfigured();
    assert(isConfigured === false, 'Requirement 1: Environment correctly reports Twilio SMS is not configured (simulated mode).');

    // 2. Register minor student
    console.log('\n--- 2. Registering Test Minor Student ---');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Minor',
        email: minorEmail,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: '2010-08-20'
      })
    });
    const regJson = await regRes.json();
    assert(regRes.status === 201 && regJson.token, 'Minor registered successfully.');
    const studentToken = regJson.token;
    const studentId = regJson.user.id;

    // 3. Save guardian contact with valid phone and email
    console.log('\n--- 3. Testing Contact Setup & Phone Validation ---');
    const contactRes = await fetch(`${BASE_URL}/guardian/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        name: 'Suresh Kumar (Parent)',
        relationship: 'Parent',
        email: guardianEmail,
        phone: validGuardianPhone
      })
    });
    const contactJson = await contactRes.json();
    assert(contactRes.status === 200, 'Guardian contact saved successfully.');

    // Grant consent
    await fetch(`${BASE_URL}/guardian/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ consentGranted: true, policyVersion: '1.0' })
    });

    // Check status reports simulated mode
    const statusRes = await fetch(`${BASE_URL}/guardian/status`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const statusJson = await statusRes.json();
    assert(statusJson.data.isSmsSimulated === true, 'Requirement 1b: Status API indicates isSmsSimulated: true in dev.');
    assert(statusJson.data.isSmsConfigured === false, 'Requirement 1c: Status API indicates isSmsConfigured: false.');

    // 4. Request Phone OTP
    console.log('\n--- 4. Requesting Phone OTP ---');
    smsService.clearSmsOutbox();

    const sendOtpRes = await fetch(`${BASE_URL}/guardian/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ method: 'PHONE' })
    });
    const sendOtpJson = await sendOtpRes.json();

    assert(sendOtpRes.status === 200, 'Requirement 2.1: Phone OTP endpoint returns 200.');
    assert(sendOtpJson.isSimulated === true, 'Requirement 2.2: Response explicitly marks isSimulated: true.');
    assert(sendOtpJson.message.includes('SIMULATED') && sendOtpJson.message.includes('NOT sent'),
      'Requirement 2.3: Message clearly tells user the SMS was SIMULATED and was NOT sent to the physical phone.');

    // 5. Retrieve simulated OTP via dev endpoint
    console.log('\n--- 5. Testing Dev-Only Test Outbox OTP Retrieval ---');
    const devOtpRes = await fetch(`${BASE_URL}/guardian/dev/latest-otp`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const devOtpJson = await devOtpRes.json();

    assert(devOtpRes.status === 200 && devOtpJson.status === 'success', 'Requirement 3.1: Dev-only endpoint returns 200 OK.');
    assert(Boolean(devOtpJson.data.otp && devOtpJson.data.otp.length === 6), 'Requirement 3.2: Retrieved valid 6-digit test OTP from development outbox.');
    assert(devOtpJson.data.method === 'PHONE', 'Requirement 3.3: Dev OTP data confirms method is PHONE.');

    const retrievedOtp = devOtpJson.data.otp;
    console.log(`[INFO] Retrieved simulated OTP for testing: ${retrievedOtp}`);

    // 6. Test invalid phone number rejection
    console.log('\n--- 6. Testing Phone Validation on send ---');
    // Update contact with invalid phone
    await prisma.guardian.updateMany({
      where: { minorStudentId: studentId },
      data: { phone: invalidPhone, lastOtpSentAt: null } // reset cooldown for test
    });

    const invalidSendRes = await fetch(`${BASE_URL}/guardian/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ method: 'PHONE' })
    });
    const invalidSendJson = await invalidSendRes.json();
    assert(invalidSendRes.status === 400 && invalidSendJson.message.includes('Invalid phone number format'),
      'Requirement 6: Invalid phone number format is caught with clear error message.');

    // Restore valid phone
    await prisma.guardian.updateMany({
      where: { minorStudentId: studentId },
      data: { phone: validGuardianPhone }
    });

    // 7. Verify Phone OTP using retrieved code
    console.log('\n--- 7. Verifying OTP with Retrieved Test Code ---');
    const verifyRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ otp: retrievedOtp, method: 'PHONE' })
    });
    const verifyJson = await verifyRes.json();

    assert(verifyRes.status === 200 && verifyJson.isVerified === true, 'Requirement 8.1: Correct simulated OTP succeeds and verifies contact.');
    assert(verifyJson.isMonitoringActive === true, 'Requirement 8.2: Monitoring activated with verified phone and granted consent.');
    assert(verifyJson.verificationMethod === 'PHONE', 'Requirement 8.3: Verification method recorded as PHONE.');

    // Verify OTP single-use
    const reVerifyRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ otp: retrievedOtp, method: 'PHONE' })
    });
    assert(reVerifyRes.status === 400, 'Requirement 8.4: Reused OTP is rejected (single-use preserved).');

    // 8. Test switching to Email verification
    console.log('\n--- 8. Testing Switching to Email Verification ---');
    // Reset contact to trigger re-verification
    await fetch(`${BASE_URL}/guardian/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        name: 'Suresh Kumar (Parent)',
        relationship: 'Parent',
        email: `updated_${guardianEmail}`,
        phone: validGuardianPhone
      })
    });

    // Request Email OTP
    const emailOtpRes = await fetch(`${BASE_URL}/guardian/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ method: 'EMAIL' })
    });
    const emailOtpJson = await emailOtpRes.json();
    assert(emailOtpRes.status === 200 && emailOtpJson.method === 'EMAIL', 'Requirement 7: Successfully switched to and requested Email verification OTP.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
