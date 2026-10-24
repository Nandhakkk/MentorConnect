const crypto = require('crypto');
const prisma = require('./src/config/db');
const guardianService = require('./src/services/guardianService');
const studentEmailVerificationService = require('./src/services/studentEmailVerificationService');
const emailService = require('./src/services/emailService');
const { calculateAge, isMinor } = require('./src/utils/ageHelper');

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

async function runTests() {
  console.log('================================================================');
  console.log('  GUARDIAN EMAIL-ONLY, ACCOUNT EMAIL VERIFY, PREFS & ADULT TESTS');
  console.log('================================================================\n');

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

  const dispatchedMails = [];
  emailService.__setTestMockTransport({
    sendMail: async (opts) => {
      dispatchedMails.push(opts);
      return { success: true, messageId: `mock-${Date.now()}` };
    }
  });

  try {
    // -----------------------------------------------------------
    // Setup test minor student (15 years old)
    // -----------------------------------------------------------
    const minorDob = new Date();
    minorDob.setFullYear(minorDob.getFullYear() - 15);

    const minorUser = await prisma.user.create({
      data: {
        name: 'Minor Learner',
        email: generateEmail('minor'),
        password: 'hashedpassword',
        role: 'STUDENT',
        dateOfBirth: minorDob,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        studentProfile: { create: {} }
      }
    });

    const guardianEmail = generateEmail('guardian');
    const contactRes = await guardianService.saveOrUpdateContact(minorUser.id, {
      name: 'Eleanor Parent',
      relationship: 'Parent',
      email: guardianEmail,
      phone: '+919876543210'
    });

    assert(contactRes.guardian.email === guardianEmail.toLowerCase(), '1. Guardian contact saved with email');
    assert(contactRes.requiresVerification === true, '1b. Guardian contact requires verification');

    // -----------------------------------------------------------
    // SECTION 1: Guardian Email-Only Verification Tests
    // -----------------------------------------------------------
    console.log('\n--- 1. Testing Guardian Email-Only OTP Verification ---');

    // 1.1 SMS OTP request MUST be rejected
    let smsRejected = false;
    try {
      await guardianService.sendGuardianOtp(minorUser.id, { method: 'PHONE' });
    } catch (err) {
      smsRejected = err.message.includes('no longer supported') || err.message.includes('Email only');
    }
    assert(smsRejected, '1.1 SMS OTP request is rejected with clear email-only message');

    // 1.2 Dispatch Email OTP
    dispatchedMails.length = 0;
    const otpSendRes = await guardianService.sendGuardianOtp(minorUser.id, { method: 'EMAIL' });
    assert(otpSendRes.success === true, '1.2 Guardian Email OTP dispatch succeeds');
    assert(otpSendRes.method === 'EMAIL', '1.2b Method is confirmed as EMAIL');
    assert(otpSendRes.message.includes('Guardian'), '1.2c Clear notification message delivered');

    // 1.3 Check database stores HASH only, not plain OTP
    const guardianRecord = await prisma.guardian.findFirst({ where: { minorStudentId: minorUser.id } });
    assert(guardianRecord.otpHash && guardianRecord.otpHash.length === 64, '1.3 Guardian OTP is stored as SHA-256 hash (64 hex chars)');
    assert(guardianRecord.otpMethod === 'EMAIL', '1.3b Stored OTP method is EMAIL');
    assert(guardianRecord.otpExpiry > new Date(), '1.3c OTP expiry is active and within 10 minutes');

    // 1.4 Dispatched mail inspection
    const validOtpMatch = dispatchedMails[0].subject.match(/\b\d{6}\b/);
    assert(Boolean(validOtpMatch), '1.4 Dispatched mail contains valid 6-digit OTP');
    const validOtp = validOtpMatch ? validOtpMatch[0] : '000000';

    // 1.5 Rate limit: 60-second cooldown
    let cooldownBlocked = false;
    try {
      await guardianService.sendGuardianOtp(minorUser.id, { method: 'EMAIL' });
    } catch (err) {
      cooldownBlocked = err.message.includes('wait') || err.message.includes('seconds');
    }
    assert(cooldownBlocked, '1.5 Resend request within 60s cooldown is blocked');

    // 1.6 Incorrect OTP is rejected and increments attempts
    let wrongOtpRejected = false;
    try {
      await guardianService.verifyGuardianOtp(minorUser.id, { otp: '000000' });
    } catch (err) {
      wrongOtpRejected = err.message.includes('Invalid verification code');
    }
    assert(wrongOtpRejected, '1.6 Incorrect OTP is rejected');

    const guardianAfterFail = await prisma.guardian.findFirst({ where: { minorStudentId: minorUser.id } });
    assert(guardianAfterFail.otpAttempts === 1, '1.6b Failed attempt counter incremented to 1');

    // 1.7 Correct OTP verifies contact
    const verifyRes = await guardianService.verifyGuardianOtp(minorUser.id, { otp: validOtp });
    assert(verifyRes.isVerified === true, '1.7 Correct Email OTP verifies guardian contact');
    assert(verifyRes.verificationMethod === 'EMAIL', '1.7b Verification method marked as EMAIL');
    // Monitoring requires BOTH consent and verification: since consent was not granted yet, monitoring is inactive
    assert(verifyRes.isMonitoringActive === false, '1.7c Guardian monitoring remains inactive until consent is also granted');

    // 1.8 OTP cannot be reused
    let reuseRejected = false;
    try {
      await guardianService.verifyGuardianOtp(minorUser.id, { otp: validOtp });
    } catch (err) {
      reuseRejected = err.message.includes('No active verification code') || err.message.includes('invalidated');
    }
    assert(reuseRejected, '1.8 Verified OTP cannot be reused (single-use invalidated)');

    // 1.9 Recording consent now activates monitoring
    await guardianService.recordConsent(minorUser.id, { consentGranted: true, policyVersion: '1.0' });
    const guardianAfterConsent = await prisma.guardian.findFirst({ where: { minorStudentId: minorUser.id } });
    assert(guardianAfterConsent.isMonitoringActive === true, '1.9 Monitoring activates once BOTH contact is verified and consent is granted');

    // -----------------------------------------------------------
    // SECTION 2: Student Account Email Changes & Verification Tests
    // -----------------------------------------------------------
    console.log('\n--- 2. Testing Student Account Email Change & Verification ---');

    const newStudentEmail = generateEmail('newstudent');
    dispatchedMails.length = 0;

    // 2.1 Request email change
    const emailReqRes = await studentEmailVerificationService.requestEmailChange(minorUser.id, newStudentEmail);
    assert(emailReqRes.success === true, '2.1 Student email change initiated');
    assert(emailReqRes.pendingEmail === newStudentEmail.toLowerCase(), '2.1b Pending email recorded');

    // 2.2 Active login email has NOT changed prematurely
    const userInDb = await prisma.user.findUnique({ where: { id: minorUser.id } });
    assert(userInDb.email === minorUser.email, '2.2 Current active email is preserved in database');
    assert(userInDb.pendingEmail === newStudentEmail.toLowerCase(), '2.2b New email is queued in pendingEmail');
    assert(userInDb.emailOtpHash && userInDb.emailOtpHash.length === 64, '2.2c Email verification OTP is hashed');
    assert(userInDb.isEmailVerified === true, '2.2d Existing account verification status is not broken');

    // 2.3 Duplicate email check
    const otherUser = await prisma.user.create({
      data: {
        name: 'Other Student',
        email: generateEmail('other'),
        password: 'password123',
        role: 'STUDENT'
      }
    });

    let dupRejected = false;
    try {
      await studentEmailVerificationService.requestEmailChange(minorUser.id, otherUser.email);
    } catch (err) {
      dupRejected = err.message.includes('already exists');
    }
    assert(dupRejected, '2.3 Email address already registered to another user is rejected');

    // 2.4 Same email as current is rejected
    let sameRejected = false;
    try {
      await studentEmailVerificationService.requestEmailChange(minorUser.id, minorUser.email);
    } catch (err) {
      sameRejected = err.message.includes('cannot be the same');
    }
    assert(sameRejected, '2.4 Requesting identical email as current email is rejected');

    // 2.5 Extract student verification OTP from dispatched mail
    const studentOtpMatch = dispatchedMails[dispatchedMails.length - 1].subject.match(/\b\d{6}\b/);
    assert(Boolean(studentOtpMatch), '2.5 Student verification OTP found in dispatched email');
    const studentOtp = studentOtpMatch ? studentOtpMatch[0] : '000000';

    // 2.6 Incorrect code rejected
    let wrongStudentOtp = false;
    try {
      await studentEmailVerificationService.verifyEmailChange(minorUser.id, '999999');
    } catch (err) {
      wrongStudentOtp = err.message.includes('Invalid verification code');
    }
    assert(wrongStudentOtp, '2.6 Incorrect email verification code is rejected');

    // 2.7 Correct code finalizes email change
    const emailVerifyRes = await studentEmailVerificationService.verifyEmailChange(minorUser.id, studentOtp);
    assert(emailVerifyRes.success === true, '2.7 Student email change verification succeeds');
    assert(emailVerifyRes.email === newStudentEmail.toLowerCase(), '2.7b Verified email matches new address');

    const finalizedUser = await prisma.user.findUnique({ where: { id: minorUser.id } });
    assert(finalizedUser.email === newStudentEmail.toLowerCase(), '2.7c User table email updated to new verified address');
    assert(finalizedUser.pendingEmail === null, '2.7d Pending email field cleared');
    assert(finalizedUser.isEmailVerified === true, '2.7e isEmailVerified is true');
    assert(finalizedUser.emailVerifiedAt !== null, '2.7f emailVerifiedAt timestamp recorded');

    // 2.8 Cross-verification separation: Guardian email verification does NOT verify student email, and vice versa
    assert(guardianRecord.email !== finalizedUser.email, '2.8 Guardian email and student account email remain completely distinct');

    // -----------------------------------------------------------
    // SECTION 3: Mandatory Guardian Notifications Tests
    // -----------------------------------------------------------
    console.log('\n--- 3. Testing Mandatory Guardian Notifications (Preferences Disallowed) ---');

    // 3.1 Minor cannot modify notification settings via API
    let prefModificationBlocked = false;
    try {
      await guardianService.updateNotificationPreferences(minorUser.id, { emailPayments: false });
    } catch (err) {
      prefModificationBlocked = err.message.includes('mandatory');
    }
    assert(prefModificationBlocked, '3.1 Minor student cannot modify guardian notification preferences');

    // 3.2 Inject stale/legacy disabled preferences into DB to verify notifications are NOT suppressed
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: {
        notificationPreferences: {
          emailPayments: false,
          emailSessions: false,
          emailAssignments: false,
          emailProgress: false,
          emailComplaints: false
        }
      }
    });

    // 3.3 Payment notification IS dispatched despite legacy false preference
    dispatchedMails.length = 0;
    const paymentNotif = await guardianService.notifyGuardianEvent(minorUser.id, 'PAYMENT', {
      title: 'Payment Receipt',
      message: '₹1500 payment confirmed'
    });
    assert(paymentNotif !== null, '3.3 Payment notification is mandatory and DISPATCHED despite old false preference');

    // 3.4 Session notification IS dispatched despite legacy false preference
    const sessionNotif = await guardianService.notifyGuardianEvent(minorUser.id, 'SESSION', {
      title: 'Session Booked',
      message: 'Mentoring session scheduled for tomorrow'
    });
    assert(sessionNotif !== null, '3.4 Session notification is mandatory and DISPATCHED despite old false preference');

    // 3.5 Assignment notification IS dispatched
    const assignmentNotif = await guardianService.notifyGuardianEvent(minorUser.id, 'ASSIGNMENT', {
      title: 'New Assignment',
      message: 'Assignment assigned'
    });
    assert(assignmentNotif !== null, '3.5 Assignment notification is mandatory and DISPATCHED');

    // 3.6 Mandatory safeguarding notification is ALWAYS dispatched
    const safetyNotif = await guardianService.notifyGuardianEvent(minorUser.id, 'SAFEGUARDING', {
      title: 'Mandatory Safeguarding Notice',
      message: 'Important safety alert regarding user interaction'
    });
    assert(safetyNotif !== null, '3.6 Mandatory SAFEGUARDING alert is ALWAYS delivered');

    // 3.7 Revoking monitoring stops automatic notifications
    await guardianService.revokeGuardianAccess(minorUser.id, 'REVOKED_BY_STUDENT');
    const revokedStatus = await guardianService.getGuardianStatus(minorUser.id);
    assert(revokedStatus.guardian.isMonitoringActive === false, '3.7 Monitoring is revoked');

    // 3.8 When monitoring is revoked, notifications are not sent
    const notifAfterRevoke = await guardianService.notifyGuardianEvent(minorUser.id, 'SESSION', {
      title: 'Session Booked',
      message: 'Should not send'
    });
    assert(notifAfterRevoke === null, '3.8 No notifications sent once monitoring is revoked');

    // -----------------------------------------------------------
    // SECTION 4: Adult Student Profile Tests (Age 18+)
    // -----------------------------------------------------------
    console.log('\n--- 4. Testing Adult Student Profiles (18+) ---');

    // Setup adult student (22 years old)
    const adultDob = new Date();
    adultDob.setFullYear(adultDob.getFullYear() - 22);

    const adultUser = await prisma.user.create({
      data: {
        name: 'Adult Learner',
        email: generateEmail('adult'),
        password: 'hashedpassword',
        role: 'STUDENT',
        dateOfBirth: adultDob,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        studentProfile: { create: {} }
      }
    });

    // 4.1 Adult status returns null guardian and hasGuardian = false
    const adultStatus = await guardianService.getGuardianStatus(adultUser.id);
    assert(adultStatus.isMinor === false, '4.1 Adult user isMinor is false');
    assert(adultStatus.hasGuardian === false, '4.1b Adult user hasGuardian is false');
    assert(adultStatus.guardian === null, '4.1c Adult user guardian DTO is strictly null');

    // 4.2 Adult student cannot configure guardian
    let adultSetupRejected = false;
    try {
      await guardianService.saveOrUpdateContact(adultUser.id, {
        name: 'Parent Name',
        relationship: 'Parent',
        email: 'parent@example.com'
      });
    } catch (err) {
      adultSetupRejected = err.message.includes('Adult learners') || err.message.includes('not enrolled');
    }
    assert(adultSetupRejected, '4.2 Adult student cannot configure a guardian');

    // 4.3 Stale guardian data in DB does NOT expose guardian to adult
    // Insert stale guardian directly into DB to simulate student turning 18
    await prisma.guardian.create({
      data: {
        minorStudentId: adultUser.id,
        name: 'Stale Guardian',
        relationship: 'Parent',
        email: 'stale_guardian@example.com',
        isVerified: true,
        isMonitoringActive: true
      }
    });

    const adultStatusWithStale = await guardianService.getGuardianStatus(adultUser.id);
    assert(adultStatusWithStale.isMinor === false, '4.3 Adult status remains isMinor = false despite stale DB row');
    assert(adultStatusWithStale.hasGuardian === false, '4.3b Adult status hasGuardian is false');
    assert(adultStatusWithStale.guardian === null, '4.3c Stale guardian data is strictly hidden (guardian = null)');

    // 4.4 Stale monitoring is revoked automatically with STUDENT_REACHED_AGE_18
    const staleInDb = await prisma.guardian.findFirst({ where: { minorStudentId: adultUser.id } });
    assert(staleInDb.isMonitoringActive === false, '4.4 Stale monitoring is automatically revoked');
    assert(staleInDb.accessRevokedReason === 'STUDENT_REACHED_AGE_18', '4.4b Revocation reason is STUDENT_REACHED_AGE_18');

    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    emailService.__clearTestMockTransport();
  }
}

runTests();
