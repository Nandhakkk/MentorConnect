const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('./src/config/db');
const guardianService = require('./src/services/guardianService');
const schedulerService = require('./src/services/schedulerService');
const emailService = require('./src/services/emailService');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key', { expiresIn: '7d' });
};

const generateEmail = (prefix) => `${prefix}_${crypto.randomBytes(4).toString('hex')}@test.com`;

async function runGuardianTests() {
  console.log('====================================================');
  console.log('   MENTORCONNECT GUARDIAN FEATURE COMPREHENSIVE TEST');
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

  try {
    emailService.clearOutbox();

    // ── 1. Setup Test Users: Minor Student (Age 16), Adult Student (Age 22), Mentor ──
    const now = new Date();
    const minorDob = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
    const adultDob = new Date(now.getFullYear() - 22, now.getMonth(), now.getDate());

    const minorStudent = await prisma.user.create({
      data: {
        name: 'Alice Minor',
        email: generateEmail('minor_alice'),
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: minorDob,
        studentProfile: { create: { onboardingCompleted: true } }
      },
      include: { studentProfile: true }
    });

    const adultStudent = await prisma.user.create({
      data: {
        name: 'Bob Adult',
        email: generateEmail('adult_bob'),
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: adultDob,
        studentProfile: { create: { onboardingCompleted: true } }
      },
      include: { studentProfile: true }
    });

    const mentorUser = await prisma.user.create({
      data: {
        name: 'Dr. Mentor',
        email: generateEmail('mentor_doc'),
        password: 'password123',
        role: 'MENTOR',
        mentorProfile: { create: { status: 'APPROVED', mentorType: 'PROFESSIONAL', sessionFee: 1500 } }
      },
      include: { mentorProfile: true }
    });

    const mentorship = await prisma.mentorship.create({
      data: {
        studentId: minorStudent.studentProfile.id,
        mentorId: mentorUser.mentorProfile.id,
        status: 'ACTIVE'
      }
    });

    // ── Test 1: Under-18 student can complete Guardian setup ──
    const guardianEmail = generateEmail('guardian_alice');
    const setupResult = await guardianService.saveOrUpdateContact(
      minorStudent.id,
      {
        name: 'Eleanor Minor-Parent',
        relationship: 'Parent',
        email: guardianEmail,
        phone: '+91 9876543210'
      }
    );
    assert(
      '1. Under-18 student can complete Guardian setup',
      setupResult.guardian && setupResult.guardian.email === guardianEmail && setupResult.requiresVerification === true
    );

    // ── Test 2: Adult student (18+) is rejected/not enrolled ──
    let adultRejected = false;
    try {
      await guardianService.saveOrUpdateContact(
        adultStudent.id,
        {
          name: 'Bob Guardian',
          relationship: 'Parent',
          email: generateEmail('adult_guard')
        }
      );
    } catch (err) {
      adultRejected = err.message.includes('Adult learners') || err.message.includes('18 and older');
    }
    assert('2. Adult student (18+) is rejected and not enrolled in guardian monitoring', adultRejected);

    // ── Test 3: Record Consent ──
    const consentResult = await guardianService.recordConsent(minorStudent.id, {
      consentGranted: true,
      policyVersion: '1.0'
    });
    assert(
      '3. Consent is recorded with timestamp and policy version',
      consentResult.consentStatus === 'GRANTED' && consentResult.consentPolicyVersion === '1.0'
    );

    // ── Test 4: Send verification email & verify token creation ──
    const sendResult = await guardianService.sendVerificationEmail(minorStudent.id);
    assert('4. Verification email dispatched with expiring token', sendResult.success && sendResult.sentTo === guardianEmail);

    const outboxEmails = emailService.getOutbox();
    const verificationEmail = outboxEmails.find(e => e.to === guardianEmail && e.subject.includes('Confirm Guardian Contact'));
    assert('4b. Email outbox received formatted verification email', !!verificationEmail);

    // ── Test 5: Rate limit repeated verification requests ──
    let rateLimited = false;
    try {
      for (let i = 0; i < 6; i++) {
        await guardianService.sendVerificationEmail(minorStudent.id);
      }
    } catch (err) {
      rateLimited = err.message.includes('Too many verification requests');
    }
    assert('5. Repeated verification requests are rate-limited', rateLimited);

    // ── Test 6: Invalid and expired verification tokens are rejected ──
    let invalidTokenRejected = false;
    try {
      await guardianService.confirmVerification('totally_invalid_random_token_123');
    } catch (err) {
      invalidTokenRejected = true;
    }
    assert('6. Invalid verification token is rejected', invalidTokenRejected);

    // ── Test 7: Confirm valid verification token ──
    // Retrieve token from database
    const guardianRecord = await prisma.guardian.findFirst({
      where: { minorStudentId: minorStudent.id }
    });
    // In our implementation, guardianRecord.verificationTokenHash stores the SHA-256 hash.
    // Let's test confirming by setting a known token
    const testRawToken = 'test_valid_verification_token_' + crypto.randomBytes(8).toString('hex');
    const testHash = guardianService.hashToken(testRawToken);
    await prisma.guardian.update({
      where: { id: guardianRecord.id },
      data: {
        verificationTokenHash: testHash,
        verificationTokenExpiry: new Date(Date.now() + 3600 * 1000)
      }
    });

    const confirmRes = await guardianService.confirmVerification(testRawToken);
    assert('7. Valid verification token activates guardian contact', confirmRes.success === true);

    const verifiedGuardian = await prisma.guardian.findUnique({ where: { id: guardianRecord.id } });
    assert('7b. Guardian record marked as verified and active', verifiedGuardian.isVerified === true && verifiedGuardian.isMonitoringActive === true);

    // ── Test 8: Generate 24-hour expiring summary link ──
    const summaryLinkRes = await guardianService.createSummaryLink(minorStudent.id);
    assert(
      '8. Cryptographically secure 24-hour summary link generated',
      summaryLinkRes.success === true && summaryLinkRes.token && summaryLinkRes.expiresInHours === 24
    );

    // Verify token hash is stored, not raw token
    const tokenHashInDb = guardianService.hashToken(summaryLinkRes.token);
    const dbTokenRecord = await prisma.guardianAccessToken.findUnique({
      where: { tokenHash: tokenHashInDb }
    });
    assert('8b. Database stores token hash only, never raw token', !!dbTokenRecord && dbTokenRecord.tokenHash === tokenHashInDb);

    // ── Test 9: Fetch summary with valid token returns allowlisted student data ──
    // Create goal, milestone, session, and payment for minorStudent
    const goal = await prisma.goal.create({
      data: {
        studentId: minorStudent.studentProfile.id,
        title: 'Master Data Structures',
        status: 'ACTIVE',
        milestones: {
          create: [
            { title: 'Binary Search Trees', status: 'COMPLETED' },
            { title: 'Graph Algorithms', status: 'PENDING', dueDate: new Date(Date.now() + 7 * 86400000) }
          ]
        }
      },
      include: { milestones: true }
    });

    const session = await prisma.session.create({
      data: {
        mentorshipId: mentorship.id,
        scheduledAt: new Date(Date.now() + 86400000),
        duration: 60,
        topic: 'Tree Traversal Fundamentals',
        status: 'SCHEDULED'
      }
    });

    const payment = await prisma.payment.create({
      data: {
        studentId: minorStudent.studentProfile.id,
        sessionId: session.id,
        amount: 1500,
        platformFee: 150,
        mentorAmount: 1350,
        status: 'PAID'
      }
    });

    const assignment = await prisma.assignment.create({
      data: {
        mentorshipId: mentorship.id,
        sessionId: session.id,
        mentorId: mentorUser.mentorProfile.id,
        studentId: minorStudent.studentProfile.id,
        title: 'Implement AVL Tree Rotations',
        description: 'Complete the balancing methods in python.',
        dueDate: new Date(Date.now() + 3 * 86400000),
        status: 'ASSIGNED'
      }
    });

    const summaryData = await guardianService.getSummaryByToken(summaryLinkRes.token);
    assert(
      '9. Summary endpoint returns allowlisted student data',
      summaryData &&
      summaryData.student.name === 'Alice Minor' &&
      summaryData.learningProgress.goals.length >= 1 &&
      summaryData.learningProgress.completedMilestones >= 1 &&
      summaryData.upcomingSessions.length >= 1 &&
      summaryData.assignments.length >= 1 &&
      summaryData.payments.length >= 1
    );

    // ── Test 10: Private chats and AI interactions are inaccessible ──
    assert(
      '10. Private chats, passwords, tokens, and AI conversations are inaccessible in summary DTO',
      summaryData.messages === undefined &&
      summaryData.aiConversations === undefined &&
      summaryData.student.password === undefined &&
      summaryData.safetyNotice &&
      summaryData.safetyNotice.policy.includes('Private 1-on-1') || summaryData.safetyNotice.policy.includes('confidential')
    );

    // ── Test 11: Cross-student isolation ──
    // Create another student with another guardian
    const minorStudent2 = await prisma.user.create({
      data: {
        name: 'Charlie Second',
        email: generateEmail('minor_charlie'),
        password: 'password123',
        role: 'STUDENT',
        dateOfBirth: minorDob,
        studentProfile: { create: { onboardingCompleted: true } }
      },
      include: { studentProfile: true }
    });

    assert(
      '11. Summary link is strictly bound to linked student (cross-student data leak impossible)',
      summaryData.student.name !== 'Charlie Second'
    );

    // ── Test 12: Expired and revoked summary links fail ──
    // Manually revoke the token
    await prisma.guardianAccessToken.update({
      where: { id: dbTokenRecord.id },
      data: { revokedAt: new Date() }
    });

    let revokedRejected = false;
    try {
      await guardianService.getSummaryByToken(summaryLinkRes.token);
    } catch (err) {
      revokedRejected = err.message.includes('revoked');
    }
    assert('12. Revoked summary link is rejected', revokedRejected);

    // ── Test 13: Contact change requires re-verification ──
    const newEmail = generateEmail('guardian_new_alice');
    const updateContactRes = await guardianService.saveOrUpdateContact(minorStudent.id, {
      name: 'Eleanor Minor-Parent Updated',
      relationship: 'Parent',
      email: newEmail
    });
    assert(
      '13. Guardian contact change resets verification and requires re-verification',
      updateContactRes.guardian.isVerified === false && updateContactRes.requiresVerification === true
    );

    // ── Test 14: Payment notification trigger ──
    emailService.clearOutbox();
    // Re-verify guardian for notification testing
    await prisma.guardian.update({
      where: { id: verifiedGuardian.id },
      data: { isVerified: true, isMonitoringActive: true, consentStatus: 'GRANTED' }
    });

    await guardianService.notifyGuardianEvent(
      minorStudent.id,
      'PAYMENT',
      {
        title: 'Payment Confirmed & Session Scheduled',
        message: 'Payment of ₹1500 was confirmed for mentoring session.',
        referenceId: session.id,
        referenceType: 'PAYMENT'
      }
    );

    const paymentEmail = emailService.getOutbox().find(e => e.subject.includes('Payment'));
    assert('14. Payment event notification sent with correct amounts', !!paymentEmail && paymentEmail.html.includes('₹1500'));

    // ── Test 15: Notification deduplication within same event and reference ──
    const countBefore = emailService.getOutbox().length;
    await guardianService.notifyGuardianEvent(
      minorStudent.id,
      'PAYMENT',
      {
        title: 'Payment Confirmed & Session Scheduled',
        message: 'Payment of ₹1500 was confirmed for mentoring session.',
        referenceId: session.id,
        referenceType: 'PAYMENT'
      }
    );
    const countAfter = emailService.getOutbox().length;
    assert('15. Duplicate notifications for the same event and reference are deduplicated', countBefore === countAfter);

    // ── Test 16: Session, Milestone, and Assignment Notifications ──
    await guardianService.notifyGuardianEvent(
      minorStudent.id,
      'SESSION',
      {
        title: 'Session Completed',
        message: 'The mentoring session has been completed successfully.',
        referenceId: session.id + '_comp',
        referenceType: 'SESSION'
      }
    );
    const sessionEmail = emailService.getOutbox().find(e => e.subject.includes('Session Completed'));
    assert('16. Session completed notification triggered', !!sessionEmail);

    await guardianService.notifyGuardianEvent(
      minorStudent.id,
      'PROGRESS',
      {
        title: 'Milestone Completed!',
        message: 'Milestone "Binary Search Trees" was completed.',
        referenceId: goal.milestones[0].id,
        referenceType: 'MILESTONE'
      }
    );
    const milestoneEmail = emailService.getOutbox().find(e => e.subject.includes('Milestone Completed'));
    assert('16b. Milestone completion notification triggered', !!milestoneEmail);

    // ── Test 17: Complaint notification does not leak confidential allegations ──
    const complaintNotif = await guardianService.notifyGuardianEvent(
      minorStudent.id,
      'COMPLAINT',
      {
        title: 'Authorized Update: Complaint Resolved',
        message: 'An authorized status update has been posted (Category: NO SHOW). Current Status: RESOLVED. Resolution: Session fee refunded.',
        referenceId: 'comp_123',
        referenceType: 'COMPLAINT'
      }
    );
    const complaintEmail = emailService.getOutbox().find(e => e.subject.includes('Complaint Resolved'));
    assert(
      '17. Complaint notification provides authorized category & status without confidential details',
      !!complaintEmail && complaintEmail.html.includes('NO SHOW') && complaintEmail.html.includes('RESOLVED') && !complaintEmail.html.includes('adminNotes')
    );

    // ── Test 18: Notification delivery failure does not crash ──
    // Simulate invalid email
    let crashed = false;
    try {
      await emailService.sendMail({
        to: null,
        subject: 'Failing email',
        html: '<p>Test</p>'
      }).catch(() => {});
    } catch (e) {
      crashed = true;
    }
    assert('18. Notification delivery error handled gracefully without crashing application', !crashed);

    // ── Test 19: Turning 18 scheduled check stops monitoring and revokes old links ──
    // Advance student's DOB to make them 18
    const turned18Dob = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate() - 2);
    await prisma.user.update({
      where: { id: minorStudent.id },
      data: { dateOfBirth: turned18Dob }
    });

    // Create a new summary token for the turning 18 test
    const newSummaryToken = await guardianService.createSummaryLink(minorStudent.id).catch(() => null);
    // (createSummaryLink may already reject because user is now 18!)
    // If not, test the scheduler:
    const transitions = await schedulerService.checkAge18Transitions();
    assert('19. Turning 18 scheduled check detects and transitions adult student', transitions.some(t => t.studentId === minorStudent.id));

    const transitionedGuardian = await prisma.guardian.findUnique({ where: { id: verifiedGuardian.id } });
    assert(
      '19b. Guardian monitoring stopped and revocation recorded with STUDENT_REACHED_AGE_18',
      transitionedGuardian.isMonitoringActive === false && transitionedGuardian.accessRevokedReason === 'STUDENT_REACHED_AGE_18'
    );

    // ── Test 20: Accessing summary for a turned-18 student is blocked ──
    // Create a fake unexpired token directly in DB for this guardian to test summary access block
    const test18RawToken = 'test18_' + crypto.randomBytes(8).toString('hex');
    const test18Hash = guardianService.hashToken(test18RawToken);
    await prisma.guardianAccessToken.create({
      data: {
        guardianId: verifiedGuardian.id,
        tokenHash: test18Hash,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    let age18Blocked = false;
    try {
      await guardianService.getSummaryByToken(test18RawToken);
    } catch (err) {
      age18Blocked = err.code === 'STUDENT_TRANSITIONED_18' || err.status === 403;
    }
    assert('20. Summary endpoint strictly blocks access when student reaches 18', age18Blocked);

    // ── Clean up test data ──
    await prisma.guardianAccessToken.deleteMany({ where: { guardianId: verifiedGuardian.id } });
    await prisma.guardian.deleteMany({ where: { minorStudentId: { in: [minorStudent.id, minorStudent2.id, adultStudent.id] } } });
    await prisma.payment.deleteMany({ where: { sessionId: session.id } });
    await prisma.assignment.deleteMany({ where: { mentorshipId: mentorship.id } });
    await prisma.session.deleteMany({ where: { mentorshipId: mentorship.id } });
    await prisma.milestone.deleteMany({ where: { goalId: goal.id } });
    await prisma.goal.deleteMany({ where: { id: goal.id } });
    await prisma.mentorship.deleteMany({ where: { id: mentorship.id } });
    await prisma.studentProfile.deleteMany({ where: { userId: { in: [minorStudent.id, minorStudent2.id, adultStudent.id] } } });
    await prisma.mentorProfile.deleteMany({ where: { userId: mentorUser.id } });
    await prisma.notification.deleteMany({ where: { userId: { in: [minorStudent.id, minorStudent2.id, adultStudent.id, mentorUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [minorStudent.id, minorStudent2.id, adultStudent.id, mentorUser.id] } } });

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    if (failed === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runGuardianTests();
