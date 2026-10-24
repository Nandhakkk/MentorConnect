const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';
  return jwt.sign({ id: userId, role }, secret, { expiresIn: '1d' });
};

async function runTests() {
  console.log('================================================================');
  console.log('   EXPERIENCE-BASED PEER MENTOR ELIGIBILITY SYSTEM TEST SUITE   ');
  console.log('================================================================\n');

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('password', saltRounds);

  // Clean up any old test users from previous test runs
  await prisma.user.deleteMany({
    where: { email: { startsWith: 'peer_test_' } }
  });

  // Ensure a mentor exists to provide mentorship & sessions for tests
  const mentorUser = await prisma.user.findFirst({
    where: { role: 'MENTOR', mentorProfile: { status: 'APPROVED' } },
    include: { mentorProfile: true }
  });

  if (!mentorUser || !mentorUser.mentorProfile) {
    throw new Error('Approved mentor required in database for testing.');
  }

  const mentorProfileId = mentorUser.mentorProfile.id;

  // ---------------------------------------------------------------------------
  // TEST CASE 1: Brand new student fails account age & experience criteria
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Fresh new student eligibility check ---');
  const freshStudent = await prisma.user.create({
    data: {
      name: 'Fresh Student',
      email: `peer_test_fresh_${Date.now()}@test.com`,
      password: passwordHash,
      role: 'STUDENT',
      dateOfBirth: new Date('2003-01-01'), // 23 years old
      isActive: true,
      isSuspended: false,
      studentProfile: {
        create: {
          bio: 'Short bio',
          skills: 'Python',
          interests: 'Web',
          onboardingCompleted: true
        }
      }
    },
    include: { studentProfile: true }
  });

  const freshToken = generateToken(freshStudent.id, 'STUDENT');

  const res1 = await fetch(`${API_BASE}/peer-mentor/apply/eligibility`, {
    headers: { Authorization: `Bearer ${freshToken}` }
  });
  const data1 = await res1.json();

  console.log('Eligibility response status:', res1.status);
  console.log('Eligible:', data1.data.eligible);
  console.log('Met criteria count:', `${data1.data.metCount}/${data1.data.totalCriteriaCount}`);
  console.log('Unmet reasons count:', data1.data.reasons.length);

  if (data1.data.eligible === false && data1.data.metCount < 6) {
    console.log('✅ TEST 1 PASSED: Brand new student is correctly flagged as NOT eligible.');
  } else {
    throw new Error('TEST 1 FAILED: Fresh student should not be eligible.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 2: Ineligible student attempts direct API submission
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Ineligible student direct API submission rejection ---');
  const res2 = await fetch(`${API_BASE}/peer-mentor/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${freshToken}`
    },
    body: JSON.stringify({
      eligibilityInfo: {
        motivation: 'I want to be a mentor without requirements',
        topics: 'Python'
      }
    })
  });
  const data2 = await res2.json();

  console.log('Direct submission HTTP status:', res2.status);
  console.log('Error message:', data2.message);
  console.log('Reasons returned by backend:', data2.reasons?.length);

  if (res2.status === 400 && data2.status === 'error' && data2.reasons?.length > 0) {
    console.log('✅ TEST 2 PASSED: Backend securely rejected ineligible direct submission with HTTP 400.');
  } else {
    throw new Error('TEST 2 FAILED: Backend did not reject ineligible submission.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 3: Student meeting partial criteria
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Partial criteria calculation & tracking ---');
  // 40 days old account, 2 goals (1 completed), profile complete, but missing sessions (has 2) and assignments (has 1)
  const partialCreatedDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const partialStudent = await prisma.user.create({
    data: {
      name: 'Partial Student',
      email: `peer_test_partial_${Date.now()}@test.com`,
      password: passwordHash,
      role: 'STUDENT',
      dateOfBirth: new Date('2001-04-10'),
      createdAt: partialCreatedDate,
      isActive: true,
      isSuspended: false,
      studentProfile: {
        create: {
          bio: 'Experienced student learner with solid foundation in algorithms.',
          skills: 'JavaScript, React, Node.js',
          interests: 'Frontend Architecture',
          onboardingCompleted: true,
          goals: {
            create: [
              { title: 'Goal 1 Completed', status: 'COMPLETED' },
              { title: 'Goal 2 In Progress', status: 'ACTIVE' }
            ]
          }
        }
      }
    },
    include: { studentProfile: true }
  });

  // Create mentorship with 2 completed sessions
  const partialMentorship = await prisma.mentorship.create({
    data: {
      studentId: partialStudent.studentProfile.id,
      mentorId: mentorProfileId,
      status: 'ACTIVE'
    }
  });

  await prisma.session.create({
    data: {
      mentorshipId: partialMentorship.id,
      scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'COMPLETED',
      topic: 'Intro to React'
    }
  });
  await prisma.session.create({
    data: {
      mentorshipId: partialMentorship.id,
      scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'COMPLETED',
      topic: 'React Hooks'
    }
  });

  // Create 1 submitted assignment
  const partialAssign = await prisma.assignment.create({
    data: {
      mentorshipId: partialMentorship.id,
      studentId: partialStudent.studentProfile.id,
      mentorId: mentorProfileId,
      title: 'React Components',
      status: 'SUBMITTED'
    }
  });

  const partialToken = generateToken(partialStudent.id, 'STUDENT');

  const res3 = await fetch(`${API_BASE}/peer-mentor/apply/eligibility`, {
    headers: { Authorization: `Bearer ${partialToken}` }
  });
  const data3 = await res3.json();

  console.log('Account maturity met:', data3.data.criteria.accountMaturity.met);
  console.log('Learning goals met:', data3.data.criteria.learningGoals.met);
  console.log('Sessions met:', data3.data.criteria.mentoringExperience.met, `(${data3.data.criteria.mentoringExperience.current}/5)`);
  console.log('Assignments met:', data3.data.criteria.assignmentsCompleted.met, `(${data3.data.criteria.assignmentsCompleted.current}/3)`);

  if (
    data3.data.criteria.accountMaturity.met === true &&
    data3.data.criteria.learningGoals.met === true &&
    data3.data.criteria.mentoringExperience.met === false &&
    data3.data.criteria.assignmentsCompleted.met === false
  ) {
    console.log('✅ TEST 3 PASSED: Partial criteria accurately tracked and calculated.');
  } else {
    throw new Error('TEST 3 FAILED: Partial criteria calculation mismatch.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 4 & 5: Fully eligible student submits application successfully
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4 & 5: Fully eligible student satisfies criteria & submits ---');
  // Add 3 more completed sessions (total 5)
  for (let i = 0; i < 3; i++) {
    await prisma.session.create({
      data: {
        mentorshipId: partialMentorship.id,
        scheduledAt: new Date(Date.now() - (2 - i) * 24 * 60 * 60 * 1000),
        duration: 60,
        status: 'COMPLETED',
        topic: `Advanced React Session ${i + 1}`
      }
    });
  }

  // Add 2 more submitted assignments (total 3)
  for (let i = 0; i < 2; i++) {
    await prisma.assignment.create({
      data: {
        mentorshipId: partialMentorship.id,
        studentId: partialStudent.studentProfile.id,
        mentorId: mentorProfileId,
        title: `React Practice Task ${i + 2}`,
        status: 'SUBMITTED'
      }
    });
  }

  // Re-check eligibility
  const res4 = await fetch(`${API_BASE}/peer-mentor/apply/eligibility`, {
    headers: { Authorization: `Bearer ${partialToken}` }
  });
  const data4 = await res4.json();

  console.log('Eligible after completing requirements:', data4.data.eligible);
  console.log('Met criteria count:', `${data4.data.metCount}/${data4.data.totalCriteriaCount}`);

  if (data4.data.eligible !== true || data4.data.metCount !== 6) {
    throw new Error(`TEST 4 FAILED: Student should be eligible! Met ${data4.data.metCount}/6. Reasons: ${data4.data.reasons}`);
  }
  console.log('✅ TEST 4 PASSED: Student meeting all 6 criteria is now ELIGIBLE.');

  // Submit application
  const res5 = await fetch(`${API_BASE}/peer-mentor/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${partialToken}`
    },
    body: JSON.stringify({
      eligibilityInfo: {
        motivation: 'I love teaching peer students and breaking down tough concepts.',
        topics: 'React, JavaScript, Web Architecture',
        teachingExperience: 'Conducted study groups for juniors in university.'
      }
    })
  });
  const data5 = await res5.json();

  console.log('Application submission HTTP status:', res5.status);
  console.log('Created application status:', data5.data?.status);

  if (res5.status === 201 && data5.data?.status === 'PENDING') {
    console.log('✅ TEST 5 PASSED: Eligible student application created in PENDING status.');
  } else {
    throw new Error('TEST 5 FAILED: Application creation failed.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 6: Duplicate submission prevented
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Duplicate submission prevention ---');
  const res6 = await fetch(`${API_BASE}/peer-mentor/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${partialToken}`
    },
    body: JSON.stringify({
      eligibilityInfo: { motivation: 'Duplicate attempt', topics: 'React' }
    })
  });
  const data6 = await res6.json();

  console.log('Duplicate submission status:', res6.status);
  console.log('Duplicate message:', data6.message);

  if (res6.status === 400 && data6.message.includes('already have an active peer mentor application')) {
    console.log('✅ TEST 6 PASSED: Duplicate peer mentor application blocked.');
  } else {
    throw new Error('TEST 6 FAILED: Duplicate application was not blocked.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 7: Application Review Status & Screening
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: AI Screening & Status Lifecycle ---');
  const res7 = await fetch(`${API_BASE}/peer-mentor/apply/screen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partialToken}` }
  });
  const data7 = await res7.json();

  console.log('AI Screening response status:', res7.status);
  console.log('Outcome:', data7.outcome);
  console.log('Updated app status:', data7.application?.status);

  if (res7.status === 200 && ['AI_SCREENED', 'UNDER_REVIEW'].includes(data7.application?.status)) {
    console.log(`✅ TEST 7 PASSED: AI screening ran and advanced application status to ${data7.application?.status}.`);
  } else {
    throw new Error('TEST 7 FAILED: AI screening failed.');
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 8: Exclusion of cancelled, missed, and refunded sessions
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Strict exclusion of invalid/refunded sessions ---');
  // Create student with 4 valid sessions + 1 cancelled + 1 missed + 1 refunded
  const exclusionStudent = await prisma.user.create({
    data: {
      name: 'Exclusion Student',
      email: `peer_test_exclusion_${Date.now()}@test.com`,
      password: passwordHash,
      role: 'STUDENT',
      dateOfBirth: new Date('2000-01-01'),
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      isActive: true,
      isSuspended: false,
      studentProfile: {
        create: {
          bio: 'Long valid bio exceeding twenty characters for test.',
          skills: 'SQL',
          interests: 'DB',
          onboardingCompleted: true,
          goals: {
            create: [
              { title: 'Goal 1', status: 'COMPLETED' },
              { title: 'Goal 2', status: 'ACTIVE' }
            ]
          }
        }
      }
    },
    include: { studentProfile: true }
  });

  const exclusionMentorship = await prisma.mentorship.create({
    data: {
      studentId: exclusionStudent.studentProfile.id,
      mentorId: mentorProfileId,
      status: 'ACTIVE'
    }
  });

  // 4 valid completed sessions
  for (let i = 0; i < 4; i++) {
    await prisma.session.create({
      data: {
        mentorshipId: exclusionMentorship.id,
        scheduledAt: new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000),
        duration: 60,
        status: 'COMPLETED',
        topic: `Valid session ${i}`
      }
    });
  }

  // 1 CANCELLED session
  await prisma.session.create({
    data: {
      mentorshipId: exclusionMentorship.id,
      scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'CANCELLED',
      topic: 'Cancelled Session'
    }
  });

  // 1 MISSED session
  await prisma.session.create({
    data: {
      mentorshipId: exclusionMentorship.id,
      scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'MISSED',
      topic: 'Missed Session'
    }
  });

  // 1 COMPLETED but REFUNDED session
  const refundedSess = await prisma.session.create({
    data: {
      mentorshipId: exclusionMentorship.id,
      scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'COMPLETED',
      topic: 'Refunded Session'
    }
  });

  await prisma.payment.create({
    data: {
      studentId: exclusionStudent.studentProfile.id,
      sessionId: refundedSess.id,
      amount: 500,
      platformFee: 50,
      mentorAmount: 450,
      currency: 'INR',
      status: 'REFUNDED'
    }
  });

  const exclusionToken = generateToken(exclusionStudent.id, 'STUDENT');
  const res8 = await fetch(`${API_BASE}/peer-mentor/apply/eligibility`, {
    headers: { Authorization: `Bearer ${exclusionToken}` }
  });
  const data8 = await res8.json();

  console.log('Count of counted sessions:', data8.data.criteria.mentoringExperience.current);
  if (data8.data.criteria.mentoringExperience.current === 4 && data8.data.criteria.mentoringExperience.met === false) {
    console.log('✅ TEST 8 PASSED: Cancelled, missed, and refunded sessions were strictly excluded.');
  } else {
    throw new Error(`TEST 8 FAILED: Expected 4 valid sessions, got ${data8.data.criteria.mentoringExperience.current}`);
  }

  // ---------------------------------------------------------------------------
  // TEST CASE 9: Approved peer mentor & professional mentor dashboards
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Approved Peer Mentor & Existing Roles ---');
  // Check approved peer mentor Karthik
  const karthikUser = await prisma.user.findUnique({
    where: { email: 'karthik@gmail.com' },
    include: { mentorProfile: true }
  });

  const karthikToken = generateToken(karthikUser.id, 'STUDENT');
  const res9 = await fetch(`${API_BASE}/peer-mentor/apply/eligibility`, {
    headers: { Authorization: `Bearer ${karthikToken}` }
  });
  const data9 = await res9.json();

  console.log('Karthik applicationStatus:', data9.data.applicationStatus);
  console.log('Karthik alreadyApproved:', data9.data.alreadyApproved);

  if (data9.data.applicationStatus === 'APPROVED' && data9.data.alreadyApproved === true) {
    console.log('✅ TEST 9 PASSED: Approved peer mentor receives APPROVED applicationStatus.');
  } else {
    throw new Error('TEST 9 FAILED: Approved peer mentor status incorrect.');
  }

  // Clean up created test accounts
  await prisma.user.deleteMany({
    where: { email: { startsWith: 'peer_test_' } }
  });

  console.log('\n================================================================');
  console.log('       ALL 9 PEER MENTOR ELIGIBILITY TESTS PASSED! 🎉           ');
  console.log('================================================================');
}

runTests()
  .catch((e) => {
    console.error('Test Suite Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
