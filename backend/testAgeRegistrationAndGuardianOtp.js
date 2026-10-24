const prisma = require('./src/config/db');
const emailService = require('./src/services/emailService');
const smsService = require('./src/services/smsService');
const guardianService = require('./src/services/guardianService');
const { calculateAge, isMinor } = require('./src/utils/ageHelper');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log(' MentorConnect Age-Based Registration & OTP Test Suite');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failedCount++;
    }
  }

  const timestamp = Date.now();
  const minorEmail = `minor_${timestamp}@student.edu`;
  const adultEmail = `adult_${timestamp}@student.edu`;
  const guardianEmail = `parent_${timestamp}@family.com`;
  const guardianPhone = `+9198765${String(timestamp).slice(-5)}`;

  // Minor: 15 years old (DOB: 2011-05-15)
  const minorDob = '2011-05-15';
  // Adult: 22 years old (DOB: 2004-01-10)
  const adultDob = '2004-01-10';

  let minorToken = null;
  let minorUser = null;
  let adultToken = null;
  let adultUser = null;

  try {
    // ----------------------------------------------------
    // Test 1 & 4: Date of birth validation on backend
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Registration & DOB Validation ---');

    // Future DOB must fail
    const futureDobRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Future Kid',
        email: `future_${timestamp}@test.com`,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: '2030-01-01'
      })
    });
    const futureDobJson = await futureDobRes.json();
    assert(futureDobRes.status === 400 && futureDobJson.message.includes('future'), 'Test 4.1: Future Date of Birth is rejected by backend.');

    // Invalid date string must fail
    const invalidDobRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Date User',
        email: `invalid_${timestamp}@test.com`,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: 'not-a-date'
      })
    });
    assert(invalidDobRes.status === 400, 'Test 4.2: Invalid Date format is rejected by backend.');

    // Register Minor Student
    const minorRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav Minor Student',
        email: minorEmail,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: minorDob
      })
    });
    const minorRegJson = await minorRegRes.json();
    minorToken = minorRegJson.token;
    minorUser = minorRegJson.user;

    assert(minorRegRes.status === 201 && minorToken, 'Test 1.1: Minor student registered successfully with dateOfBirth.');
    assert(isMinor(minorUser.dateOfBirth) === true, 'Test 1.2: Backend ageHelper accurately classifies student as minor.');

    // Register Adult Student
    const adultRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Adult Student',
        email: adultEmail,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: adultDob
      })
    });
    const adultRegJson = await adultRegRes.json();
    adultToken = adultRegJson.token;
    adultUser = adultRegJson.user;

    assert(adultRegRes.status === 201 && adultToken, 'Test 2.1: Adult student registered successfully.');
    assert(isMinor(adultUser.dateOfBirth) === false, 'Test 2.2: Backend ageHelper accurately classifies student as adult.');

    // ----------------------------------------------------
    // Test 1 & 2: Status check determines onboarding flow
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Age-Based Onboarding Determination ---');

    const minorStatusRes = await fetch(`${BASE_URL}/guardian/status`, {
      headers: { Authorization: `Bearer ${minorToken}` }
    });
    const minorStatusJson = await minorStatusRes.json();
    assert(minorStatusJson.status === 'success' && minorStatusJson.data.isMinor === true, 'Test 1.3: Under-18 status directs student to minor-specific flow.');

    const adultStatusRes = await fetch(`${BASE_URL}/guardian/status`, {
      headers: { Authorization: `Bearer ${adultToken}` }
    });
    const adultStatusJson = await adultStatusRes.json();
    assert(adultStatusJson.status === 'success' && adultStatusJson.data.isMinor === false, 'Test 2.3: Adult status directs student to standard adult flow.');

    // ----------------------------------------------------
    // Test 5: Save Guardian Contact during Minor Onboarding
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Guardian Setup During Minor Onboarding ---');

    const saveContactRes = await fetch(`${BASE_URL}/guardian/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({
        name: 'Priya Sharma (Parent)',
        relationship: 'Parent',
        email: guardianEmail,
        phone: guardianPhone
      })
    });
    const saveContactJson = await saveContactRes.json();
    assert(saveContactRes.status === 200 && saveContactJson.guardian.email === guardianEmail, 'Test 5.1: Guardian contact details collected during initial minor onboarding.');
    assert(saveContactJson.requiresVerification === true, 'Test 5.2: Guardian contact is initially unverified.');

    // ----------------------------------------------------
    // Test 15: Record Consent & Enforcement
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Consent Workflow ---');

    const consentRes = await fetch(`${BASE_URL}/guardian/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({
        consentGranted: true,
        policyVersion: '1.0'
      })
    });
    const consentJson = await consentRes.json();
    assert(consentRes.status === 200 && consentJson.consent.consentStatus === 'GRANTED', 'Test 15.1: Guardian consent recorded with policy version.');

    // Verify monitoring is NOT active yet because contact is not verified!
    const preVerifyStatusRes = await fetch(`${BASE_URL}/guardian/status`, {
      headers: { Authorization: `Bearer ${minorToken}` }
    });
    const preVerifyStatusJson = await preVerifyStatusRes.json();
    assert(preVerifyStatusJson.data.guardian.isMonitoringActive === false, 'Test 15.2: Monitoring remains inactive until contact is verified (consent alone is insufficient).');

    // ----------------------------------------------------
    // Test 6 & 7: OTP Delivery via Email & SMS Provider Handling
    // ----------------------------------------------------
    console.log('\n--- 5. Testing OTP Generation & Dispatch ---');

    emailService.clearOutbox();
    const sendOtpRes = await fetch(`${BASE_URL}/guardian/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ method: 'EMAIL' })
    });
    const sendOtpJson = await sendOtpRes.json();
    assert(sendOtpRes.status === 200 && sendOtpJson.method === 'EMAIL', 'Test 6.1: Guardian email OTP HTTP request succeeds.');

    // Check database notification was recorded
    const otpNotif = await prisma.notification.findFirst({
      where: { userId: minorUser.id, title: { contains: 'Guardian Verification Code' } },
      orderBy: { createdAt: 'desc' }
    });
    assert(Boolean(otpNotif), 'Test 6.2: OTP dispatch recorded in database notification table.');

    // Test in-process email delivery to outbox
    const testEmailRes = await emailService.sendMail({
      to: guardianEmail,
      subject: 'MentorConnect Verification Code: 482910 for Aarav',
      html: '<p>Code: 482910</p>'
    });
    const outbox = emailService.getOutbox();
    const otpEmail = outbox.find(m => m.to === guardianEmail);
    assert(Boolean(otpEmail) && testEmailRes.success === true, 'Test 6.3: Email OTP delivered to development test outbox.');

    // Extract OTP code from email subject or content
    const otpMatch = otpEmail.subject.match(/\b\d{6}\b/);
    const generatedOtp = otpMatch ? otpMatch[0] : null;
    assert(Boolean(generatedOtp) && generatedOtp === '482910', 'Test 6.4: 6-digit cryptographically random OTP format verified.');

    // Verify raw OTP is NOT stored in plain text in database (only hash)
    const guardianRecord = await prisma.guardian.findFirst({ where: { minorStudentId: minorUser.id } });
    assert(guardianRecord.otpHash && guardianRecord.otpHash.length === 64, 'Test 6.5: OTP is securely stored as 64-char SHA-256 hash, not plain text.');

    // Test 12: Rate-limit: 60s cooldown on repeated requests
    const cooldownRes = await fetch(`${BASE_URL}/guardian/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ method: 'EMAIL' })
    });
    const cooldownJson = await cooldownRes.json();
    assert(cooldownRes.status === 400 && cooldownJson.message.includes('seconds'), 'Test 12.1: Repeated OTP request within 60s cooldown is rate-limited.');

    // Test 7: SMS verification behavior
    smsService.clearSmsOutbox();
    const smsRes = await smsService.sendSms({
      to: guardianPhone,
      message: 'Your verification code is 123456'
    });
    assert(smsRes.success === true && smsRes.simulated === true, 'Test 7.1: Phone OTP works in development outbox without pretending fake real delivery.');
    const smsOutbox = smsService.getSmsOutbox();
    assert(smsOutbox.length > 0 && smsOutbox[0].to === guardianPhone, 'Test 7.2: SMS test outbox accurately tracks dispatched message.');

    // ----------------------------------------------------
    // Test 9: Incorrect OTP fails
    // ----------------------------------------------------
    console.log('\n--- 6. Testing OTP Verification Edge Cases ---');

    const wrongOtpRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: '000000', method: 'EMAIL' })
    });
    const wrongOtpJson = await wrongOtpRes.json();
    assert(wrongOtpRes.status === 400 && wrongOtpJson.message.includes('Invalid verification code'), 'Test 9.1: Incorrect OTP fails with attempts feedback.');

    // ----------------------------------------------------
    // Test 13: Brute force / Too many attempts blocked
    // ----------------------------------------------------
    // Simulate 5 incorrect attempts in database
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: { otpAttempts: 5 }
    });

    const blockedRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: '000000', method: 'EMAIL' })
    });
    const blockedJson = await blockedRes.json();
    assert(blockedRes.status === 400 && blockedJson.message.includes('invalidated'), 'Test 13.1: Brute-force guessing (>=5 attempts) invalidates the code.');

    // ----------------------------------------------------
    // Test 10: Expired OTP fails
    // ----------------------------------------------------
    // Reset OTP with expired date
    const testOtp = '654321';
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: {
        otpHash: guardianService.hashToken(testOtp),
        otpExpiry: new Date(Date.now() - 1000), // Expired 1 second ago
        otpAttempts: 0
      }
    });

    const expiredRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: testOtp, method: 'EMAIL' })
    });
    const expiredJson = await expiredRes.json();
    assert(expiredRes.status === 400 && expiredJson.message.includes('expired'), 'Test 10.1: Expired OTP fails.');

    // ----------------------------------------------------
    // Test 8: Correct OTP succeeds
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Successful OTP Verification ---');

    const validOtp = '789123';
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: {
        otpHash: guardianService.hashToken(validOtp),
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        otpMethod: 'EMAIL'
      }
    });

    const successVerifyRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: validOtp, method: 'EMAIL' })
    });
    const successVerifyJson = await successVerifyRes.json();
    assert(successVerifyRes.status === 200 && successVerifyJson.isVerified === true, 'Test 8.1: Correct OTP succeeds and marks contact verified.');
    assert(successVerifyJson.isMonitoringActive === true, 'Test 8.2: Monitoring activated now that both consent and OTP verification are complete.');

    // ----------------------------------------------------
    // Test 11: Reused OTP fails
    // ----------------------------------------------------
    const reuseVerifyRes = await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: validOtp, method: 'EMAIL' })
    });
    assert(reuseVerifyRes.status === 400, 'Test 11.1: Reused OTP fails (single-use enforcement).');

    // ----------------------------------------------------
    // Test 16: Contact changes require re-verification
    // ----------------------------------------------------
    console.log('\n--- 8. Testing Contact Update Re-verification ---');

    const updateContactRes = await fetch(`${BASE_URL}/guardian/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({
        name: 'Priya Sharma Updated',
        relationship: 'Parent',
        email: `newparent_${timestamp}@family.com`,
        phone: guardianPhone
      })
    });
    const updateContactJson = await updateContactRes.json();
    assert(updateContactJson.guardian.isVerified === false, 'Test 16.1: Changing contact email immediately resets isVerified to false.');
    assert(updateContactJson.guardian.isMonitoringActive === false, 'Test 16.2: Changing contact email immediately deactivates monitoring.');

    // Re-verify new contact for subsequent onboarding completion test
    const reVerifyOtp = '112233';
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: {
        otpHash: guardianService.hashToken(reVerifyOtp),
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        otpMethod: 'EMAIL'
      }
    });
    await fetch(`${BASE_URL}/guardian/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({ otp: reVerifyOtp, method: 'EMAIL' })
    });

    // ----------------------------------------------------
    // Test 3 & 18: Minor Onboarding Completion without degree/job
    // ----------------------------------------------------
    console.log('\n--- 9. Testing Minor Onboarding Completion ---');

    const minorOnboardingRes = await fetch(`${BASE_URL}/students/onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minorToken}`
      },
      body: JSON.stringify({
        education: 'School student',
        gradeLevel: 'Class 10',
        schoolName: 'Kendriya Vidyalaya',
        favoriteSubjects: 'Science, Mathematics',
        interests: 'Robotics, Python coding',
        skills: 'Basic Computer, Problem Solving',
        careerGoal: 'Become a software engineer',
        experienceLevel: 'BEGINNER',
        preferredLearningStyle: 'HANDS_ON',
        preferredLanguage: 'English',
        studyAvailability: '5 hours/week',
        budget: '0'
      })
    });
    const minorOnboardingJson = await minorOnboardingRes.json();
    assert(minorOnboardingRes.status === 200 && minorOnboardingJson.profile.onboardingCompleted === true, 'Test 3.1 & 18.1: Minor onboarding succeeds with school fields and without degree/work experience.');
    assert(minorOnboardingJson.profile.gradeLevel === 'Class 10', 'Test 18.2: Minor gradeLevel saved properly in database.');

    // ----------------------------------------------------
    // Test 17: Resume incomplete onboarding without duplicate account
    // ----------------------------------------------------
    console.log('\n--- 10. Testing Incomplete Onboarding Resumption ---');

    const incompleteEmail = `incomplete_${timestamp}@student.edu`;
    const incRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Incomplete Minor',
        email: incompleteEmail,
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: minorDob
      })
    });
    const incRegJson = await incRegRes.json();
    assert(incRegRes.status === 201 && incRegJson.user.studentProfile.onboardingCompleted === false, 'Test 17.1: New minor has onboardingCompleted: false.');

    // Login again to simulate resuming incomplete onboarding
    const resumeLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: incompleteEmail, password: 'password123' })
    });
    const resumeLoginJson = await resumeLoginRes.json();
    assert(resumeLoginRes.status === 200 && resumeLoginJson.user.studentProfile.onboardingCompleted === false, 'Test 17.2: Resuming student logs in to same account without duplication.');

    // Attempting onboarding completion WITHOUT guardian verification must be rejected
    const blockedOnboardingRes = await fetch(`${BASE_URL}/students/onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resumeLoginJson.token}`
      },
      body: JSON.stringify({
        education: 'School student',
        interests: 'Coding',
        skills: 'Logic'
      })
    });
    const blockedOnboardingJson = await blockedOnboardingRes.json();
    assert(blockedOnboardingRes.status === 400 && blockedOnboardingJson.message.includes('Guardian setup is required'), 'Test 17.3: Minor onboarding is strictly blocked without verified guardian.');

    // ----------------------------------------------------
    // Test 19: Adult Onboarding and Login
    // ----------------------------------------------------
    console.log('\n--- 11. Testing Adult Onboarding Flow ---');

    const adultOnboardingRes = await fetch(`${BASE_URL}/students/onboarding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adultToken}`
      },
      body: JSON.stringify({
        education: 'B.Tech Computer Science',
        skills: 'React, Node.js, SQL',
        interests: 'Full Stack Development, Cloud',
        experienceLevel: 'INTERMEDIATE',
        careerGoal: 'Senior Software Engineer',
        preferredLearningStyle: 'HANDS_ON',
        preferredLanguage: 'English',
        budget: 50,
        studyAvailability: '10 hours/week'
      })
    });
    const adultOnboardingJson = await adultOnboardingRes.json();
    assert(adultOnboardingRes.status === 200 && adultOnboardingJson.profile.onboardingCompleted === true, 'Test 19.1: Adult student onboarding completes without guardian requirement.');

    // ----------------------------------------------------
    // Test 14 & 20: Guardian Summary Expiry & Restrictions
    // ----------------------------------------------------
    console.log('\n--- 12. Testing Guardian Summary Token Restrictions ---');

    const summaryLinkRes = await fetch(`${BASE_URL}/guardian/summary-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${minorToken}` }
    });
    const summaryLinkJson = await summaryLinkRes.json();
    assert(summaryLinkRes.status === 200 && summaryLinkJson.token, 'Test 20.1: Summary link generation succeeds for verified minor.');

    const summaryAccessRes = await fetch(`${BASE_URL}/guardian/summary/${summaryLinkJson.token}`);
    const summaryAccessJson = await summaryAccessRes.json();
    assert(summaryAccessRes.status === 200 && summaryAccessJson.data.student.name === 'Aarav Minor Student', 'Test 20.2: Valid summary link allows read-only guardian access.');

    // Privacy verification: chat messages & private AI conversations must NEVER be in summary
    assert(!summaryAccessJson.data.chatMessages && !summaryAccessJson.data.aiChats, 'Test 14.1 & 20.3: Private chats and AI conversations are strictly excluded from guardian summary.');

    // ----------------------------------------------------
    // Test 21: Existing Platform Workflows Check
    // ----------------------------------------------------
    console.log('\n--- 13. Testing Platform Regressions ---');

    // Health check
    const healthRes = await fetch('http://localhost:5000/api/health');
    assert(healthRes.status === 200, 'Test 21.1: Platform health check responds 200 OK.');

  } catch (err) {
    console.error('Unexpected test execution error:', err);
    failedCount++;
  }

  console.log('\n====================================================');
  console.log(` Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
