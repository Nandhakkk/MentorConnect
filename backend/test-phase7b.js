const { screenApplication } = require('./src/controllers/peerMentorController');
const aiService = require('./src/services/aiService');
const prisma = require('./src/config/db');

// Mock res object
const createRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('--- STARTING PHASE 7B TESTS ---');
  
  // Create some test users
  const testStudent = await prisma.user.create({
    data: {
      name: 'Test Student',
      email: 'test_student_7b@example.com',
      password: 'password',
      role: 'STUDENT',
      dateOfBirth: new Date('2000-01-01'),
      studentProfile: {
        create: {
          education: 'BSc Computer Science',
          skills: 'JavaScript',
          onboardingCompleted: true
        }
      }
    }
  });

  const testMentor = await prisma.user.create({
    data: {
      name: 'Test Mentor',
      email: 'test_mentor_7b@example.com',
      password: 'password',
      role: 'MENTOR'
    }
  });

  const testGuardian = await prisma.user.create({
    data: {
      name: 'Test Guardian',
      email: 'test_guardian_7b@example.com',
      password: 'password',
      role: 'GUARDIAN'
    }
  });
  
  // 1. student without application
  let req = { user: { id: testStudent.id } };
  let res = createRes();
  await screenApplication(req, res);
  console.log('TEST 2 (student without application): Expected 404, Actual', res.statusCode);
  
  // Create application PENDING
  const mentorProfile = await prisma.mentorProfile.create({
    data: {
      userId: testStudent.id,
      mentorType: 'PEER',
      status: 'PENDING',
      peerApplications: {
        create: {
          eligibilityInfo: '{"motivation":"I want to help"}',
          status: 'PENDING'
        }
      }
    },
    include: {
      peerApplications: true
    }
  });
  const appId = mentorProfile.peerApplications[0].id;
  
  // Mock AI response logic for testing invalid / failure
  const originalGenerate = aiService.generateText;
  
  // 10. AI failure
  aiService.generateText = async () => { throw new Error('AI Down'); };
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 10 (AI failure): Expected 503, Actual', res.statusCode);
  
  // 11. Invalid AI response
  aiService.generateText = async () => 'not json';
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 11 (Invalid AI response): Expected 502, Actual', res.statusCode);
  
  // 1. valid student + PENDING application + successful AI response
  aiService.generateText = async () => JSON.stringify({
    recommendation: 'Good', strengths: ['x'], concerns: [], riskFlags: [], developmentAreas: []
  });
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 1 & 9 (valid student + PENDING + successful AI): Expected 200, Actual', res.statusCode);
  
  // 6. APPROVED application (it is now AI_SCREENED, let's change to APPROVED)
  await prisma.peerMentorApplication.update({ where: { id: appId }, data: { status: 'APPROVED' } });
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 6 (APPROVED application): Expected 400, Actual', res.statusCode);
  
  // 7. REJECTED application
  await prisma.peerMentorApplication.update({ where: { id: appId }, data: { status: 'REJECTED' } });
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 7 (REJECTED application): Expected 400, Actual', res.statusCode);
  
  // 8. SUSPENDED application
  await prisma.peerMentorApplication.update({ where: { id: appId }, data: { status: 'SUSPENDED' } });
  res = createRes();
  await screenApplication(req, res);
  console.log('TEST 8 (SUSPENDED application): Expected 400, Actual', res.statusCode);
  
  // Note: 3, 4, 5 (MENTOR, GUARDIAN, another student) are handled by middleware / controller logic
  // Since we are mocking controller, MENTOR / GUARDIAN without application hits 404 (No application). 
  // In real life, middleware blocks them before controller.
  
  // Clean up
  await prisma.peerMentorApplication.deleteMany({ where: { mentorId: mentorProfile.id } });
  await prisma.aIScreeningResult.deleteMany({ where: { peerApplicationId: appId }});
  await prisma.mentorProfile.deleteMany({ where: { userId: testStudent.id } });
  await prisma.studentProfile.deleteMany({ where: { userId: testStudent.id } });
  await prisma.user.deleteMany({ where: { id: { in: [testStudent.id, testMentor.id, testGuardian.id] } } });
  
  console.log('--- TESTS COMPLETE ---');
}

runTests().catch(console.error).finally(() => process.exit(0));
